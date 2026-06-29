"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Faithful port of the PHP fidelity wallet page (app/pages/fidelity_wallet.php),
// reached at ?page=fidelity_wallet. Fed by the existing DB-backed
// /api/manage/fidelity route. Original Bootstrap markup is preserved verbatim;
// the JS-driven `app-combobox` is reproduced as static markup and the data
// (client list + per-client points) is populated from the API.
//
// The PHP page links only the global app.css (no per-page CSS), so we do not
// inject a <link> here even though /assets/css/pages/fidelity.css exists.

type WalletBalance = {
  credit?: number;
  points?: number;
};

type FidelityClient = {
  id: number;
  name: string;
  email?: string;
  wallet?: WalletBalance;
};

type FidelityData = {
  ok?: boolean;
  clients?: FidelityClient[];
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

export function FidelityWalletContent() {
  const slug = tenantSlug();

  const [clients, setClients] = useState<FidelityClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter form state (left column).
  const [filterClientId, setFilterClientId] = useState("");
  const [filterText, setFilterText] = useState("");

  // Manual operation form state (right column).
  const [moveClientId, setMoveClientId] = useState("");
  const [moveSearch, setMoveSearch] = useState("");
  const [op, setOp] = useState("add");
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/manage/fidelity?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j: FidelityData) => setClients(Array.isArray(j.clients) ? j.clients : []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  function clientName(id: string): string {
    const c = clients.find((x) => String(x.id) === id);
    return c ? c.name : "";
  }

  const filterMatches = useMemo(
    () =>
      clients.filter((c) =>
        filterText.trim() === ""
          ? true
          : `${c.name} ${c.email ?? ""}`.toLowerCase().includes(filterText.toLowerCase()),
      ),
    [clients, filterText],
  );

  const moveMatches = useMemo(
    () =>
      clients.filter((c) =>
        moveSearch.trim() === ""
          ? true
          : `${c.name} ${c.email ?? ""}`.toLowerCase().includes(moveSearch.toLowerCase()),
      ),
    [clients, moveSearch],
  );

  // Rows visible in the "Clienti Fidelity" table: when a client filter is set,
  // restrict to that single client; otherwise show all returned clients.
  const tableClients = useMemo(
    () => (filterClientId ? clients.filter((c) => String(c.id) === filterClientId) : clients),
    [clients, filterClientId],
  );

  async function submitMove(e: React.FormEvent) {
    e.preventDefault();
    if (!moveClientId || !points) return;
    const delta = op === "remove" ? -Math.abs(Number(points)) : Math.abs(Number(points));
    try {
      await fetch(`/api/manage/fidelity?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify({
          slug,
          client_id: moveClientId,
          type: op === "remove" ? "points_redeem" : "points_earn",
          points: delta,
          note,
          source: "manual",
        }),
      });
      setPoints("");
      setNote("");
      load();
    } catch {
      // network error: leave form as-is
    }
  }

  function pageHref(suffix: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=fidelity_wallet${suffix}`;
  }

  return (
    <main className="app-content">
      <div className="container-fluid">
        <div className="bs-page-header">
          <div className="bs-page-heading">
            <div className="bs-page-kicker">Portafoglio</div>
            <h1 className="bs-page-title">Fidelity • Portafoglio</h1>
            <div className="bs-page-subtitle">Gestione punti per cliente, movimenti manuali e scadenze.</div>
          </div>
        </div>

        <div className="row g-3 align-items-start">
          <div className="col-12 col-xl-9 order-xl-1">
            <div className="card p-3 mb-3">
              <form
                method="get"
                className="row g-2 align-items-end"
                onSubmit={(e) => e.preventDefault()}
              >
                <input type="hidden" name="page" value="fidelity_wallet" />
                <div className="col-lg-4">
                  <label className="form-label">Cliente</label>
                  <div className="app-combobox dropdown" id="walletClientFilterBox">
                    <button
                      className="btn btn-outline-secondary dropdown-toggle w-100 app-combobox-toggle"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <span className={`app-combobox-text${filterClientId ? "" : " d-none"}`}>
                        {clientName(filterClientId)}
                      </span>
                      <span className={`text-muted app-combobox-placeholder${filterClientId ? " d-none" : ""}`}>
                        Tutti i clienti
                      </span>
                    </button>
                    <div className="dropdown-menu p-2 w-100">
                      <input
                        type="text"
                        className="form-control form-control-sm app-combobox-search"
                        placeholder="Cerca..."
                        autoComplete="off"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                      />
                      <div className="app-combobox-list mt-2">
                        <button
                          type="button"
                          className="dropdown-item"
                          onClick={() => setFilterClientId("")}
                        >
                          Tutti i clienti
                        </button>
                        {filterMatches.map((c) => (
                          <button
                            type="button"
                            className="dropdown-item"
                            key={c.id}
                            onClick={() => setFilterClientId(String(c.id))}
                          >
                            {c.name}
                            {c.email ? <span className="text-muted small ms-1">{c.email}</span> : null}
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

            <div className="card p-3">
              <div>
                <div>
                  <div className="fw-semibold">Portafoglio Punti</div>
                  <div className="text-muted small">
                    Seleziona un cliente per vedere saldo, punti prenotati, movimenti e scadenze.
                  </div>
                </div>
              </div>

              <hr />

              <div className="fw-semibold mb-2">Clienti Fidelity</div>

              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Email</th>
                      <th className="text-end">Punti</th>
                      <th className="text-end"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableClients.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-muted p-3">
                          {loading ? "Caricamento…" : "Nessun cliente Fidelity trovato."}
                        </td>
                      </tr>
                    ) : (
                      tableClients.map((c) => (
                        <tr key={c.id}>
                          <td className="fw-semibold">{c.name}</td>
                          <td className="text-muted">{c.email || "—"}</td>
                          <td className="text-end">{c.wallet?.points ?? 0}</td>
                          <td className="text-end">
                            <a
                              className="btn btn-sm btn-outline-secondary"
                              href={pageHref(`&client_id=${c.id}`)}
                            >
                              Apri
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-muted small mt-2">
                Mostriamo i clienti con tessera Fidelity (anche senza Punti). Usa il filtro Cliente per aprire un
                portafoglio specifico.
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-3 order-xl-2">
            <div className="card mb-3">
              <div className="card-header">
                <div className="fw-semibold">Operazione manuale</div>
              </div>
              <div className="card-body">
                <form method="post" className="row g-3" onSubmit={submitMove}>
                  <input type="hidden" name="_mode" value="manual_move_points" />

                  <div className="col-12">
                    <label className="form-label fw-semibold">Cliente</label>
                    <div className="app-combobox dropdown" id="manualMoveClientBox">
                      <button
                        className="btn btn-outline-secondary dropdown-toggle w-100 app-combobox-toggle"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        <span className={`app-combobox-text${moveClientId ? "" : " d-none"}`}>
                          {clientName(moveClientId)}
                        </span>
                        <span className={`text-muted app-combobox-placeholder${moveClientId ? " d-none" : ""}`}>
                          Seleziona...
                        </span>
                      </button>
                      <div className="dropdown-menu p-2 w-100">
                        <input
                          type="text"
                          className="form-control form-control-sm app-combobox-search"
                          placeholder="Cerca..."
                          autoComplete="off"
                          value={moveSearch}
                          onChange={(e) => setMoveSearch(e.target.value)}
                        />
                        <div className="app-combobox-list mt-2">
                          {moveMatches.map((c) => (
                            <button
                              type="button"
                              className="dropdown-item"
                              key={c.id}
                              onClick={() => setMoveClientId(String(c.id))}
                            >
                              {c.name}
                              {c.email ? <span className="text-muted small ms-1">{c.email}</span> : null}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input type="hidden" name="client_id" value={moveClientId} />
                    </div>
                    <select
                      className="form-select d-none"
                      name="client_id_legacy"
                      aria-hidden="true"
                      tabIndex={-1}
                      value={moveClientId}
                      onChange={(e) => setMoveClientId(e.target.value)}
                    >
                      <option value="">Seleziona…</option>
                      {clients.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Operazione</label>
                    <select
                      className="form-select"
                      name="op"
                      value={op}
                      onChange={(e) => setOp(e.target.value)}
                    >
                      <option value="add">Aggiungi</option>
                      <option value="remove">Rimuovi</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Punti</label>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      step="1"
                      name="points"
                      placeholder="10"
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Nota (opzionale)</label>
                    <input
                      className="form-control"
                      name="note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <button className="btn btn-outline-primary w-100" type="submit">
                      <i className="bi bi-arrow-left-right me-1" />
                      Registra
                    </button>
                  </div>
                </form>

                <div className="small text-muted mt-2">
                  <div>
                    Nota: in caso di rimozione, il sistema non rimuove punti <strong>già prenotati</strong> su
                    appuntamenti in sospeso/prenotati.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
