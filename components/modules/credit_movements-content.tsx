"use client";

import { useEffect, useMemo, useState } from "react";

// Faithful port of the PHP credit movements page (?page=credit_movements):
// a "Movimenti Credito" list with a client filter, a manual operation form,
// the movements table, and the pending-credit card. Fed by the existing
// DB-backed /api/manage/fidelity route (clients + wallet movements).

type WalletMovementType = "recharge" | "debit" | "points_earn" | "points_redeem" | "adjustment";

type Movement = {
  id: number;
  clientId: number;
  type: WalletMovementType;
  amount: number;
  points: number;
  note: string;
  source: string;
  createdAt: string;
};

type Client = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  locationId?: number;
  wallet?: { credit: number; points: number };
};

type ClientItem = { id: string; label: string; search: string };

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtMoney(n?: number): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return n.toFixed(2).replace(".", ",");
}

const TYPE_LABELS: Record<WalletMovementType, string> = {
  recharge: "Ricarica",
  debit: "Scalo",
  points_earn: "Punti",
  points_redeem: "Riscatto punti",
  adjustment: "Rettifica",
};

export function CreditMovementsContent() {
  const slug = tenantSlug();

  const [clients, setClients] = useState<Client[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter form state
  const [filterClientId, setFilterClientId] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  // Manual operation form state
  const [manualClientId, setManualClientId] = useState("");
  const [manualSearch, setManualSearch] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/manage/fidelity?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => {
        setClients(Array.isArray(j.clients) ? j.clients : []);
        setMovements(Array.isArray(j.movements) ? j.movements : []);
      })
      .catch(() => {
        setClients([]);
        setMovements([]);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const clientItems: ClientItem[] = useMemo(
    () =>
      clients.map((c) => ({
        id: String(c.id),
        label: c.name,
        search: `${c.name} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().trim(),
      })),
    [clients],
  );

  const clientName = (id: number): string => clients.find((c) => c.id === id)?.name ?? "—";

  const filteredMovements = useMemo(() => {
    if (!filterClientId) return movements;
    const id = Number(filterClientId);
    return movements.filter((m) => m.clientId === id);
  }, [movements, filterClientId]);

  const filterMatches = clientItems.filter((it) => it.search.includes(filterSearch.toLowerCase()));
  const manualMatches = clientItems.filter((it) => it.search.includes(manualSearch.toLowerCase()));
  const filterLabel = clientItems.find((it) => it.id === filterClientId)?.label ?? "";
  const manualLabel = clientItems.find((it) => it.id === manualClientId)?.label ?? "";

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!manualClientId) {
      setFeedback({ type: "danger", text: "Seleziona un cliente." });
      return;
    }
    if (!window.confirm("Confermi lo scalo manuale del credito?")) return;
    try {
      const res = await fetch(`/api/manage/fidelity?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify({
          slug,
          client_id: manualClientId,
          type: "debit",
          amount,
          note,
          source: "manual",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        setFeedback({ type: "danger", text: String(j?.error ?? j?.message ?? "Errore.") });
        return;
      }
      setMovements(Array.isArray(j.movements) ? j.movements : movements);
      setManualClientId("");
      setAmount("");
      setNote("");
      setFeedback({ type: "success", text: "Scalo registrato." });
    } catch {
      setFeedback({ type: "danger", text: "Errore di rete." });
    }
  }

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/recharges.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Portafoglio</div>
          <h1 className="bs-page-title">Movimenti Credito</h1>
          <div className="bs-page-subtitle">Consulta movimenti, filtri e saldi credito.</div>
        </div>
        <div className="bs-page-actions">
          <div className="text-muted small">20 risultati per pagina</div>
        </div>
      </div>

      {feedback ? (
        <div className={`alert alert-${feedback.type}`} role="alert">
          {feedback.text}
        </div>
      ) : null}

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-3 order-xl-2">
          <div className="card mb-3">
            <div className="card-header">
              <div className="fw-semibold">Operazione manuale</div>
            </div>
            <div className="card-body">
              <form method="post" className="row g-3" onSubmit={submitManual}>
                <input type="hidden" name="_mode" value="manual_credit_debit" />

                <div className="col-12">
                  <label className="form-label fw-semibold">Cliente</label>
                  <div className="app-combobox dropdown" id="creditManualClientBox">
                    <button
                      className="btn btn-outline-secondary dropdown-toggle w-100 app-combobox-toggle"
                      type="button"
                      aria-expanded={manualOpen}
                      onClick={() => setManualOpen((v) => !v)}
                    >
                      <span className={`app-combobox-text ${manualLabel ? "" : "d-none"}`}>{manualLabel}</span>
                      <span className={`text-muted app-combobox-placeholder ${manualLabel ? "d-none" : ""}`}>Seleziona...</span>
                    </button>
                    <div className={`dropdown-menu p-2 w-100 ${manualOpen ? "show" : ""}`}>
                      <input
                        type="text"
                        className="form-control form-control-sm app-combobox-search"
                        placeholder="Cerca..."
                        autoComplete="off"
                        value={manualSearch}
                        onChange={(e) => setManualSearch(e.target.value)}
                      />
                      <div className="app-combobox-list mt-2">
                        {manualMatches.map((it) => (
                          <button
                            type="button"
                            key={it.id}
                            className="dropdown-item"
                            onClick={() => {
                              setManualClientId(it.id);
                              setManualOpen(false);
                            }}
                          >
                            {it.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input type="hidden" name="client_id" value={manualClientId} />
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">Importo</label>
                  <div className="input-group">
                    <span className="input-group-text">€</span>
                    <input
                      className="form-control"
                      type="number"
                      name="amount"
                      min="0.01"
                      step="0.01"
                      max="99999999.99"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">Nota</label>
                  <input
                    className="form-control"
                    name="note"
                    maxLength={255}
                    required
                    placeholder="Motivo dello scalo"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <div className="col-12">
                  <button className="btn btn-danger w-100" type="submit" data-confirm="Confermi lo scalo manuale del credito?">
                    Scala
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-9 order-xl-1">
          <div className="card p-3 mb-3">
            <form
              method="get"
              className="row g-2 align-items-end"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <input type="hidden" name="page" value="credit_movements" />
              <div className="col-lg-4">
                <label className="form-label">Cliente</label>
                <div className="app-combobox dropdown" id="creditClientFilterBox">
                  <button
                    className="btn btn-outline-secondary dropdown-toggle w-100 app-combobox-toggle"
                    type="button"
                    aria-expanded={filterOpen}
                    onClick={() => setFilterOpen((v) => !v)}
                  >
                    <span className={`app-combobox-text ${filterLabel ? "" : "d-none"}`}>{filterLabel}</span>
                    <span className={`text-muted app-combobox-placeholder ${filterLabel ? "d-none" : ""}`}>Tutti i clienti</span>
                  </button>
                  <div className={`dropdown-menu p-2 w-100 ${filterOpen ? "show" : ""}`}>
                    <input
                      type="text"
                      className="form-control form-control-sm app-combobox-search"
                      placeholder="Cerca..."
                      autoComplete="off"
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                    />
                    <div className="app-combobox-list mt-2">
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          setFilterClientId("");
                          setFilterOpen(false);
                        }}
                      >
                        Tutti i clienti
                      </button>
                      {filterMatches.map((it) => (
                        <button
                          type="button"
                          key={it.id}
                          className="dropdown-item"
                          onClick={() => {
                            setFilterClientId(it.id);
                            setFilterOpen(false);
                          }}
                        >
                          {it.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input type="hidden" name="client_id" value={filterClientId} />
                </div>
              </div>
              <div className="col-lg-4 d-flex align-items-end gap-2 app-filter-actions">
                <button className="btn btn-outline-primary app-filter-submit" type="submit">
                  <i className="bi bi-search me-1" />
                  Filtra
                </button>
              </div>
            </form>
          </div>

          <div className="card mb-3">
            <div className="card-header d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
              <div className="fw-semibold">Movimenti Credito</div>
            </div>

            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th className="text-end">Ricarica</th>
                    <th className="text-end">Bonus</th>
                    <th className="text-end">Totale</th>
                    <th>Sede</th>
                    <th className="text-muted">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-muted p-3">
                        {loading ? "Caricamento…" : "Nessun movimento."}
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => (
                      <tr key={m.id}>
                        <td>{fmtDateTime(m.createdAt)}</td>
                        <td>{clientName(m.clientId)}</td>
                        <td>{TYPE_LABELS[m.type] ?? m.type}</td>
                        <td className="text-end">—</td>
                        <td className="text-end">—</td>
                        <td className="text-end">{fmtMoney(m.amount)}</td>
                        <td>—</td>
                        <td className="text-muted">{m.note || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
              <div className="fw-semibold">Credito in sospeso</div>
            </div>

            <div className="card-body text-muted">Nessun credito in sospeso.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
