"use client";

import { useState } from "react";
import { ManageAuthShell } from "@/components/manage-auth-shell";

// Pixel-faithful port of the PHP /manage/forgot-password page.
export function ManageForgotPasswordFaithful({ initialSlug }: { initialSlug: string }) {
  const [slug, setSlug] = useState(initialSlug);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/manage/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setError(data.error || "Impossibile inviare il link.");
        setLoading(false);
        return;
      }
      setMessage(data.message || "Se l'attivita e l'email sono corretti, riceverai un link sicuro per reimpostare la password.");
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
        {message ? <div className="alert alert-success">{message}</div> : null}

        <h1>Recupera password</h1>
        <p className="lead">Inserisci URL attivita ed email per ricevere il link sicuro.</p>

        <form className="form" method="post" onSubmit={onSubmit}>
          <label>
            URL attivita
            <input
              type="text"
              name="reset_slug"
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
              name="reset_email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Invio…" : "Invia link"}
          </button>
          <div className="links">
            <a href="/manage/login">Torna al login</a>
          </div>
        </form>
      </section>
    </ManageAuthShell>
  );
}
