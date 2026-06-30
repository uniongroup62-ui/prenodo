"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Pixel-faithful port of the PHP POS "cassa" page (app/pages/pos.php, ?page=pos),
// fed by the existing DB-backed /api/manage/pos context.
//
// WIRED (core sale flow): load clients + service/product catalog from
// GET /api/manage/pos; select a client; click a catalog tile to add a cart line;
// qty +/- and remove per line; subtotal/discount/total in Italian "€ X,XX" format;
// manual discount (none/percent/fixed); the "Concludi" button POSTs action=checkout
// with items_json/payments_json and resets the cart on success (showing a success
// banner).
//
// WIRED (coupon preview): the coupon Apply/Remove buttons (couponApplyBtn /
// couponRemoveBtn) validate the typed code against POST /api/manage/coupons
// action=preview (the same endpoint the quick-booking drawer uses) with the current
// subtotal. On a valid coupon the discount is stored, the "Coupon (CODE) − € X,XX"
// row (posCodeDiscountRow) is revealed and SUBTRACTED from the total; the reason is
// shown on invalid. coupon_code is still sent on checkout (the backend re-validates,
// so the shown discount always equals the charged discount).
//
// WIRED (faithful payment + Residui): the legacy model is ONE base payment method
// (Contanti/Carta/Assegno/Bonifico) for the REMAINDER, plus "Residui" — the client's
// wallet CREDIT and a GiftCard balance can each cover part of the total. When a client
// is selected the panel fetches GET ?action=client_residuals&client_id= (credit +
// giftcards); the staff applies an amount from credit and/or a chosen giftcard, clamped
// to min(balance, remaining). base = total − credit_use − giftcard_use. The hidden
// inputs (#pos_credit_use / #pos_giftcard_id / #pos_giftcard_use) + the price rows
// (#posCreditRow / #posGiftcardRow) reflect the applied residui; checkout sends
// payments_json = [{wallet, credit_use}, {giftcard+giftcardId, giftcard_use},
// {baseMethod, remainder}] (non-zero only). Checkout is blocked when residui exceed
// the balances or the tendered sum < total (mirrors the backend validation + consume).
//
// WIRED (fidelity points redemption): when the selected client has points and the
// business has redemption enabled, the "Punti da usare" box (#posFidelityRedeemBox)
// reveals; the staff types points to spend (or "Max"), the € discount (punti x
// euroPerPoint, clamped to min(balance, floor(payable / euroPerPoint))) is shown on the
// "Sconto Punti" row (#posFidelityRow) and subtracted from the total, composed with the
// manual discount + coupon + residui. fidelity_points_use is sent on checkout; the
// backend re-validates against the live balance + redeem settings, applies the discount,
// and consumes the points (a points_redeem wallet movement). Checkout is blocked below
// the configured minimum or above the balance (mirrors the backend).
//
// LEFT STATIC / NON-WIRED (rendered faithfully for visual fidelity only): the
// advanced line types and their modals — Pacchetti, Ricariche, GiftBox, GiftCard
// (ISSUE), and the installment (rate) plan. These dialogs are reproduced verbatim but
// their buttons do not mutate state yet. The checkout only sends service/product lines
// plus the base method + residui tenders + the fidelity points discount.

type CatalogService = {
  id: number;
  name: string;
  price: string; // e.g. "12,00 euro"
  category?: string;
  locationIds?: number[];
};

type CatalogProduct = {
  id: number;
  name: string;
  price: string; // e.g. "12,00 euro"
  sku?: string;
  stock?: number;
  category?: string;
};

type CatalogClient = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
};

type PosContext = {
  activeLocationId?: number;
  catalog?: {
    clients?: CatalogClient[];
    services?: CatalogService[];
    products?: CatalogProduct[];
  };
};

// The client's spendable residui (wallet CREDIT + GiftCards) + the FIDELITY points balance
// and redeem settings, fetched from GET /api/manage/pos?action=client_residuals&client_id=
// when a client is selected.
type ClientResiduals = {
  clientId: number;
  credit: number;
  giftcards: Array<{ id: number; code: string; balance: number }>;
  points: number;
  fidelity: { enabled: boolean; euroPerPoint: number; minPoints: number };
};

type CartLine = {
  key: string;
  type: "service" | "product";
  refId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  status: "executed" | "collected";
};

// Legacy POS base payment type (the single payment_type radio: cash/card/check/bank).
// The Next API maps check -> card and bank -> transfer (see app/api/manage/pos route).
type PaymentMethod = "cash" | "card" | "check" | "bank";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Contanti",
  card: "Carta",
  check: "Assegno",
  bank: "Bonifico",
};

// PHP payment radios use cash/card/check/bank; the Next API maps check->card and
// bank->transfer (port of normalizePaymentMethod in app/api/manage/pos/route.ts).
function apiPaymentMethod(method: PaymentMethod): string {
  if (method === "cash") return "cash";
  if (method === "bank") return "transfer";
  return "card"; // card + check
}

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

// "12,00 euro" / "12.00" -> 12 (numeric). Mirrors how the PHP catalog feeds prices.
function parsePrice(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "")
    .replace(/euro/gi, "")
    .replace(/€/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!raw) return 0;
  // Italian formatting: thousands "." and decimal ",". Strip thousands, swap comma.
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

