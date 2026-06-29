"use client";

import { useEffect } from "react";

// Shared chrome for the faithful PHP /manage auth pages (login, register,
// forgot/reset password). Reproduces app/pages/manage_account.php markup +
// loads the original auth CSS, and renders the right-hand visual card.

export function useAuthBodyClass() {
  useEffect(() => {
    const previous = document.body.className;
    document.body.className = "account-page account-page--auth manage-page";
    return () => {
      document.body.className = previous;
    };
  }, []);
}

export function ManageAuthShell({ children }: { children: React.ReactNode }) {
  useAuthBodyClass();
  return (
    <>
      <link rel="stylesheet" href="/assets/css/pages/public_account.css" />
      <link rel="stylesheet" href="/assets/css/pages/manage_account.css" />

      <a className="auth-back" href="/attivita" aria-label="Torna indietro">
        &larr;
      </a>
      <main className="account-main account-main--auth-flow">
        <section className="auth-stack">
          <a className="auth-brand" href="/manage/login">
            <span className="brand-mark">B</span>
            <span>BeautySuite</span>
          </a>
          {children}
        </section>
        <ManageAuthVisual />
      </main>
    </>
  );
}

function ManageAuthVisual() {
  return (
    <aside className="visual-card manage-visual">
      <div className="visual-content">
        <div className="tenant-badge">B</div>
        <h2>Gestisci la tua attivita online</h2>
        <p>
          Crea il gestionale, configura sedi e operatori, abilita le prenotazioni e accedi al
          pannello da un unico punto.
        </p>
        <div className="visual-actions">
          <a className="is-light" href="/manage/register">
            Crea account
          </a>
          <a href="/attivita">Marketplace</a>
        </div>
      </div>
      <div className="product-device" aria-hidden="true">
        <div className="product-screen">
          <div className="product-sidebar">
            <span className="product-dot" />
            <span className="product-dot" />
            <span className="product-dot" />
            <span className="product-dot" />
            <span className="product-dot" />
          </div>
          <div className="product-area">
            <div className="product-top">
              <div className="product-title-lines">
                <span />
                <span />
              </div>
              <div className="product-kpi" />
            </div>
            <div className="product-grid">
              <div className="product-card is-tall">
                <span />
                <span />
                <span />
              </div>
              <div className="product-card">
                <span />
                <span />
                <span />
              </div>
              <div className="product-card">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
