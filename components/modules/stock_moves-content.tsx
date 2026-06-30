"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Pixel-faithful port of the PHP stock_moves page (app/pages/stock_moves.php),
// fed by the existing DB-backed /api/manage/products context (which bundles
// categories, suppliers, products and stockDocuments for a location).

type Category = { id: number; name: string };
type Supplier = { id: number; name: string };
type ProductLite = { id: number; name: string; sku?: string };
type LocationLite = { id: number; name: string; isActive?: boolean };

type StockItem = {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  qty: number;
};

type StockDocument = {
  id: number;
  moveDate: string;
  cause: "carico" | "scarico";
  operatorName: string;
  documentType: string;
  documentNumber: string;
  documentDate: string;
  notes: string;
  locationId: number | null;
  isCanceled: boolean;
  items: StockItem[];
};

type ProductsContext = {
  activeLocationId?: number;
  categories?: Array<{ id: number; name: string }>;
  suppliers?: Array<{ id: number; name: string }>;
  products?: Array<{ id: number; name: string; sku?: string; supplierName?: string; categoryId?: number | null }>;
  locations?: LocationLite[];
  stockDocuments?: StockDocument[];
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = String(iso).slice(0, 10);
  const [y, m, day] = d.split("-");
  return day && m && y ? `${day}/${m}/${y}` : "—";
}