// Mirrors pos.js fmtEUR(): "€ 0,00"
function fmtEUR(value: number): string {
  try {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value) || 0);
  } catch {
    return "€ " + (Number(value) || 0).toFixed(2).replace(".", ",");
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function PosContent() {
  const slug = tenantSlug();

  const [ctx, setCtx] = useState<PosContext | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected client (null = "Cliente banco").
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientName, setClientName] = useState<string>("");

  // Catalog UI state.
  const [catalogMode, setCatalogMode] = useState<"service" | "product">("service");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  // Cart.
  const [cart, setCart] = useState<CartLine[]>([]);

  // Discount (manual).
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState<string>("0");

  // Coupon (wired): the box toggle + the typed code, plus the APPLIED coupon
  // (couponCode/couponDiscount mirror what the preview validated) and the
  // couponHelp feedback ({text, ok}). couponApplying disables the buttons during
  // the preview fetch; a monotonic req-id discards stale responses (legacy pattern).
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const couponReqRef = useRef(0);

  // Payment: ONE base method for the remainder after residui (faithful single
  // payment_type radio). Defaults to Contanti.
  const [baseMethod, setBaseMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  // Residui: the selected client's spendable wallet CREDIT + GiftCards, and the amounts
  // the staff applies. creditUse / giftcardUse are the applied (clamped) amounts;
  // giftcardId is the chosen card. `residuals` is null until the fetch resolves for the
  // current client, so "loading" is derived (a client is selected but residui not yet in).
  const [residuals, setResiduals] = useState<ClientResiduals | null>(null);
  const [creditUseInput, setCreditUseInput] = useState("0");
  const [giftcardId, setGiftcardId] = useState(0);
  const [giftcardUseInput, setGiftcardUseInput] = useState("0");
  // FIDELITY points the staff applies as a discount (raw typed value; re-clamped below).
  const [pointsUseInput, setPointsUseInput] = useState("0");
  const residualsReqRef = useRef(0);

  // Checkout state.
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/manage/pos?slug=${encodeURIComponent(slug)}`, { headers: { "x-tenant-slug": slug } })
      .then((r) => r.json())
      .then((j: PosContext) => setCtx(j ?? null))
      .catch(() => setCtx(null))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, [load]);

  const clients = useMemo(() => ctx?.catalog?.clients ?? [], [ctx]);
  const services = useMemo(() => ctx?.catalog?.services ?? [], [ctx]);
  const products = useMemo(() => ctx?.catalog?.products ?? [], [ctx]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q),
    );
  }, [clients, clientSearch]);

  const tiles = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (catalogMode === "service") {
      return services
        .filter((s) => !q || s.name.toLowerCase().includes(q))
        .map((s) => ({ id: s.id, name: s.name, price: parsePrice(s.price), stock: undefined as number | undefined }));
    }
    return products
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q))
      .map((p) => ({ id: p.id, name: p.name, price: parsePrice(p.price), stock: p.stock }));
  }, [catalogMode, catalogSearch, services, products]);

  // ---- cart math (mirrors pos.js + lib/manage-pos.ts) ----
  const subtotal = useMemo(
    () => roundMoney(cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)),
    [cart],
  );

  const manualDiscount = useMemo(() => {
    const v = Math.max(0, Number.parseFloat(discountValue.replace(",", ".")) || 0);
    if (discountType === "percent") return roundMoney(Math.min(subtotal, (subtotal * v) / 100));
    if (discountType === "fixed") return roundMoney(Math.min(subtotal, v));
    return 0;
  }, [discountType, discountValue, subtotal]);

  // The coupon discount shown is the previewed value, but it is composed with the
  // manual discount exactly like the backend (discount = min(subtotal, manual +
  // coupon)), so it never drives the total negative and the shown total equals the
  // server's. Only the part of the coupon that fits after the manual discount counts.
  const codeDiscount = useMemo(
    () => roundMoney(Math.min(Math.max(0, couponDiscount), Math.max(0, subtotal - manualDiscount))),
    [couponDiscount, subtotal, manualDiscount],
  );

  // ---- fidelity points redemption math ----
  // Redemption is offered only when the backend reports it enabled for this client (global
  // fidelity_enabled + fidelity_redeem_enabled + the client has points). The € discount is
  // pointsUsed x euroPerPoint, capped by the client's balance AND by the amount payable
  // after the manual + coupon discount (baseForPoints) — faithful to the backend, so the
  // shown discount always equals the charged one. Points are whole numbers.
  const fidelityEnabled = useMemo(
    () => !!residuals?.fidelity.enabled && (residuals?.points ?? 0) > 0,
    [residuals],
  );
  const euroPerPoint = useMemo(() => {
    const epp = roundMoney(Math.max(0, residuals?.fidelity.euroPerPoint ?? 0.1));
    return epp > 0 ? epp : 0.1;
  }, [residuals]);
  const pointsBalance = useMemo(() => Math.max(0, Math.floor(residuals?.points ?? 0)), [residuals]);
  const minPoints = useMemo(() => Math.max(0, Math.floor(residuals?.fidelity.minPoints ?? 0)), [residuals]);
  // The amount still payable after manual + coupon — the cap the points discount fits into.
  const baseForPoints = useMemo(
    () => roundMoney(Math.max(0, subtotal - manualDiscount - codeDiscount)),
    [subtotal, manualDiscount, codeDiscount],
  );
  // The most whole points the payable amount allows: floor(baseForPoints / euroPerPoint).
  const maxPointsByAmount = useMemo(
    () => (euroPerPoint > 0 ? Math.floor((baseForPoints + 1e-9) / euroPerPoint) : 0),
    [baseForPoints, euroPerPoint],
  );
  // The points actually used = min(requested, balance, maxByAmount), whole.
  const pointsUsed = useMemo(() => {
    if (!fidelityEnabled) return 0;
    const typed = Math.max(0, Math.floor(Number.parseInt(pointsUseInput, 10) || 0));
    return Math.max(0, Math.min(typed, pointsBalance, maxPointsByAmount));
  }, [fidelityEnabled, pointsUseInput, pointsBalance, maxPointsByAmount]);
  const fidelityDiscount = useMemo(
    () => roundMoney(Math.min(baseForPoints, pointsUsed * euroPerPoint)),
    [baseForPoints, pointsUsed, euroPerPoint],
  );
  // Whether the typed points are below the configured minimum (blocks checkout + warns).
  const pointsBelowMin = useMemo(() => {
    const typed = Math.max(0, Math.floor(Number.parseInt(pointsUseInput, 10) || 0));
    return fidelityEnabled && minPoints > 0 && typed > 0 && typed < minPoints;
  }, [fidelityEnabled, pointsUseInput, minPoints]);
  // Whether the typed points exceed the client's balance (blocks checkout + warns).
  const pointsOverBalance = useMemo(() => {
    const typed = Math.max(0, Math.floor(Number.parseInt(pointsUseInput, 10) || 0));
    return fidelityEnabled && typed > pointsBalance;
  }, [fidelityEnabled, pointsUseInput, pointsBalance]);

  const total = useMemo(
    () => roundMoney(Math.max(0, subtotal - manualDiscount - codeDiscount - fidelityDiscount)),
    [subtotal, manualDiscount, codeDiscount, fidelityDiscount],
  );

  // ---- residui math ----
  // The chosen giftcard's available balance (0 when none / not in the list anymore).
  const selectedGiftcard = useMemo(
    () => residuals?.giftcards.find((card) => card.id === giftcardId) ?? null,
    [residuals, giftcardId],
  );
  const creditAvailable = useMemo(() => roundMoney(Math.max(0, residuals?.credit ?? 0)), [residuals]);

  // GiftCard is applied first (legacy order), so it is clamped to min(balance, total);
  // credit then covers what is left of the total after the giftcard.
  const giftcardUse = useMemo(() => {
    if (!selectedGiftcard) return 0;
    const typed = Math.max(0, Number.parseFloat(giftcardUseInput.replace(",", ".")) || 0);
    return roundMoney(Math.min(typed, selectedGiftcard.balance, total));
  }, [selectedGiftcard, giftcardUseInput, total]);

  const creditUse = useMemo(() => {
    const typed = Math.max(0, Number.parseFloat(creditUseInput.replace(",", ".")) || 0);
    const remainingAfterGiftcard = roundMoney(Math.max(0, total - giftcardUse));
    return roundMoney(Math.min(typed, creditAvailable, remainingAfterGiftcard));
  }, [creditUseInput, creditAvailable, total, giftcardUse]);

  const residuiTotal = useMemo(() => roundMoney(creditUse + giftcardUse), [creditUse, giftcardUse]);

  // ---- base payment math ----
  // The base method covers the remainder after residui: base = total − residui.
  const baseAmount = useMemo(() => roundMoney(Math.max(0, total - residuiTotal)), [total, residuiTotal]);
  const paidTotal = useMemo(() => roundMoney(residuiTotal + baseAmount), [residuiTotal, baseAmount]);
  const remainingToPay = useMemo(() => roundMoney(Math.max(0, total - paidTotal)), [total, paidTotal]);
  // Residui can never exceed the balances (they are clamped above) nor the total, so the
  // base auto-covers the rest; "insufficiente" can only happen if the total is somehow
  // not covered (defensive — mirrors the backend "Pagamento insufficiente").
  const paymentInsufficient = useMemo(() => total > 0 && paidTotal + 0.00001 < total, [total, paidTotal]);

  // Reset every applied residui (used on client change, clear, and checkout success).
  const resetResiduals = useCallback(() => {
    residualsReqRef.current += 1;
    setResiduals(null);
    setCreditUseInput("0");
    setGiftcardId(0);
    setGiftcardUseInput("0");
    setPointsUseInput("0");
  }, []);

  function selectClient(id: number, name: string) {
    setClientId(id);
    setClientName(name);
  }

  function clearClient() {
    // The residui fetch effect's cleanup resets the applied residui on the clientId change.
    setClientId(null);
    setClientName("");
  }

  // Fetch the selected client's residui (wallet CREDIT + GiftCards) whenever the client
  // changes. "Cliente banco" (no id) has no residui. A monotonic req-id discards stale
  // responses (legacy pattern); the cleanup resets the applied residui before the next
  // client's fetch (so a client switch never carries the previous client's residui).
  useEffect(() => {
    if (!clientId || clientId <= 0) return () => resetResiduals();
    const myReq = ++residualsReqRef.current;
    let active = true;
    fetch(`/api/manage/pos?slug=${encodeURIComponent(slug)}&action=client_residuals&client_id=${clientId}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; clientId?: number; credit?: number; giftcards?: ClientResiduals["giftcards"]; points?: number; fidelity?: ClientResiduals["fidelity"] }) => {
        if (!active || myReq !== residualsReqRef.current) return; // stale
        const epp = roundMoney(Math.max(0, Number(j?.fidelity?.euroPerPoint ?? 0.1))) || 0.1;
        setResiduals({
          clientId: Number(j?.clientId ?? clientId),
          credit: j?.ok === false ? 0 : roundMoney(Math.max(0, Number(j?.credit ?? 0))),
          giftcards: j?.ok !== false && Array.isArray(j?.giftcards)
            ? j.giftcards
                .map((card) => ({ id: Number(card.id ?? 0), code: String(card.code ?? ""), balance: roundMoney(Math.max(0, Number(card.balance ?? 0))) }))
                .filter((card) => card.id > 0 && card.balance > 0)
            : [],
          points: j?.ok === false ? 0 : Math.max(0, Math.floor(Number(j?.points ?? 0))),
          fidelity: {
            enabled: j?.ok !== false && j?.fidelity?.enabled === true,
            euroPerPoint: epp,
            minPoints: Math.max(0, Math.floor(Number(j?.fidelity?.minPoints ?? 0))),
          },
        });
      })
      .catch(() => {
        if (active && myReq === residualsReqRef.current) {
          setResiduals({ clientId, credit: 0, giftcards: [], points: 0, fidelity: { enabled: false, euroPerPoint: 0.1, minPoints: 0 } });
        }
      });
    return () => {
      active = false;
      resetResiduals();
    };
  }, [clientId, slug, resetResiduals]);

  // "Loading" is derived: a client is selected but its residui have not resolved yet.
  const residualsLoading = useMemo(
    () => !!clientId && clientId > 0 && (!residuals || residuals.clientId !== clientId),
    [clientId, residuals],
  );

  function addTile(tile: { id: number; name: string; price: number }) {
    const type = catalogMode;
    setCart((prev) => {
      const existing = prev.find((l) => l.type === type && l.refId === tile.id);
      if (existing) {
        return prev.map((l) =>
          l === existing ? { ...l, quantity: Math.min(1000, l.quantity + 1) } : l,
        );
      }
      const line: CartLine = {
        key: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        refId: tile.id,
        name: tile.name,
        quantity: 1,
        unitPrice: tile.price,
        status: type === "service" ? "executed" : "collected",
      };
      return [line, ...prev];
    });
  }

  function setQty(key: string, qty: number) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(1000, qty || 1)) } : l)));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  // ---- Coupon preview (wired) ----
  // Reset the applied coupon (invalidates any in-flight preview via the req-id).
  const clearCouponState = useCallback(() => {
    couponReqRef.current += 1;
    setCouponCode("");
    setCouponDiscount(0);
  }, []);

  // Apply: validate the typed code against the DB coupons preview endpoint
  // (POST /api/manage/coupons action=preview -> {ok, preview:{valid, discount, reason}},
  // the same endpoint the quick-booking drawer uses). On valid, store the code +
  // discount (revealing the coupon row and subtracting it from the total); on invalid
  // show the reason. The subtotal sent is the cart subtotal (coupon minimums are
  // subtotal-aware; the backend re-validates on checkout so the charged discount agrees).
  const applyCoupon = useCallback(async () => {
    const code = couponInput.trim().toUpperCase();
    setCouponOpen(true);
    if (!code) {
      clearCouponState();
      setCouponInput("");
      setCouponMsg({ text: "Inserisci un codice coupon.", ok: false });
      return;
    }
    if (subtotal <= 0) {
      setCouponMsg({ text: "Aggiungi almeno un elemento al carrello.", ok: false });
      return;
    }
    const myReq = ++couponReqRef.current;
    setCouponApplying(true);
    try {
      const res = await fetch(`/api/manage/coupons?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify({ action: "preview", code, subtotal }),
      });
      const data: { ok?: boolean; error?: string; preview?: { valid?: boolean; discount?: number; reason?: string } } =
        await res.json().catch(() => ({}));
      if (myReq !== couponReqRef.current) return; // stale
      const preview = data?.preview;
      if (res.ok && data?.ok !== false && preview?.valid) {
        const disc = roundMoney(Math.max(0, Number(preview.discount ?? 0)));
        setCouponCode(code);
        setCouponDiscount(disc);
        setCouponInput(code);
        setCouponMsg({ text: "Coupon applicato.", ok: true });
      } else {
        clearCouponState();
        setCouponInput(code);
        setCouponMsg({ text: String(preview?.reason || data?.error || "Coupon non applicabile."), ok: false });
      }
    } catch {
      if (myReq !== couponReqRef.current) return;
      clearCouponState();
      setCouponInput(code);
      setCouponMsg({ text: "Errore durante la verifica del coupon.", ok: false });
    } finally {
      if (myReq === couponReqRef.current) setCouponApplying(false);
    }
  }, [couponInput, subtotal, slug, clearCouponState]);

  // Remove: clear the applied coupon + the typed code + the feedback.
  const removeCoupon = useCallback(() => {
    clearCouponState();
    setCouponInput("");
    setCouponMsg(null);
  }, [clearCouponState]);

  // ---- Residui mutators ----
  // "Usa max" for credit: apply the most the credit can cover (clamped to the remaining
  // total after the giftcard) — the creditUse memo re-clamps, so set the raw cap here.
  function useMaxCredit() {
    const remainingAfterGiftcard = roundMoney(Math.max(0, total - giftcardUse));
    setCreditUseInput(roundMoney(Math.min(creditAvailable, remainingAfterGiftcard)).toFixed(2));
  }
  // "Usa max" for the chosen giftcard: apply the most it can cover (clamped to total).
  function useMaxGiftcard() {
    if (!selectedGiftcard) return;
    setGiftcardUseInput(roundMoney(Math.min(selectedGiftcard.balance, total)).toFixed(2));
  }
  // Picking a different giftcard resets the applied amount (the balances differ).
  function chooseGiftcard(id: number) {
    setGiftcardId(id);
    setGiftcardUseInput("0");
  }
  // "Max" for fidelity points: apply the most the client can spend on this sale —
  // min(balance, floor(payable / euroPerPoint)). The pointsUsed memo re-clamps.
  function useMaxPoints() {
    setPointsUseInput(String(Math.max(0, Math.min(pointsBalance, maxPointsByAmount))));
  }

  async function handleCheckout(event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (cart.length === 0) {
      setErrorMsg("Aggiungi almeno un elemento prima di concludere la vendita.");
      return;
    }
    // Mirror the backend's "Pagamento insufficiente" client-side.
    if (paymentInsufficient) {
      setErrorMsg("Pagamento insufficiente.");
      return;
    }
    // Residui require a real client (the backend rejects residui on a bench sale).
    if (residuiTotal > 0 && (!clientId || clientId <= 0)) {
      setErrorMsg("Seleziona un cliente per usare credito o GiftCard.");
      return;
    }
    // FIDELITY: block below the configured minimum or above the balance (the backend
    // re-validates + throws, this mirrors it for a clean client-side error).
    if (pointsBelowMin) {
      setErrorMsg(`Minimo punti utilizzabile: ${minPoints}.`);
      return;
    }
    if (pointsOverBalance) {
      setErrorMsg("Punti insufficienti.");
      return;
    }
    if (pointsUsed > 0 && (!clientId || clientId <= 0)) {
      setErrorMsg("Seleziona un cliente per usare i punti.");
      return;
    }

    // items_json / payments_json MUST be JSON strings: parseRequestBody() collapses
    // top-level arrays with join(","), so we stringify ourselves.
    const itemsJson = JSON.stringify(
      cart.map((line) => ({
        type: line.type,
        refId: line.refId,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        status: line.status,
      })),
    );
    // Faithful tenders: the residui (wallet credit + chosen giftcard) then the base
    // method for the remainder. Only non-zero tenders are sent; the backend re-validates
    // each residui against the real balances + consumes them, and persists the base
    // method. The giftcard tender carries its giftcardId so the backend knows which card.
    const tenders: Array<{ method: string; amount: number; giftcardId?: number }> = [];
    if (creditUse > 0) tenders.push({ method: "wallet", amount: creditUse });
    if (giftcardUse > 0 && giftcardId > 0) tenders.push({ method: "giftcard", amount: giftcardUse, giftcardId });
    if (baseAmount > 0 || tenders.length === 0) tenders.push({ method: apiPaymentMethod(baseMethod), amount: baseAmount });
    const paymentsJson = JSON.stringify(tenders.filter((tender) => tender.amount > 0));

    const body = {
      action: "checkout",
      slug,
      client_id: clientId ?? 0,
      client_name: clientId ? clientName : "",
      items_json: itemsJson,
      payments_json: paymentsJson,
      discount: manualDiscount,
      coupon_code: couponCode.trim(),
      // FIDELITY points to spend as a discount (the backend re-validates + consumes them).
      fidelity_points_use: pointsUsed,
      notes: notes.trim(),
    };

    setSubmitting(true);
    try {
      const res = await fetch(`/api/manage/pos?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false || json?.error) {
        setErrorMsg(String(json?.error || "Errore durante la conclusione della vendita."));
        return;
      }
      // Success: reset the sale state.
      const saleCode = json?.sale?.code ? ` (${json.sale.code})` : "";
      setCart([]);
      setDiscountType("none");
      setDiscountValue("0");
      clearCouponState();
      setCouponInput("");
      setCouponMsg(null);
      setCouponOpen(false);
      setBaseMethod("cash");
      setNotes("");
      clearClient();
      setSuccessMsg(`Vendita conclusa${saleCode}.`);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccessMsg(""), 6000);
    } catch {
      setErrorMsg("Errore di rete durante la conclusione della vendita.");
    } finally {
      setSubmitting(false);
    }
  }

  const today = "2026-06-29";

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/pos.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Cassa vendita</div>
          <h1 className="bs-page-title">Pagamenti</h1>
          <div className="bs-page-subtitle">Registra vendite, acconti, GiftCard, GiftBox e ricariche.</div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2 flex-wrap">
            <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/index.php?page=pos_settings`}>
              <i className="bi bi-gear me-1"></i>Impostazioni
            </a>
          </div>
        </div>
      </div>

      <form method="post" id="posForm" onSubmit={handleCheckout}>
        <input type="hidden" name="location_id" value={ctx?.activeLocationId ?? ""} />

        <div className="pos-grid">
          {/* COLONNA SINISTRA: CLIENTI */}
          <div className="pos-panel">
            <div className="pos-panel-head">
              <div className="d-flex align-items-center justify-content-between">
                <div className="fw-semibold">Clienti</div>
                <a
                  className="btn btn-sm btn-outline-primary"
                  href={`/${encodeURIComponent(slug)}/index.php?page=clients`}
                  title="Apri rubrica clienti"
                >
                  <i className="bi bi-people"></i>
                </a>
              </div>
            </div>

            <div className="p-2">
              <div className="input-group input-group-sm">
                <span className="input-group-text">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  className="form-control"
                  id="posClientSearch"
                  placeholder="Cerca Cliente..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="pos-client-list" id="posClientList">
              {filteredClients.map((c) => (
                <button
                  type="button"
                  className={`pos-client-row${clientId === c.id ? " active" : ""}`}
                  data-client-id={c.id}
                  data-client-name={c.name}
                  key={c.id}
                  onClick={() => selectClient(c.id, c.name)}
                >
                  <div className="fw-semibold">{c.name}</div>
                  <div className="small text-muted">{c.phone ? c.phone : `ID: ${c.id}`}</div>
                </button>
              ))}
            </div>
          </div>

          {/* COLONNA CENTRALE: CARRELLO + CATALOGO */}
          <div className="pos-panel">
            <div className="pos-panel-head">
              <div className="d-flex justify-content-between align-items-end">
                <div>
                  <div className="small text-muted">Cliente selezionato</div>
                  <div className="d-flex align-items-center gap-2">
                    <div className="fw-semibold" id="posClientLabel">
                      {clientName || "—"}
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm btn-link text-muted p-0${clientId ? "" : " d-none"}`}
                      id="posClientClearBtn"
                      title="Rimuovi cliente selezionato"
                      onClick={clearClient}
                    >
                      <i className="bi bi-x-circle"></i>
                    </button>
                  </div>
                </div>
                <div className="text-end">
                  <div className="small text-muted">Codice tessera</div>
                  <div className="fw-semibold" id="posCardCode">
                    —
                  </div>
                </div>
              </div>
            </div>

            <div className="pos-cart-table">
              <table className="table table-sm align-middle mb-0" id="itemsTable">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Elemento</th>
                    <th className="pos-col-qty">Q.tà</th>
                    <th className="pos-col-price">Prezzo</th>
                    <th className="pos-col-total">Totale</th>
                    <th className="pos-col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted">
                        Aggiungi almeno un elemento.
                      </td>
                    </tr>
                  ) : (
                    cart.map((line) => (
                      <tr data-item-row="1" data-type={line.type} data-id={line.refId} key={line.key}>
                        <td className="text-uppercase small">{line.type}</td>
                        <td>
                          <div className="fw-semibold pos-item-name">{line.name}</div>
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm pos-qty-input"
                            type="number"
                            min={1}
                            step={1}
                            value={line.quantity}
                            onChange={(e) => setQty(line.key, Number.parseInt(e.target.value, 10))}
                          />
                        </td>
                        <td className="text-end small">{fmtEUR(line.unitPrice)}</td>
                        <td className="text-end small line-total">{fmtEUR(line.unitPrice * line.quantity)}</td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeLine(line.key)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-top">
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <div className="input-group input-group-sm pos-catalog-search">
                  <span className="input-group-text">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    className="form-control"
                    id="posCatalogSearch"
                    placeholder="Cerca..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                </div>

                <select className="form-select form-select-sm pos-catalog-category" id="posCatalogCategory">
                  <option value="">Tutte le aree</option>
                </select>

                <div
                  className="ms-auto btn-group btn-group-sm pos-catalog-type-tabs"
                  role="group"
                  aria-label="Catalogo"
                >
                  <button
                    type="button"
                    className={`btn btn-outline-primary${catalogMode === "service" ? " active" : ""}`}
                    id="posCatalogBtnServices"
                    onClick={() => setCatalogMode("service")}
                  >
                    <i className="bi bi-scissors me-1"></i>Servizi
                  </button>
                  <button
                    type="button"
                    className={`btn btn-outline-primary${catalogMode === "product" ? " active" : ""}`}
                    id="posCatalogBtnProducts"
                    onClick={() => setCatalogMode("product")}
                  >
                    <i className="bi bi-bag me-1"></i>Prodotti
                  </button>
                </div>
              </div>

              <div className="pos-catalog-grid mt-3" id="posCatalogGrid">
                {tiles.length === 0 ? (
                  <div className="text-muted small">{loading ? "Caricamento…" : "Nessun risultato."}</div>
                ) : (
                  tiles.map((tile) => (
                    <button
                      type="button"
                      className="pos-tile"
                      data-id={tile.id}
                      data-type={catalogMode}
                      data-base-price={tile.price.toFixed(2)}
                      key={`${catalogMode}-${tile.id}`}
                      onClick={() => addTile(tile)}
                    >
                      <div className="pos-tile-name">{tile.name}</div>
                      <div className="pos-tile-meta">
                        <div className="small text-muted">
                          {catalogMode === "product" && tile.stock !== undefined ? `Stock: ${tile.stock}` : ""}
                        </div>
                        <div className="text-end">
                          <div className="pos-tile-price-row">
                            <span className="pos-tile-price-old d-none">{fmtEUR(tile.price)}</span>
                            <span className="pos-tile-price">{fmtEUR(tile.price)}</span>
                            <span className="badge bg-success pos-tile-promo-badge d-none">Promo</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="pos-bottom-bar mt-3">
                {/* Advanced line types — rendered faithfully, modals open but non-wired. */}
                <button
                  type="button"
                  className="btn btn-light pos-bottom-btn"
                  id="posBtnPackages"
                  data-bs-toggle="modal"
                  data-bs-target="#posModalPackages"
                >
                  <i className="bi bi-box-seam me-1"></i>Pacchetti
                </button>
                <button
                  type="button"
                  className="btn btn-light pos-bottom-btn"
                  id="posBtnRecharge"
                  data-bs-toggle="modal"
                  data-bs-target="#posModalRecharge"
                >
                  <i className="bi bi-arrow-repeat me-1"></i>Ricariche
                </button>
                <button
                  type="button"
                  className="btn btn-light pos-bottom-btn"
                  id="posBtnGiftbox"
                  data-bs-toggle="modal"
                  data-bs-target="#posModalGiftbox"
                >
                  <i className="bi bi-gift me-1"></i>GiftBox
                </button>
                <button
                  type="button"
                  className="btn btn-light pos-bottom-btn"
                  id="posBtnGiftcard"
                  data-bs-toggle="modal"
                  data-bs-target="#posModalGiftcard"
                >
                  <i className="bi bi-credit-card-2-front me-1"></i>GiftCard
                </button>
              </div>

              {/* Select nascosti: nell'originale li usa lo script addItem() */}
              <div className="d-none">
                <select className="form-select" id="serviceSelect" defaultValue="">
                  <option value="">Seleziona...</option>
                  {services.map((s) => (
                    <option value={s.id} data-price={parsePrice(s.price).toFixed(2)} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select className="form-select" id="productSelect" defaultValue="">
                  <option value="">Seleziona...</option>
                  {products.map((p) => (
                    <option value={p.id} data-price={parsePrice(p.price).toFixed(2)} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* COLONNA DESTRA: DETTAGLIO PREZZI / SCONTI / FIDELITY */}
          <div className="pos-panel">
            <div className="pos-panel-head">
              <div className="fw-semibold">Dettaglio prezzi</div>
            </div>

            <div className="p-3">
              {/* Select cliente reale (nascosto) */}
              <div className="d-none">
                <select className="form-select" name="client_id" id="posClient" value={clientId ?? ""} onChange={() => undefined}>
                  <option value="">Nessuno</option>
                  {clients.map((c) => (
                    <option value={c.id} data-email={c.email ?? ""} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span className="badge bg-light text-dark">
                  Fidelity: <span id="posClientAdhering">—</span>
                </span>
                <span className="badge bg-light text-dark">
                  Punti: <span id="posClientPoints">{clientId ? pointsBalance : 0}</span>
                </span>
              </div>
              <div className="small text-muted mb-3" id="posRedeemInfo">
                {!clientId
                  ? "Seleziona un cliente per vedere credito disponibili."
                  : residualsLoading
                    ? "Caricamento residui…"
                    : creditAvailable > 0 || (residuals?.giftcards.length ?? 0) > 0
                      ? `Residui disponibili: Credito ${fmtEUR(creditAvailable)}${(residuals?.giftcards.length ?? 0) > 0 ? `, ${residuals?.giftcards.length} GiftCard` : ""}.`
                      : "Nessun credito o GiftCard disponibile per il cliente."}
              </div>

              <label className="form-label small text-muted mb-1">Coupon</label>
              <div className="border rounded p-2 bg-light-subtle">
                <div className="small fw-semibold mb-1">
                  <i className="bi bi-megaphone me-1"></i>Promozioni / Coupon
                </div>
                <a
                  href="#"
                  className="text-success small text-decoration-underline"
                  id="couponToggle"
                  onClick={(e) => {
                    e.preventDefault();
                    setCouponOpen((v) => !v);
                  }}
                >
                  Hai un codice coupon?
                </a>
                <div className={`mt-2${couponOpen ? "" : " d-none"}`} id="couponBox">
                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      className="form-control"
                      name="coupon_code"
                      id="coupon_code"
                      placeholder="ES. WELCOME10"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void applyCoupon();
                        }
                      }}
                    />
                    <button
                      className="btn btn-outline-success"
                      type="button"
                      id="couponApplyBtn"
                      disabled={couponApplying}
                      onClick={() => void applyCoupon()}
                    >
                      Applica
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      id="couponRemoveBtn"
                      disabled={couponApplying}
                      onClick={removeCoupon}
                    >
                      Rimuovi
                    </button>
                  </div>
                  <div
                    className={`form-text${couponMsg ? (couponMsg.ok ? " text-success" : " text-danger") : ""}`}
                    id="couponHelp"
                  >
                    {couponMsg?.text ?? ""}
                  </div>
                </div>
              </div>

              <div className="row g-2 mb-2">
                <div className="col-5">
                  <label className="form-label small text-muted mb-1">Sconto</label>
                  <select
                    className="form-select form-select-sm"
                    name="discount_type"
                    id="discount_type"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as "none" | "percent" | "fixed")}
                  >
                    <option value="none">Nessuno</option>
                    <option value="percent">%</option>
                    <option value="fixed">€</option>
                  </select>
                </div>
                <div className="col-7">
                  <label className="form-label small text-muted mb-1">&nbsp;</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control form-control-sm"
                    name="discount_value"
                    id="discount_value"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </div>
              </div>

              {/* Fidelity / punti — WIRED: shown when the selected client has points and the
                  business has redemption enabled. The staff types points to use; the € discount
                  (punti x euroPerPoint) is clamped to min(balance, floor(payable / euroPerPoint))
                  and subtracted from the total. "Max" applies the most spendable. fidelity_points_use
                  is sent on checkout (the backend re-validates + consumes the points). */}
              <div id="posFidelityRedeemBox" className={fidelityEnabled ? "" : "d-none"}>
                <label className="form-label small text-muted mb-1">
                  Punti da usare (disp. <strong>{pointsBalance}</strong>)
                </label>
                <div className="input-group input-group-sm mb-1">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="form-control"
                    name="fidelity_points_use"
                    id="fidelity_points_use"
                    value={pointsUseInput}
                    onChange={(e) => setPointsUseInput(e.target.value)}
                  />
                  <button type="button" className="btn btn-outline-secondary" id="pointsMaxBtn" onClick={useMaxPoints}>
                    Max
                  </button>
                </div>
                <div
                  className={`small mb-2${pointsBelowMin || pointsOverBalance ? " text-danger" : " text-muted"}`}
                  id="fidelityHelp"
                >
                  {pointsOverBalance
                    ? "Punti insufficienti."
                    : pointsBelowMin
                      ? `Per usare i punti devi usarne almeno ${minPoints}.`
                      : pointsUsed > 0
                        ? `${pointsUsed} punti = sconto ${fmtEUR(fidelityDiscount)} (${fmtEUR(euroPerPoint)}/punto).`
                        : `1 punto = ${fmtEUR(euroPerPoint)}${minPoints > 0 ? `, minimo ${minPoints} punti.` : "."}`}
                </div>
              </div>

              {/* Residui (credito/giftcard) — WIRED: shown when the selected client has a
                  wallet credit balance and/or available GiftCards. The staff applies an
                  amount from credit and/or a chosen giftcard (clamped to min(balance,
                  remaining)); the applied amounts drive the price detail + the checkout
                  tenders. The hidden inputs mirror the legacy POST field names. */}
              <div
                className={`card p-2 mb-2${clientId && (creditAvailable > 0 || (residuals?.giftcards.length ?? 0) > 0) ? "" : " d-none"}`}
                id="posResidualsBox"
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div className="fw-semibold">Residui</div>
                </div>
                <div className="small mt-1 mb-2 text-muted" id="posResidualsSummary">
                  Usa Credito e/o GiftCard per coprire il totale.
                </div>

                {/* Credito */}
                {creditAvailable > 0 ? (
                  <div className="mb-2" id="posResidualCreditInline">
                    <label className="form-label small text-muted mb-1">
                      Credito (disp. <strong>{fmtEUR(creditAvailable)}</strong>)
                    </label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">€</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control text-end"
                        id="posResidualCreditAmount"
                        value={creditUseInput}
                        onChange={(e) => setCreditUseInput(e.target.value)}
                      />
                      <button type="button" className="btn btn-outline-secondary" id="posResidualCreditMaxBtn" onClick={useMaxCredit}>
                        Usa max
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* GiftCard */}
                {(residuals?.giftcards.length ?? 0) > 0 ? (
                  <div className="mb-1" id="posResidualGiftcardInline">
                    <label className="form-label small text-muted mb-1">GiftCard</label>
                    <select
                      className="form-select form-select-sm mb-1"
                      id="posResidualGiftcardSelect"
                      value={giftcardId}
                      onChange={(e) => chooseGiftcard(Number.parseInt(e.target.value, 10) || 0)}
                    >
                      <option value={0}>Nessuna</option>
                      {residuals?.giftcards.map((card) => (
                        <option value={card.id} key={card.id}>
                          {card.code || `GiftCard #${card.id}`} — {fmtEUR(card.balance)}
                        </option>
                      ))}
                    </select>
                    {selectedGiftcard ? (
                      <div className="input-group input-group-sm">
                        <span className="input-group-text">€</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control text-end"
                          id="posResidualGiftcardAmount"
                          value={giftcardUseInput}
                          onChange={(e) => setGiftcardUseInput(e.target.value)}
                        />
                        <button type="button" className="btn btn-outline-secondary" id="posResidualGiftcardMaxBtn" onClick={useMaxGiftcard}>
                          Usa max
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <input type="hidden" name="credit_use" id="pos_credit_use" value={creditUse} readOnly />
                <input type="hidden" name="giftcard_id" id="pos_giftcard_id" value={giftcardId} readOnly />
                <input type="hidden" name="giftcard_use" id="pos_giftcard_use" value={giftcardUse} readOnly />
              </div>

              <div className="card p-3" id="posPriceDetails">
                {/* BASE PAYMENT — the faithful single payment_type selector
                    (Contanti/Carta/Assegno/Bonifico) for the REMAINDER after residui.
                    base = total − credito − giftcard; the residui are applied in the
                    Residui panel above. The bar shows the residui applied + the base. */}
                <div className="mb-3 pos-payment-type-card" id="posPaymentTypeBox">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="small text-muted">Pagamento</div>
                  </div>

                  <div className="input-group input-group-sm mb-2" id="posPaymentBaseRow">
                    <select
                      className="form-select"
                      name="payment_type"
                      id="posPaymentType"
                      aria-label="Metodo di pagamento"
                      value={baseMethod}
                      onChange={(e) => setBaseMethod(e.target.value as PaymentMethod)}
                    >
                      <option value="cash">{PAYMENT_METHOD_LABELS.cash}</option>
                      <option value="card">{PAYMENT_METHOD_LABELS.card}</option>
                      <option value="check">{PAYMENT_METHOD_LABELS.check}</option>
                      <option value="bank">{PAYMENT_METHOD_LABELS.bank}</option>
                    </select>
                    <span className="input-group-text">€</span>
                    <input
                      className="form-control text-end"
                      id="posPaymentBaseAmount"
                      type="text"
                      readOnly
                      value={baseAmount.toFixed(2)}
                      aria-label="Importo a carico del metodo base"
                    />
                  </div>

                  {residuiTotal > 0 ? (
                    <div className="d-flex justify-content-between small text-muted" id="posPaymentResiduiRow">
                      <span>Residui applicati</span>
                      <span id="posPaymentResiduiVal">- {fmtEUR(residuiTotal)}</span>
                    </div>
                  ) : null}
                  <div className="d-flex justify-content-between small" id="posPaymentPaidRow">
                    <span className="text-muted">Pagato</span>
                    <span id="posPaymentPaidVal">{fmtEUR(paidTotal)}</span>
                  </div>
                  <div
                    className={`d-flex justify-content-between small${remainingToPay > 0 ? " text-danger fw-semibold" : " text-muted"}`}
                    id="posPaymentRemainingRow"
                  >
                    <span>Rimanente</span>
                    <span id="posPaymentRemainingVal">{fmtEUR(remainingToPay)}</span>
                  </div>

                  <div className="form-text mt-2" id="posPaymentTypeHelp">
                    {paymentInsufficient
                      ? "Pagamento insufficiente: i pagamenti devono coprire il totale."
                      : "Seleziona come paga il cliente il residuo dopo eventuali credito/GiftCard."}
                  </div>
                </div>

                {/* Rateizzazione — resa fedelmente, non collegata. */}
                <div className="mb-3 pos-installment-card" id="posInstallmentCard">
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                    <div className="small text-muted mb-0" id="posInstallmentHeadline">
                      Seleziona modalità di saldo
                    </div>
                    <span
                      className="badge rounded-pill d-none pos-installment-required-badge"
                      id="posInstallmentRequiredBadge"
                    >
                      Scelta obbligatoria
                    </span>
                  </div>
                  <div className="pos-installment-choice-grid">
                    <button type="button" className="btn pos-installment-choice-btn" id="posInstallmentSingleBtn">
                      Pagamento unico
                    </button>
                    <button
                      type="button"
                      className="btn pos-installment-choice-btn"
                      id="posInstallmentConfigureBtn"
                      data-bs-toggle="modal"
                      data-bs-target="#posInstallmentModal"
                    >
                      Rateizzato
                    </button>
                  </div>
                  <div className="form-text mt-2" id="posInstallmentHelp">
                    Seleziona esplicitamente se il cliente paga in unica soluzione oppure con un piano rate.
                  </div>

                  <div className="pos-installment-summary d-none" id="posInstallmentSummary">
                    <div className="small fw-semibold mb-1" id="posInstallmentSummaryText"></div>
                    <div className="small text-muted d-none mb-2" id="posInstallmentSummaryNote"></div>
                    <div className="table-responsive d-none" id="posInstallmentScheduleWrap">
                      <table className="table table-sm mb-2 pos-installment-schedule-table">
                        <thead>
                          <tr>
                            <th>Rata</th>
                            <th>Scadenza</th>
                            <th className="text-end">Importo</th>
                          </tr>
                        </thead>
                        <tbody id="posInstallmentScheduleBody"></tbody>
                      </table>
                    </div>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-outline-primary btn-sm" id="posInstallmentEditBtn">
                        Modifica
                      </button>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-between">
                  <span>Subtotale</span>
                  <strong id="posSubtotalVal">{fmtEUR(subtotal)}</strong>
                </div>

                <div
                  className={`d-flex justify-content-between text-muted small${codeDiscount > 0 ? "" : " d-none"}`}
                  id="posCodeDiscountRow"
                >
                  <span id="posCodeDiscountLabel">{couponCode ? `Coupon (${couponCode})` : "Coupon"}</span>
                  <span id="posCodeDiscountVal">- {fmtEUR(codeDiscount)}</span>
                </div>

                <div
                  className={`d-flex justify-content-between text-muted small${manualDiscount > 0 ? "" : " d-none"}`}
                  id="posManualDiscountRow"
                >
                  <span>Sconto</span>
                  <span id="posManualDiscountVal">- {fmtEUR(manualDiscount)}</span>
                </div>

                <div
                  className={`d-flex justify-content-between text-muted small${fidelityDiscount > 0 ? "" : " d-none"}`}
                  id="posFidelityRow"
                >
                  <span id="posFidelityLabel">Sconto Punti{pointsUsed > 0 ? ` (${pointsUsed} pt)` : ""}</span>
                  <span id="posFidelityVal">- {fmtEUR(fidelityDiscount)}</span>
                </div>

                <div className={`d-flex justify-content-between text-muted small${giftcardUse > 0 ? "" : " d-none"}`} id="posGiftcardRow">
                  <span>GiftCard{selectedGiftcard?.code ? ` (${selectedGiftcard.code})` : ""}</span>
                  <span id="posGiftcardVal">- {fmtEUR(giftcardUse)}</span>
                </div>

                <div className={`d-flex justify-content-between text-muted small${creditUse > 0 ? "" : " d-none"}`} id="posCreditRow">
                  <span>Credito</span>
                  <span id="posCreditVal">- {fmtEUR(creditUse)}</span>
                </div>

                <hr />

                <div className="d-flex justify-content-between">
                  <span>Totale</span>
                  <strong id="posTotalVal">{fmtEUR(total)}</strong>
                </div>
              </div>

              <label className="form-label small text-muted mb-1 mt-3">Note</label>
              <textarea
                className="form-control form-control-sm"
                name="notes"
                id="notes"
                rows={3}
                placeholder="Note interne..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>

              <button
                className="btn btn-success w-100 mt-3"
                type="submit"
                id="posConcludeBtn"
                disabled={submitting || paymentInsufficient || pointsBelowMin || pointsOverBalance || cart.length === 0}
              >
                <i className="bi bi-check2-circle me-1"></i>
                {submitting ? "Conclusione…" : "Concludi"}
              </button>
              <div className={`small text-danger mt-2${errorMsg ? "" : " d-none"}`} id="posConcludeHelp">
                {errorMsg}
              </div>
              {successMsg ? <div className="small text-success mt-2">{successMsg}</div> : null}
            </div>
          </div>
        </div>
      </form>

      {/* ===================== MODALI (resi fedelmente; avanzati non collegati) ===================== */}

      {/* MODAL: RESIDUI */}
      <div className="modal fade" id="posResidualsModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content pos-modal-full-height">
            <div className="modal-header align-items-start">
              <div className="d-flex align-items-start w-100">
                <div>
                  <div className="small-muted">Cliente</div>
                  <h5 className="modal-title fw-bold m-0">Residui</h5>
                </div>
                <div className="ms-auto d-flex flex-column align-items-end text-end">
                  <div className="small text-muted mt-1">Usa Credito e/o GiftCard disponibili per questa vendita.</div>
                </div>
              </div>
              <button type="button" className="btn-close ms-2" data-bs-dismiss="modal" aria-label="Chiudi"></button>
            </div>
            <div className="modal-body">
              <div className="small text-muted mb-3">
                Cliente: <strong id="posResidualsClientLabel">—</strong>
              </div>

              <div className="alert alert-light border small d-none" id="posResidualsEmptyState">
                Nessun residuo disponibile per il cliente selezionato.
              </div>

              <div className="card p-3 mb-3 d-none" id="posResidualCreditCard">
                <div className="fw-semibold mb-1">Credito</div>
                <div className="small text-muted mb-3">
                  Utilizza il credito disponibile del cliente per questa vendita.
                </div>

                <div className="form-check mb-2">
                  <input className="form-check-input" type="checkbox" id="posResidualCreditToggle" />
                  <label className="form-check-label" htmlFor="posResidualCreditToggle">
                    Disponibile: <strong id="posResidualCreditAvail">€ 0,00</strong>
                  </label>
                </div>

                <label className="form-label small text-muted mb-1">Importo da usare</label>
                <div className="input-group input-group-sm">
                  <input type="number" step="0.01" min="0" className="form-control" id="posResidualCreditAmount" defaultValue="0" />
                  <button type="button" className="btn btn-outline-secondary" id="posResidualCreditMaxBtn">
                    Usa max
                  </button>
                </div>
                <div className="form-text" id="posResidualCreditHint"></div>
              </div>

              <div className="card p-3 d-none" id="posResidualGiftcardCard">
                <div className="fw-semibold mb-1">GiftCard</div>
                <div className="small text-muted mb-3">Seleziona una GiftCard disponibile e scegli l'importo da usare.</div>

                <div id="posResidualGiftcardList" className="mb-3"></div>

                <div className="d-none" id="posResidualGiftcardControls">
                  <label className="form-label small text-muted mb-1">Importo da usare</label>
                  <div className="input-group input-group-sm">
                    <input type="number" step="0.01" min="0" className="form-control" id="posResidualGiftcardAmount" defaultValue="0" />
                    <button type="button" className="btn btn-outline-secondary" id="posResidualGiftcardMaxBtn">
                      Usa max
                    </button>
                  </div>
                  <div className="form-text" id="posResidualGiftcardHint"></div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                Chiudi
              </button>
              <button type="button" className="btn btn-primary" id="posResidualsApplyBtn">
                Applica
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: RATEIZZAZIONE */}
      <div className="modal fade" id="posInstallmentModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title mb-0">Configura rateizzazione</h5>
                <div className="small text-muted">Definisci acconto, numero rate e scadenze del piano cliente.</div>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi"></button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12 col-lg-7">
                  <div className="row g-2">
                    <div className="col-12 col-md-6">
                      <label className="form-label small text-muted mb-1">Cliente</label>
                      <input type="text" className="form-control" id="posInstallmentClientLabel" defaultValue="—" readOnly />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small text-muted mb-1">Totale vendita</label>
                      <input type="text" className="form-control" id="posInstallmentSaleTotal" defaultValue="€ 0,00" readOnly />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small text-muted mb-1">Tipo pagamento</label>
                      <input type="text" className="form-control" id="posInstallmentPaymentType" defaultValue="" readOnly />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small text-muted mb-1">Acconto iniziale</label>
                      <input type="number" step="0.01" min="0" className="form-control" id="posInstallmentDownPayment" defaultValue="0.00" />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small text-muted mb-1">Numero rate</label>
                      <input type="number" min="1" max="120" className="form-control" id="posInstallmentCount" defaultValue="3" />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small text-muted mb-1">Prima scadenza</label>
                      <input type="date" className="form-control" id="posInstallmentFirstDue" />
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label small text-muted mb-1">Ogni</label>
                      <input type="number" min="1" max="24" className="form-control" id="posInstallmentIntervalValue" defaultValue="1" />
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label small text-muted mb-1">Unità</label>
                      <select className="form-select" id="posInstallmentIntervalUnit" defaultValue="month">
                        <option value="month">Mesi</option>
                        <option value="week">Settimane</option>
                        <option value="day">Giorni</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label small text-muted mb-1">Note piano</label>
                      <textarea
                        className="form-control"
                        id="posInstallmentNotes"
                        rows={3}
                        placeholder="Es. acconto in cassa, accordi col cliente, note operative..."
                      ></textarea>
                    </div>
                  </div>
                  <div className="alert alert-danger small mt-3 d-none" id="posInstallmentModalError"></div>
                </div>
                <div className="col-12 col-lg-5">
                  <div className="pos-installment-preview-card">
                    <div className="fw-semibold mb-2">Anteprima piano</div>
                    <div className="d-flex justify-content-between small mb-1">
                      <span>Acconto oggi</span>
                      <strong id="posInstallmentPreviewDownPayment">€ 0,00</strong>
                    </div>
                    <div className="d-flex justify-content-between small mb-1">
                      <span>Residuo rateizzato</span>
                      <strong id="posInstallmentPreviewFinanced">€ 0,00</strong>
                    </div>
                    <div className="d-flex justify-content-between small mb-3">
                      <span>Ultima scadenza</span>
                      <strong id="posInstallmentPreviewLastDue">—</strong>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-sm mb-0 pos-installment-schedule-table">
                        <thead>
                          <tr>
                            <th>Rata</th>
                            <th>Scadenza</th>
                            <th className="text-end">Importo</th>
                          </tr>
                        </thead>
                        <tbody id="posInstallmentPreviewBody"></tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" id="posInstallmentSaveBtn">
                <i className="bi bi-check2-circle me-1"></i>Salva piano rate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: RICARICA */}
      <div className="modal fade" id="posModalRecharge" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <input type="hidden" id="posRechargeClientId" value="" readOnly />
            <div className="modal-header">
              <h5 className="modal-title">Ricarica credito</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi"></button>
            </div>

            <div className="modal-body">
              <div className="small text-muted mb-2">
                Cliente: <strong id="posRechargeClientLabel">—</strong>
              </div>

              <div className="alert alert-info small mb-3">
                Nessun <strong>modello di ricarica</strong> disponibile. Puoi comunque inserire importo e bonus
                manualmente, oppure crearne uno nella pagina <strong>Ricariche</strong>.
              </div>

              <label className="form-label">Modello</label>
              <select className="form-select" id="posRechargeTemplateSelect" defaultValue="">
                <option value="">Seleziona...</option>
              </select>
              <div className="form-text">
                Seleziona un modello <strong>(opzionale)</strong>: precompila importo e bonus (puoi modificare i valori).
              </div>

              <div className="row g-2 mt-2">
                <div className="col-6">
                  <label className="form-label">Importo ricarica (€)</label>
                  <input className="form-control" type="number" step="0.01" min="0.01" max="99999999.99" id="posRechargeAmount" />
                </div>
                <div className="col-6">
                  <label className="form-label">Bonus</label>
                  <div className="input-group">
                    <select className="form-select pos-recharge-bonus-kind" id="posRechargeBonusKind" defaultValue="none">
                      <option value="none">Nessuno</option>
                      <option value="percent">% su importo</option>
                      <option value="fixed">€ fisso</option>
                    </select>
                    <input className="form-control" type="number" step="0.01" min="0" max="99999999.99" id="posRechargeBonusValue" defaultValue="0" disabled />
                  </div>
                </div>
              </div>

              <div className="form-check mt-3" id="posRechargeEarnPointsWrap">
                <input className="form-check-input" type="checkbox" id="posRechargeEarnPoints" value="1" defaultChecked />
                <label className="form-check-label" htmlFor="posRechargeEarnPoints">
                  Calcola i punti anche sul bonus (importo + bonus)
                </label>
                <div className="form-text">
                  Se attivo, i Punti saranno calcolati su <strong>importo + bonus</strong>. Se disattivo, verranno
                  calcolati <strong>solo sull'importo ricarica</strong>.
                </div>
              </div>

              <label className="form-label mt-3">Note</label>
              <input className="form-control" type="text" id="posRechargeNote" placeholder="(opzionale)" />

              <div className="border rounded p-2 mt-3 bg-light">
                <div className="d-flex justify-content-between small">
                  <span>Ricarica</span>
                  <span id="posRechargePrevBase">€ 0,00</span>
                </div>
                <div className="d-flex justify-content-between small">
                  <span>Bonus</span>
                  <span id="posRechargePrevBonus">€ 0,00</span>
                </div>
                <div className="d-flex justify-content-between fw-semibold">
                  <span>Totale credito caricato</span>
                  <span id="posRechargePrevTotal">€ 0,00</span>
                </div>
                <div className="d-flex justify-content-between small text-muted">
                  <span>Punti accreditati</span>
                  <span id="posRechargePrevPoints">0,00</span>
                </div>
              </div>

              <div className="form-text mt-2" id="posRechargeClientHelp"></div>

              <div className="small text-muted mt-2">
                La ricarica verrà <strong>aggiunta al carrello</strong> e registrata quando premi <strong>Concludi</strong>.
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                Annulla
              </button>
              <button type="button" className="btn btn-primary" id="posRechargeAddBtn">
                Aggiungi alla lista
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: PACCHETTI */}
      <div className="modal fade" id="posModalPackages" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <input type="hidden" id="posPackageClientId" value="" readOnly />

            <div className="modal-header">
              <h5 className="modal-title">Vendi pacchetto</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi"></button>
            </div>

            <div className="modal-body">
              <div className="small text-muted mb-2">
                Cliente: <strong id="posPackageClientLabel">—</strong>
              </div>

              <div className="alert alert-warning py-2 px-3 d-none" id="posPackageNoClientWarn">
                Nessun cliente selezionato. Puoi aggiungere il pacchetto alla lista, ma per <strong>concludere</strong> la
                vendita dovrai selezionare un cliente.
              </div>

              <label className="form-label">Pacchetto</label>
              <select className="form-select" id="posPackageSelect" required defaultValue="">
                <option value="">Seleziona...</option>
              </select>

              <div className="row g-2 mt-3">
                <div className="col-md-6">
                  <label className="form-label">Valido dal</label>
                  <input className="form-control" type="date" id="posPackageStartDate" defaultValue={today} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Valido al</label>
                  <input className="form-control" type="date" id="posPackageExpiresAt" defaultValue="" />
                </div>
              </div>

              <div className="small text-muted mt-2" id="posPackageExpiryHint"></div>

              <div className="alert alert-info py-2 px-3 d-none" id="posPackageGiftboxModeInfo">
                <strong>GiftBox attiva:</strong> questo pacchetto verrà inserito come contenuto della GiftBox (non sarà
                assegnato al cliente).
              </div>

              <label className="form-label mt-3">Note</label>
              <input className="form-control" type="text" id="posPackageNote" placeholder="(opzionale)" />

              <div className="small text-muted mt-2">
                Nota: il pacchetto verrà aggiunto al carrello. Alla chiusura vendita (tasto <strong>Concludi</strong>)
                verrà:
                <ul className="mb-0">
                  <li>
                    <strong>in GiftBox</strong> se la GiftBox è attiva
                  </li>
                  <li>
                    <strong>assegnato al cliente</strong> se hai selezionato un cliente e la GiftBox non è attiva
                  </li>
                  <li className="text-muted">Per concludere la vendita il cliente deve essere selezionato.</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                Annulla
              </button>
              <button type="button" className="btn btn-primary" id="posPackageAddBtn">
                Aggiungi alla lista
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: GIFTBOX */}
      <div className="modal fade" id="posModalGiftbox" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <input type="hidden" id="posGiftboxClientId" value="" readOnly />
            <input type="hidden" id="posGiftboxItems" value="" readOnly />

            <div className="modal-header">
              <h5 className="modal-title">Emetti GiftBox</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi"></button>
            </div>

            <div className="modal-body">
              <div className="small text-muted mb-2">
                Mittente: <strong id="posGiftboxClientLabel">—</strong>
              </div>

              <div className="border rounded p-2">
                <div className="fw-semibold mb-1">Contenuto GiftBox</div>
                <div className="small text-muted mb-2">
                  Verranno inseriti i servizi/prodotti selezionati nel carrello e gli eventuali pacchetti aggiunti in
                  abbinamento alla GiftBox.
                </div>
                <div className="small text-muted">
                  Per inserire un servizio nella GiftBox impostalo come <strong>Prepagato</strong>; per un prodotto
                  impostalo come <strong>Ordinato</strong>.
                </div>
                <div className="mt-2 pos-scroll-180" id="posGiftboxCartSummary"></div>
              </div>

              <div className="alert alert-info py-2 px-3 mt-3 d-none" id="posGiftboxPackageDatesInfo"></div>
              <div className="alert alert-warning py-2 px-3 mt-2 d-none" id="posGiftboxPackageNoValidityWarn"></div>

              <div className="row g-2 mt-3">
                <div className="col-12">
                  <label className="form-label">Evento</label>
                  <select className="form-select" id="posGiftboxEventType" required defaultValue="giftbox">
                    <option value="giftbox">GiftBox (generica)</option>
                    <option value="compleanno">Compleanno</option>
                    <option value="anniversario">Anniversario</option>
                    <option value="san_valentino">San Valentino</option>
                    <option value="natale">Natale</option>
                    <option value="capodanno">Capodanno</option>
                    <option value="epifania">Epifania</option>
                    <option value="festa_donna">Festa della Donna</option>
                    <option value="pasqua">Pasqua</option>
                    <option value="pasquetta">Pasquetta</option>
                    <option value="festa_mamma">Festa della Mamma</option>
                    <option value="festa_papa">Festa del Papà</option>
                  </select>
                </div>
              </div>

              <div className="row g-2 mt-3">
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Valida dal</label>
                  <input className="form-control" type="date" id="posGiftboxValidFrom" min={today} required />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Valida al</label>
                  <input className="form-control" type="date" id="posGiftboxValidTo" />
                </div>
              </div>

              <div className="row g-2 mt-3">
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Destinatario</label>
                  <input className="form-control" type="text" id="posGiftboxRecipientName" placeholder="Nome" required />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Email destinatario</label>
                  <input className="form-control" type="email" id="posGiftboxRecipientEmail" placeholder="Email (opzionale)" />
                </div>
              </div>

              <div className="row g-2 mt-2">
                <div className="col-12">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="posGbRecipientExistingToggle" value="1" />
                    <label className="form-check-label" htmlFor="posGbRecipientExistingToggle">
                      Destinatario già cliente
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-2 d-none" id="posGbRecipientExistingBox">
                <div className="border rounded p-3 mb-2 d-none" id="posGbRecipientSelectedBox">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="fw-semibold" id="posGbRecipientSelectedName"></div>
                      <div className="text-muted small" id="posGbRecipientSelectedMeta"></div>
                    </div>
                    <button type="button" className="btn btn-sm btn-outline-danger" id="posGbRecipientRemoveBtn" title="Rimuovi destinatario">
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                  <div className="alert mt-2 mb-0 py-2 px-3 small d-none" id="posGbRecipientFidelityAlert"></div>
                </div>

                <div id="posGbRecipientSearchWrap">
                  <div className="input-group input-group-sm mb-2">
                    <span className="input-group-text">
                      <i className="bi bi-search"></i>
                    </span>
                    <input className="form-control" type="text" id="posGbRecipientClientSearch" placeholder="Cerca destinatario..." />
                  </div>

                  <div className="border rounded pos-scroll-160" id="posGbRecipientClientList">
                    {clients.map((c) => (
                      <button
                        type="button"
                        className="pos-client-row pos-client-row-compact"
                        data-client-id={c.id}
                        data-name={c.name}
                        data-email={c.email ?? ""}
                        data-phone={c.phone ?? ""}
                        key={c.id}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-semibold">{c.name}</div>
                            {c.phone ? <div className="small text-muted">{c.phone}</div> : null}
                          </div>
                          <div className="small text-muted">ID {c.id}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <input type="hidden" id="posGiftboxRecipientClientId" value="" readOnly />

              <div className="row g-2 mt-2">
                <div className="col-12">
                  <label className="form-label">Voucher (destinatario)</label>
                  <div className="form-check mt-1">
                    <input className="form-check-input" type="checkbox" id="posGiftboxVoucherHideAmount" value="1" />
                    <label className="form-check-label" htmlFor="posGiftboxVoucherHideAmount">
                      Nascondi importo nel voucher pubblico (QR)
                    </label>
                  </div>
                  <div className="form-text">
                    Se attivo, nel voucher pubblico aperto dal QR/link non verrà mostrato l'importo (prezzi listino).
                  </div>
                </div>
              </div>

              <label className="form-label mt-3">Messaggio di dedica</label>
              <textarea className="form-control" id="posGiftboxMessage" rows={3} placeholder="(opzionale)"></textarea>

              <label className="form-label mt-3">Nota per il cliente</label>
              <textarea className="form-control" id="posGiftboxNote" rows={2} placeholder="(opzionale)"></textarea>

              <label className="form-label mt-3">Nota interna</label>
              <textarea className="form-control" id="posGiftboxInternalNote" rows={2} placeholder="(opzionale)"></textarea>

              <div className="mt-3">
                <div className="fw-semibold mb-1">Invio email</div>

                <div className="form-check mb-2">
                  <input className="form-check-input" type="checkbox" id="posGbDoNotSend" value="1" />
                  <label className="form-check-label" htmlFor="posGbDoNotSend">
                    Non inviare
                  </label>
                </div>

                <div className="form-check">
                  <input className="form-check-input" type="radio" name="giftbox_send_mode_ui" id="posGbSendNow" value="now" defaultChecked />
                  <label className="form-check-label" htmlFor="posGbSendNow">
                    Invia subito alla conclusione della vendita
                  </label>
                </div>

                <div className="form-check mt-2">
                  <input className="form-check-input" type="radio" name="giftbox_send_mode_ui" id="posGbSendDate" value="date" />
                  <label className="form-check-label" htmlFor="posGbSendDate">
                    Invia in data programmata
                  </label>
                </div>

                <div className="mt-2 d-none" id="posGbSendOnBox">
                  <label className="form-label">Data invio</label>
                  <input className="form-control" type="date" id="posGbSendOn" min={today} />
                </div>

                <div className="form-check mt-3">
                  <input className="form-check-input" type="checkbox" id="posGbShowDetails" value="1" defaultChecked />
                  <label className="form-check-label" htmlFor="posGbShowDetails">
                    Mostra importo e contenuto nella mail
                  </label>
                </div>
                <div className="text-muted small">
                  Se disattivato, nella mail non verrà mostrato il contenuto: il destinatario dovrà recarsi in negozio
                  per scoprirlo.
                </div>
              </div>

              <div className="alert alert-info py-2 px-3 mt-3 d-none" id="posGiftboxTotalsHint"></div>
            </div>

            <div className="modal-footer">
              <a href="#" className="link-danger me-auto d-none" id="posGiftboxDeleteLink">
                Elimina
              </a>
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal" id="posGiftboxCancelBtn">
                Annulla
              </button>
              <button type="button" className="btn btn-primary" id="posGiftboxSaveBtn">
                <i className="bi bi-check2-circle me-1"></i>Salva
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: GIFTCARD */}
      <div className="modal fade" id="posModalGiftcard" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <input type="hidden" id="posGiftcardClientId" value="" readOnly />

            <div className="modal-header">
              <h5 className="modal-title">Emetti GiftCard</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi"></button>
            </div>

            <div className="modal-body">
              <div className="small text-muted mb-2">
                Mittente: <strong id="posGiftcardClientLabel">—</strong>
              </div>

              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label">Importo (€)</label>
                  <input className="form-control" type="number" step="0.01" min="0" id="posGcAmount" placeholder="Es. 20" required />
                </div>
              </div>

              <div className="row g-2 mt-3">
                <div className="col-12">
                  <label className="form-label">Evento</label>
                  <select className="form-select" id="posGcEventType" required defaultValue="giftcard">
                    <option value="giftcard">GiftCard (generica)</option>
                    <option value="compleanno">Compleanno</option>
                    <option value="anniversario">Anniversario</option>
                    <option value="capodanno">Capodanno</option>
                    <option value="natale">Natale</option>
                    <option value="epifania">Epifania</option>
                    <option value="san_valentino">San Valentino</option>
                    <option value="festa_donna">Festa della Donna</option>
                    <option value="pasqua">Pasqua</option>
                    <option value="pasquetta">Pasquetta</option>
                    <option value="festa_mamma">Festa della Mamma</option>
                    <option value="festa_papa">Festa del Papà</option>
                  </select>
                </div>
              </div>

              <div className="row g-2 mt-3">
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Valida dal</label>
                  <input className="form-control" type="date" id="posGcValidFrom" min={today} required />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Valida al</label>
                  <input className="form-control" type="date" id="posGcExpiresAt" />
                </div>
              </div>

              <div className="row g-2 mt-3">
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Destinatario</label>
                  <input className="form-control" type="text" id="posGcRecipientName" placeholder="Nome" required />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Email destinatario</label>
                  <input className="form-control" type="email" id="posGcRecipientEmail" placeholder="Email (opzionale)" />
                </div>
              </div>

              <div className="row g-2 mt-2">
                <div className="col-12">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="posGcRecipientExistingToggle" value="1" />
                    <label className="form-check-label" htmlFor="posGcRecipientExistingToggle">
                      Destinatario già cliente
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-2 d-none" id="posGcRecipientExistingBox">
                <div className="border rounded p-3 mb-2 d-none" id="posGcRecipientSelectedBox">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="fw-semibold" id="posGcRecipientSelectedName"></div>
                      <div className="text-muted small" id="posGcRecipientSelectedMeta"></div>
                    </div>
                    <button type="button" className="btn btn-sm btn-outline-danger" id="posGcRecipientRemoveBtn" title="Rimuovi destinatario">
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                  <div className="alert mt-2 mb-0 py-2 px-3 small d-none" id="posGcRecipientFidelityAlert"></div>
                </div>

                <div id="posGcRecipientSearchWrap">
                  <div className="input-group input-group-sm mb-2">
                    <span className="input-group-text">
                      <i className="bi bi-search"></i>
                    </span>
                    <input className="form-control" type="text" id="posGcRecipientClientSearch" placeholder="Cerca destinatario..." />
                  </div>

                  <div className="border rounded pos-scroll-160" id="posGcRecipientClientList">
                    {clients.map((c) => (
                      <button
                        type="button"
                        className="pos-client-row pos-client-row-compact"
                        data-client-id={c.id}
                        data-name={c.name}
                        data-email={c.email ?? ""}
                        data-phone={c.phone ?? ""}
                        key={c.id}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-semibold">{c.name}</div>
                            {c.phone ? <div className="small text-muted">{c.phone}</div> : null}
                          </div>
                          <div className="small text-muted">ID {c.id}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <input type="hidden" id="posGiftcardRecipientClientId" value="" readOnly />

              <div className="row g-2 mt-2">
                <div className="col-12">
                  <label className="form-label">Voucher (destinatario)</label>
                  <div className="form-check mt-1">
                    <input className="form-check-input" type="checkbox" id="posGcVoucherHideAmount" value="1" />
                    <label className="form-check-label" htmlFor="posGcVoucherHideAmount">
                      Nascondi importo nel voucher pubblico (QR)
                    </label>
                  </div>
                  <div className="form-text">
                    Se attivo, nel voucher pubblico aperto dal QR/link non verrà mostrato importo e saldo.
                  </div>
                </div>
              </div>

              <label className="form-label mt-3">Messaggio di dedica</label>
              <textarea className="form-control" id="posGcMessage" rows={3} placeholder="(opzionale)"></textarea>

              <label className="form-label mt-3">Nota per il cliente</label>
              <textarea className="form-control" id="posGcNote" rows={2} placeholder="(opzionale)"></textarea>

              <label className="form-label mt-3">Nota interna</label>
              <textarea className="form-control" id="posGcInternalNote" rows={2} placeholder="(opzionale)"></textarea>

              <div className="mt-3">
                <div className="fw-semibold mb-1">Invio email</div>

                <div className="form-check mb-2">
                  <input className="form-check-input" type="checkbox" id="posGcDoNotSend" value="1" />
                  <label className="form-check-label" htmlFor="posGcDoNotSend">
                    Non inviare
                  </label>
                </div>

                <div className="form-check">
                  <input className="form-check-input" type="radio" name="giftcard_send_mode" id="posGcSendNow" value="now" defaultChecked required />
                  <label className="form-check-label" htmlFor="posGcSendNow">
                    Invia subito alla conclusione della vendita
                  </label>
                </div>

                <div className="form-check mt-2">
                  <input className="form-check-input" type="radio" name="giftcard_send_mode" id="posGcSendDate" value="date" required />
                  <label className="form-check-label" htmlFor="posGcSendDate">
                    Invia in data programmata
                  </label>
                </div>

                <div className="mt-2 d-none" id="posGcSendOnBox">
                  <label className="form-label">Data invio</label>
                  <input className="form-control" type="date" id="posGcSendOn" />
                </div>

                <div className="form-check mt-3">
                  <input className="form-check-input" type="checkbox" id="posGcShowAmount" value="1" defaultChecked />
                  <label className="form-check-label" htmlFor="posGcShowAmount">
                    Mostra importo e contenuto nella mail
                  </label>
                </div>
                <div className="text-muted small">
                  Se disattivato, nella mail non verrà mostrato l'importo (né i dettagli): il destinatario dovrà recarsi
                  in negozio per scoprirli.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                Annulla
              </button>
              <button type="button" className="btn btn-primary" id="posGiftcardCreateBtn">
                Aggiungi alla lista
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
