"use client";

// Faithful port of the PHP wallet page (app/pages/wallet.php): two nav tiles.
function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

export function WalletContent() {
  const slug = tenantSlug();
  return (
    <div className="container-fluid">
      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Fidelizzazione</div>
          <h1 className="bs-page-title">Portafoglio</h1>
          <div className="bs-page-subtitle">Accedi ai portafogli credito e punti disponibili.</div>
        </div>
      </div>

      <div className="wallet-grid">
        <a className="wallet-tile tile-points" href={`/${encodeURIComponent(slug)}/fidelity_wallet`} aria-label="Apri Portafoglio Punti">
          <div className="chev" aria-hidden="true"><i className="bi bi-chevron-right" /></div>
          <div className="icon" aria-hidden="true"><i className="bi bi-award" /></div>
          <div className="title">Portafoglio Punti</div>
          <div className="desc">Saldo punti, movimenti e punti in sospeso.</div>
        </a>
        <a className="wallet-tile tile-credit" href={`/${encodeURIComponent(slug)}/credit_movements`} aria-label="Apri Movimenti Credito">
          <div className="chev" aria-hidden="true"><i className="bi bi-chevron-right" /></div>
          <div className="icon" aria-hidden="true"><i className="bi bi-wallet2" /></div>
          <div className="title">Movimenti Credito</div>
          <div className="desc">Ricariche, utilizzi, storni e credito in sospeso.</div>
        </a>
      </div>
    </div>
  );
}
