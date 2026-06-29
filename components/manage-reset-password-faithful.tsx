"use client";

import { useEffect, useState } from "react";
import { ManageAuthShell } from "@/components/manage-auth-shell";

// Pixel-faithful port of the PHP /manage/reset-password page (reset flow in
// app/pages/manage_account.php). Reads slug + token from the URL query and
// reproduces both states: invalid/missing token (the .manage-empty
// "Link non valido o scaduto" block) and the valid new-password form.
// Submits to the existing JSON auth API instead of the PHP form post.
export function ManageResetPasswordFaithful({
  initialSlug,
  initialToken,
}: {
  initialSlug: string;
  initialToken: string;
}) {
  const slug = initialSlug;
  const token = initialToken;

  const [valid, setValid] = useState<boolean | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!slug || !token) {
      setValid(false);
      return;
    }
    async function validate() {
      try {
        const res = await fetch(
          `/api/manage/auth/reset-password?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setValid(false);
          return;
        }
        setResetEmail(data.reset?.email ?? "");
        setValid(true);
      } catch {
        if (!cancelled) setValid(false);
      }
    }
    validate();
    return () => {
      cancelled = true;
    };
  }, [slug, token]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    if (password !== passwordConfirm) {
      setError("Le password non coincidono.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/manage/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, token, password, password_confirm: passwordConfirm }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Reset password non riuscito.");
        setLoading(false);
        return;
      }
      setSuccess(data.message || "Password aggiornata. Ora puoi accedere.");
      setPassword("");
      setPasswordConfirm("");
      setLoading(false);
    } catch {
      setError("Servizio non disponibile. Riprova.");
      setLoading(false);
    }
  }

  return (
    <ManageAuthShell>
      <section className="auth-card">
        {error ? <div className="alert">{error}</div> : null}
        {success ? <div className="alert alert-success">{success}</div> : null}

        <h1>Reimposta password</h1>
        <p className="lead">Imposta una nuova password per accedere al gestionale.</p>

        {success ? (
          <div className="links links--start">
            <a href="/manage/login">Torna al login</a>
          </div>
        ) : valid ? (
          <form className="form" method="post" onSubmit={onSubmit}>
            <div className="manage-empty manage-empty--compact">
              <strong>{resetEmail}</strong>
              <p>Imposta una nuova password per il gestionale {slug}.</p>
            </div>
            <label>
              Nuova password
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label>
              Conferma password
              <input
                type="password"
                name="password_confirm"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Salvataggio…" : "Salva password"}
            </button>
            <div className="links">
              <a href="/manage/forgot-password">Richiedi un nuovo link</a>
            </div>
          </form>
        ) : valid === false ? (
          <>
            <div className="manage-empty">
              <strong>Link non valido o scaduto</strong>
              <p>Richiedi un nuovo link inserendo URL attivita ed email.</p>
            </div>
            <div className="links links--start">
              <a href="/manage/forgot-password">Richiedi un nuovo link</a>
            </div>
          </>
        ) : null}
      </section>
    </ManageAuthShell>
  );
}