// Searchable combobox matching the PHP .app-combobox markup. The original
// page CSS + bootstrap dropdown styling apply unchanged.
function Combobox({
  boxClass,
  hiddenName,
  hiddenClass,
  options,
  value,
  onChange,
  placeholder,
}: {
  boxClass: string;
  hiddenName: string;
  hiddenClass: string;
  options: Array<{ id: number; label: string }>;
  value: number;
  onChange: (id: number) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const selected = options.find((o) => o.id === value && o.id !== 0);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <div className={`dropdown app-combobox ${boxClass}${open ? " show" : ""}`} ref={ref}>
      <button
        className={`form-control text-start app-combobox-toggle dropdown-toggle${open ? " show" : ""}`}
        type="button"
        aria-expanded={open ? "true" : "false"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="app-combobox-text">{selected ? selected.label : ""}</span>
        {selected ? null : <span className="app-combobox-placeholder text-muted">{placeholder}</span>}
      </button>
      <input type="hidden" name={hiddenName} className={hiddenClass} value={value} readOnly />
      <div className={`dropdown-menu p-2 w-100 app-combobox-menu${open ? " show" : ""}`}>
        <input
          type="text"
          className="form-control form-control-sm app-combobox-search"
          placeholder="Cerca…"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="list-group mt-2 app-combobox-list">
          {filtered.map((o) => (
            <button
              type="button"
              key={o.id}
              className={`list-group-item list-group-item-action${o.id === value ? " active" : ""}`}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
                setSearch("");
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StockMovesContent() {
  const slug = tenantSlug();
  const [ctx, setCtx] = useState<ProductsContext | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter form state
  const [productId, setProductId] = useState(0);
  const [categoryId, setCategoryId] = useState(0);
  const [supplier, setSupplier] = useState(0);
  const [sku, setSku] = useState("");
  const [internalCode, setInternalCode] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [date, setDate] = useState("");
  const [includeCanceled, setIncludeCanceled] = useState(false);

  // Applied filters (set on submit) — keeps the filter form working via state.
  const [applied, setApplied] = useState({
    productId: 0,
    categoryId: 0,
    supplier: 0,
    sku: "",
    internalCode: "",
    documentNumber: "",
    date: "",
    includeCanceled: false,
  });

  const load = useCallback(
    (locationId?: number) => {
      setLoading(true);
      const params = new URLSearchParams({ slug });
      if (locationId) params.set("location_id", String(locationId));
      fetch(`/api/manage/products?${params.toString()}`, { headers: { "x-tenant-slug": slug } })
        .then((r) => r.json())
        .then((j: ProductsContext) => setCtx(j))
        .catch(() => setCtx(null))
        .finally(() => setLoading(false));
    },
    [slug],
  );

  useEffect(() => {
    load();
  }, [load]);

  const activeLocationId = ctx?.activeLocationId ?? 0;
  const categories: Category[] = useMemo(
    () => (ctx?.categories ?? []).map((c) => ({ id: Number(c.id), name: String(c.name ?? "") })),
    [ctx],
  );
  const suppliers: Supplier[] = useMemo(
    () => (ctx?.suppliers ?? []).map((s) => ({ id: Number(s.id), name: String(s.name ?? "") })),
    [ctx],
  );
  const products: ProductLite[] = useMemo(
    () => (ctx?.products ?? []).map((p) => ({ id: Number(p.id), name: String(p.name ?? ""), sku: p.sku ? String(p.sku) : "" })),
    [ctx],
  );

  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, label: p.sku ? `${p.name} (${p.sku})` : p.name })),
    [products],
  );
  const supplierOptions = useMemo(() => suppliers.map((s) => ({ id: s.id, label: s.name })), [suppliers]);

  const docs: StockDocument[] = useMemo(() => ctx?.stockDocuments ?? [], [ctx]);

  // Client-side filtering driven by the applied filter state.
  const filteredDocs = useMemo(() => {
    return docs.filter((d) => {
      if (!applied.includeCanceled && d.isCanceled) return false;
      if (applied.productId && !d.items.some((it) => it.productId === applied.productId)) return false;
      if (applied.sku.trim()) {
        const needle = applied.sku.trim().toLowerCase();
        if (!d.items.some((it) => (it.productSku ?? "").toLowerCase().includes(needle))) return false;
      }
      if (applied.documentNumber.trim()) {
        if (!(d.documentNumber ?? "").toLowerCase().includes(applied.documentNumber.trim().toLowerCase())) return false;
      }
      if (applied.date) {
        if (String(d.moveDate ?? "").slice(0, 10) !== applied.date) return false;
      }
      return true;
    });
  }, [docs, applied]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApplied({ productId, categoryId, supplier, sku, internalCode, documentNumber, date, includeCanceled });
  }

  function href(suffix: string): string {
    return `/${encodeURIComponent(slug)}/${`stock_moves${suffix}`.replace("&", "?")}`;
  }

  const locParam = activeLocationId ? `&location_id=${activeLocationId}` : "";

  return (
    <main className="app-content">
      <div className="container-fluid">
        <div className="bs-page-header">
          <div className="bs-page-heading">
            <div className="bs-page-kicker">Magazzino</div>
            <h1 className="bs-page-title">Carico / Scarico</h1>
            <div className="bs-page-subtitle">Registra movimenti di magazzino e rettifiche prodotto.</div>
          </div>
          <div className="bs-page-actions">
            <div className="d-flex gap-2">
              <a className="btn btn-outline-secondary" href={`/${encodeURIComponent(slug)}/products`}>
                Torna al magazzino
              </a>
              <a className="btn btn-primary" href={href(`&action=new${locParam}`)}>
                Nuovo carico / scarico
              </a>
            </div>
          </div>
        </div>

        <div className="card p-3 mb-3">
          <form method="get" className="row g-2 align-items-end" onSubmit={onSubmit}>
            <input type="hidden" name="page" value="stock_moves" />
            {activeLocationId ? <input type="hidden" name="location_id" value={activeLocationId} readOnly /> : null}

            <div className="col-md-4">
              <label className="form-label">Prodotto</label>
              <Combobox
                boxClass="js-filter-product-box"
                hiddenName="product_id"
                hiddenClass="js-filter-product"
                options={productOptions}
                value={productId}
                onChange={setProductId}
                placeholder="Tutti"
              />
            </div>

            <div className="col-md-3">
              <label className="form-label">Categoria</label>
              <select
                className="form-select"
                name="category_id"
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
              >
                <option value="0">Tutte</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">Fornitore</label>
              <Combobox
                boxClass="js-filter-supplier-box"
                hiddenName="supplier"
                hiddenClass="js-filter-supplier"
                options={supplierOptions}
                value={supplier}
                onChange={setSupplier}
                placeholder="Tutti"
              />
            </div>

            <div className="col-md-2">
              <label className="form-label">Codice prodotto</label>
              <input
                className="form-control"
                name="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Cerca codice prodotto"
              />
            </div>

            <div className="col-md-2">
              <label className="form-label">Codice interno</label>
              <input
                className="form-control"
                name="internal_code"
                value={internalCode}
                onChange={(e) => setInternalCode(e.target.value)}
                placeholder="Cerca codice interno"
              />
            </div>

            <div className="col-md-2">
              <label className="form-label">N. documento</label>
              <input
                className="form-control"
                name="document_number"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Es. 123/2025"
              />
            </div>

            <div className="col-md-2">
              <label className="form-label">Data</label>
              <input
                className="form-control"
                type="date"
                name="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="col-md-2 d-flex align-items-center justify-content-start">
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="include_canceled"
                  value="1"
                  id="includeCanceled"
                  checked={includeCanceled}
                  onChange={(e) => setIncludeCanceled(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="includeCanceled">
                  Mostra annullati
                </label>
              </div>
            </div>

            <div className="col-md-3 d-flex gap-2 app-filter-actions">
              <button className="btn btn-outline-primary flex-grow-1 app-filter-submit" type="submit">
                <i className="bi bi-search me-1" />
                Filtra
              </button>
              <a className="btn btn-outline-secondary app-filter-reset" href={href("")}>
                Reset
              </a>
            </div>

            <div className="col-12 d-flex justify-content-end">
              <a className="btn btn-outline-secondary" href={href(`${locParam}&action=export`)}>
                <i className="bi bi-download" /> Esporta CSV
              </a>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Causale</th>
                  <th>Documento</th>
                  <th>Operatore</th>
                  <th>Categorie</th>
                  <th>Fornitori</th>
                  <th>Prodotti</th>
                  <th>Totale q.tà</th>
                  <th>Stato</th>
                  <th className="text-end">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-muted p-3">
                      {loading ? "Caricamento…" : "Nessun movimento."}
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((d) => {
                    const totalQty = d.items.reduce((acc, it) => acc + Number(it.qty || 0), 0);
                    const prodNames = d.items.map((it) => it.productName).filter(Boolean);
                    return (
                      <tr key={d.id} className={d.isCanceled ? "text-muted" : undefined}>
                        <td>{fmtDate(d.moveDate)}</td>
                        <td>{d.cause === "carico" ? "Carico" : "Scarico"}</td>
                        <td>{d.documentNumber || "—"}</td>
                        <td>{d.operatorName || "—"}</td>
                        <td className="text-muted small">—</td>
                        <td className="text-muted small">—</td>
                        <td className="text-muted small">{prodNames.length ? prodNames.join(", ") : "—"}</td>
                        <td>{totalQty}</td>
                        <td>
                          {d.isCanceled ? (
                            <span className="badge bg-light text-dark">Annullato</span>
                          ) : (
                            <span className="badge bg-success-subtle text-success">Attivo</span>
                          )}
                        </td>
                        <td className="text-end">
                          <a className="btn btn-sm btn-outline-secondary" href={href(`&action=view&id=${d.id}`)}>
                            Apri
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
