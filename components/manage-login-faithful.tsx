"use client";

import { useEffect, useState } from "react";

// Pixel-faithful port of the PHP /manage/login page (app/pages/manage_account.php).
// Reuses the original markup/classes + assets/css/pages/{public_account,manage_account}.css.
// Submits to the existing JSON auth API instead of the PHP form post.
export function ManageLoginFaithful({ initialSlug }: { initialSlug: string }) {
  const [slug, setSlug] = useState(initialSlug);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The PHP page renders <body class="account-page account-page--auth manage-page">.
  // Swap the body classes for this page only, restoring on unmount.
  useEffect(() => {
    const previous = document.body.className;
    document.body.className = "account-page account-page--auth manage-page";
    return () => {
      document.body.className = previous;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/manage/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Credenziali non valide.");
        setLoading(false);
        return;
      }
      window.location.href = data.redirectTo || `/${encodeURIComponent(slug)}/dashboard`;
    } catch {
      setError("Servizio non disponibile. Riprova.");
      setLoading(false);
    }
  }

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

          <section className="auth-card">
            {error ? <div className="alert">{error}</div> : null}

            <h1>Accedi al gestionale</h1>
            <p className="lead">Entra con URL attivita, email e password.</p>

            <form className="form" method="post" onSubmit={onSubmit}>
              <label>
                URL attivita
                <input
                  type="text"
                  name="login_slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="centroesteticoelite"
                  autoComplete="organization"
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  name="login_email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? "Accesso…" : "Accedi"}
              </button>
              <div className="links">
                <a href="/manage/register">Registrati</a>
                <span>|</span>
                <a href="/manage/forgot-password">Password dimenticata?</a>
              </div>
            </form>
          </section>
        </section>

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
      </main>
    </>
  );
}
