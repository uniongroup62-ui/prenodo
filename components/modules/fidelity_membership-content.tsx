"use client";

import { useEffect, useMemo, useState } from "react";

// Faithful port of the PHP fidelity membership page (app/pages/fidelity_membership.php,
// ?page=fidelity_membership): "Adesione" — manage Fidelity cards (tessere), states and
// memberships. The PHP page links only app.css (no page-specific CSS) and a JS file that
// drives the "Nuova tessera" client search and date logic. The card list is server-rendered;
// the existing /api/manage/fidelity route exposes clients (with wallet) but NOT card records,
// so the "Tessere" table renders the original empty state ("Nessuna tessera.").

type FidelityClient = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function FidelityMembershipContent() {
  const slug = tenantSlug();
  const today = todayYmd();

  const [q, setQ] = useState("");
  const [clients, setClients] = useState<FidelityClient[]>([]);

  // "Nuova tessera" modal state.
  const [cardClientSearch, setCardClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<FidelityClient | null>(null);
  const [cardCode, setCardCode] = useState("");
  const [cardIssuedAt, setCardIssuedAt] = useState(today);
  const [cardStatus, setCardStatus] = useState("active");

  useEffect(() => {
    fetch(`/api/manage/fidelity?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => {
        const list = Array.isArray(j.clients) ? j.clients : [];
        setClients(
          list.map((c: FidelityClient) => ({
            id: Number(c.id),
            name: String(c.name ?? ""),
            email: c.email ? String(c.email) : "",
            phone: c.phone ? String(c.phone) : "",
          })),
        );
      })
      .catch(() => setClients([]));
  }, [slug]);

  function href(suffix: string): string {
    return `/${encodeURIComponent(slug)}/${`fidelity_membership${suffix}`.replace("&", "?")}`;
  }

  function pageHref(page: string): string {
    return `/${encodeURIComponent(slug)}/${`${page}`.replace("&", "?")}`;
  }

  // Client search results inside the "Nuova tessera" modal (matches the PHP JS:
  // at least 2 characters, name/email/phone match).
  const cardClientResults = useMemo(() => {
    const term = cardClientSearch.trim().toLowerCase();
    if (term.length < 2) return [];
    return clients
      .filter((c) => {
        return (
          c.name.toLowerCase().includes(term) ||
          (c.email ?? "").toLowerCase().includes(term) ||
          (c.phone ?? "").toLowerCase().includes(term)
        );
      })
      .slice(0, 8);
  }, [cardClientSearch, clients]);

  function selectClient(c: FidelityClient) {
    setSelectedClient(c);
    setCardClientSearch("");
  }

  return (
    <div className="container-fluid">
      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Programma punti</div>
          <h1 className="bs-page-title">Adesione</h1>
          <div className="bs-page-subtitle">Gestisci tessere, stati e adesioni Fidelity.</div>
        </div>
        <div className="bs-page-actions">
          <div className="d-flex gap-2">
            <a className="btn btn-light" href={pageHref("fidelity")}>
              <i className="bi bi-arrow-left" /> Fidelity
            </a>
            <a className="btn btn-light" href={`${pageHref("fidelity_points")}#livelli-card`}>
              <i className="bi bi-stars" /> Livelli Card
            </a>
            <a className="btn btn-light" href={pageHref("fidelity_membership_settings")}>
              <i className="bi bi-gear" /> Impostazioni
            </a>
          </div>
        </div>
      </div>

      <div className="card p-3 mb-3">
        <form method="get" className="row g-2 align-items-end" action={href("")}>
          <input type="hidden" name="page" value="fidelity_membership" />
          <div className="col-lg-8">
            <label className="form-label">Cerca</label>
            <input
              className="form-control"
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cliente o codice tessera"
            />
          </div>
          <div className="col-lg-4 d-flex align-items-end gap-2 app-filter-actions">
            <button className="btn btn-outline-primary app-filter-submit" type="submit">
              <i className="bi bi-search me-1" />
              Filtra
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <div className="fw-semibold">Tessere</div>
          <button
            className="btn btn-sm btn-primary"
            type="button"
            data-bs-toggle="modal"
            data-bs-target="#newCardModal"
          >
            <i className="bi bi-plus" /> Nuova tessera
          </button>
        </div>

        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead>
              <tr>
                <th>Codice Tessera</th>
                <th>Data Emissione</th>
                <th>Data Scadenza</th>
                <th>Scaduta</th>
                <th>Cliente</th>
                <th>Stato</th>
                <th className="text-end">Azioni</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="text-muted p-3">
                  Nessuna tessera.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Impostazioni tessera Fidelity spostate nella pagina dedicata: index.php?page=fidelity_membership_settings */}

      {/* Modal: Nuova tessera */}
      <div className="modal fade" id="newCardModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <form method="post" id="newCardForm" action={href("")}>
              <input type="hidden" name="_mode" value="create_card" />
              <input
                type="hidden"
                name="client_id"
                id="cardClientId"
                value={selectedClient ? String(selectedClient.id) : ""}
                readOnly
              />

              <div className="modal-header">
                <h5 className="modal-title">Nuova tessera</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi" />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Cliente</label>
                    <input
                      className="form-control"
                      id="cardClientSearch"
                      placeholder="Cerca cliente (nome, email, telefono...)"
                      autoComplete="off"
                      value={cardClientSearch}
                      onChange={(e) => setCardClientSearch(e.target.value)}
                    />
                    <div className="form-text">
                      Digita almeno 2 caratteri e seleziona il cliente dai risultati.
                    </div>
                    <div id="cardClientResults" className="list-group mt-2">
                      {cardClientResults.map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          className="list-group-item list-group-item-action"
                          onClick={() => selectClient(c)}
                        >
                          <div className="fw-semibold">{c.name}</div>
                          <div className="text-muted small">
                            {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div id="cardClientSelected" className={`mt-2${selectedClient ? "" : " d-none"}`}>
                      <div className="alert alert-light border d-flex justify-content-between align-items-center mb-0">
                        <div>
                          <div className="fw-semibold" id="cardClientSelectedName">
                            {selectedClient?.name ?? ""}
                          </div>
                          <div className="text-muted small" id="cardClientSelectedMeta">
                            {selectedClient
                              ? [selectedClient.email, selectedClient.phone].filter(Boolean).join(" · ")
                              : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          id="cardClientClear"
                          onClick={() => setSelectedClient(null)}
                        >
                          Cambia
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Codice tessera</label>
                    <input
                      className="form-control"
                      name="code"
                      placeholder="Automatico (es. 000001)"
                      value={cardCode}
                      onChange={(e) => setCardCode(e.target.value)}
                    />
                    <div className="form-text">
                      Se vuoto viene generato automaticamente. Un codice già usato, anche su tessera
                      eliminata, non può essere riutilizzato.
                    </div>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Data emissione</label>
                    <input
                      className="form-control"
                      type="date"
                      name="issued_at"
                      id="cardIssuedAt"
                      value={cardIssuedAt}
                      onChange={(e) => setCardIssuedAt(e.target.value)}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Data scadenza</label>
                    <div className="form-control bg-light" id="cardExpiresAtView">
                      —
                    </div>
                    <div className="form-text">
                      Calcolata automaticamente dalle Impostazioni tessera Fidelity in base alla Data
                      emissione. Non modificabile qui.
                    </div>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Stato</label>
                    <select
                      className="form-select"
                      name="status"
                      id="cardStatusSelect"
                      value={cardStatus}
                      onChange={(e) => setCardStatus(e.target.value)}
                    >
                      <option value="active">Attiva</option>
                      <option value="inactive">Disattiva</option>
                    </select>
                    <div
                      id="cardAlreadyExpiredNotice"
                      className="alert alert-warning py-2 px-3 mt-2 mb-0 d-none"
                    >
                      Con la <strong>Data emissione</strong> selezionata, la tessera risulterebbe già{" "}
                      <strong>scaduta</strong>. Per crearla come <strong>Attiva</strong> scegli una data
                      più recente; in alternativa impostala come <strong>Disattiva</strong>.
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                  Annulla
                </button>
                <button className="btn btn-primary" type="submit">
                  <i className="bi bi-check2" /> Crea tessera
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal: Modifica tessera */}
      <div className="modal fade" id="editCardModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <form method="post" id="editCardForm" action={href("")}>
              <input type="hidden" name="_mode" value="update_card" id="editCardMode" />
              <input type="hidden" name="card_id" id="editCardId" value="" readOnly />

              <div className="modal-header">
                <h5 className="modal-title">Modifica tessera</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi" />
              </div>

              <div className="modal-body">
                <div className="mb-2">
                  <div className="text-muted small">Codice tessera</div>
                  <div className="fw-semibold" id="editCardCode">
                    —
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-muted small">Cliente</div>
                  <div className="fw-semibold" id="editCardClient">
                    —
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Data scadenza</label>
                    <div className="form-control bg-light" id="editCardExpires">
                      —
                    </div>
                    <div className="form-text" id="editCardExpiresHelp">
                      La data di scadenza è visualizzata ma non può essere modificata qui.
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold">Stato</label>
                    <select className="form-select" name="status" id="editCardStatus" defaultValue="active">
                      <option value="active">Attiva</option>
                      <option value="inactive">Disattiva</option>
                    </select>
                  </div>
                </div>

                <div className="alert alert-light border mt-3 mb-0">
                  <div className="small text-muted">
                    Nota: se la regola adesione è <strong>Solo clienti con tessera</strong>, una tessera{" "}
                    <strong>scaduta</strong> o <strong>disattivata</strong> rende il cliente non aderente.
                    <br />
                    Se imposti <strong>Disattiva</strong>, il cliente perde le agevolazioni Fidelity
                    prenotate sulle prenotazioni in stato <strong>In sospeso</strong> /{" "}
                    <strong>Prenotato</strong>; le prenotazioni in stato <strong>Eseguito</strong> restano
                    invariate per mantenere lo storico.
                    <br />
                    Alla scadenza la tessera viene disattivata automaticamente, ma{" "}
                    <strong>punti Fidelity</strong> e movimenti già maturati{" "}
                    <strong>non vengono azzerati</strong>.
                    <br />
                    Se la tessera è scaduta, usa <strong>Riattiva tessera</strong> per ricalcolare la nuova
                    scadenza dalla data odierna in base alla durata impostata in{" "}
                    <strong>Fidelity → Adesione → Impostazioni tessera Fidelity</strong>.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                  Annulla
                </button>
                <button type="button" className="btn btn-outline-primary d-none" id="editCardReactivateBtn">
                  <i className="bi bi-arrow-clockwise" /> Riattiva tessera
                </button>
                <button className="btn btn-primary" type="submit" id="editCardSaveBtn">
                  <i className="bi bi-check2-circle me-1" />
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
