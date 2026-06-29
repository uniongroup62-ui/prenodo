"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Heart,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  ShieldCheck,
  Store,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";

type AccountMode = "login" | "register" | "forgot-password" | "verify" | "reset" | "activities" | "favorites" | "profile";

type PublicCustomer = {
  id: number;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  pendingEmail: string;
};

type Favorite = {
  id: number;
  key: string;
  tenantSlug: string;
  locationId: number;
  title: string;
  subtitle: string;
  locationName: string;
  city: string;
  address: string;
  bookingUrl: string;
  profileUrl: string;
  bookingEnabled: boolean;
};

type Activity = {
  tenantSlug: string;
  title: string;
  subtitle: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  bookingUrl: string;
  clientId: number;
  locations: Array<{
    locationId: number;
    locationName: string;
    city: string;
    address: string;
    bookingUrl: string;
  }>;
};

type AccountResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  user?: PublicCustomer | null;
  favorites?: Favorite[];
  favoriteKeys?: Record<string, boolean>;
  activities?: Activity[];
  requiresVerification?: boolean;
  accountId?: number;
  email?: string;
  devCode?: string;
  devToken?: string;
};

export function PublicAccountPage({ initialMode = "login" }: { initialMode?: AccountMode }) {
  const [mode, setMode] = useState<AccountMode>(initialMode);
  const [user, setUser] = useState<PublicCustomer | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pendingAccountId, setPendingAccountId] = useState(0);
  const [pendingEmail, setPendingEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const activeMode: AccountMode = user && ["login", "register", "forgot-password", "verify", "reset"].includes(mode)
    ? "activities"
    : mode;
  const protectedMode = ["activities", "favorites", "profile"].includes(activeMode);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        const data = await response.json() as AccountResponse;
        if (!active) return;
        if (data.ok) applyAccountData(data);
      } catch {
      }

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");
        const email = params.get("email");
        const accountId = Number(params.get("account_id") ?? params.get("accountId") ?? 0);
        if (token || email) {
          setMode("reset");
        }
        if (accountId > 0) {
          setPendingAccountId(accountId);
          setPendingEmail(email ?? "");
          if (initialMode === "verify") setMode("verify");
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [initialMode]);

  const stats = useMemo(() => [
    { label: "Attivita", value: activities.length, icon: Store },
    { label: "Preferiti", value: favorites.length, icon: Heart },
    { label: "Sedi collegate", value: activities.reduce((sum, item) => sum + item.locations.length, 0), icon: MapPin },
  ], [activities, favorites]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event.currentTarget);
    if (mode === "register" && values.password !== values.password_confirm) {
      setError("Le password non coincidono.");
      return;
    }
    const action = mode === "register" ? "register" : mode === "forgot-password" ? "forgot" : mode === "reset" ? "reset" : "login";
    const data = await postAccount(action, values);
    if (!data) return;

    if (data.requiresVerification) {
      setPendingAccountId(Number(data.accountId ?? 0));
      setPendingEmail(data.email ?? values.email ?? "");
      setMode("verify");
      setMessage(withDebugCode("Codice inviato alla tua email.", data));
      return;
    }

    if (action === "forgot") {
      setMessage(withResetToken(data.message ?? "Se l'email e registrata, riceverai un link di reset.", data));
      return;
    }

    applyAccountData(data);
    setMessage(action === "reset" ? "Password aggiornata." : "Accesso effettuato.");
    if (data.user && redirectToReturn()) return;
    if (data.user) setMode("activities");
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event.currentTarget);
    const data = await postAccount("verify", {
      account_id: String(pendingAccountId || Number(values.account_id ?? 0)),
      code: values.code ?? "",
    });
    if (!data) return;
    applyAccountData(data);
    setMessage("Email verificata.");
    if (data.user && redirectToReturn()) return;
    if (data.user) setMode("activities");
  }

  async function resendVerification() {
    if (!pendingAccountId) return;
    const data = await postAccount("resend_verification", { account_id: String(pendingAccountId) });
    if (data) setMessage(withDebugCode("Codice inviato di nuovo.", data));
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = await postAccount("update_profile", formValues(event.currentTarget));
    if (!data) return;
    applyAccountData(data);
    setMessage("Profilo aggiornato.");
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = await postAccount("change_password", formValues(event.currentTarget));
    if (!data) return;
    applyAccountData(data);
    setMessage("Password aggiornata.");
    event.currentTarget.reset();
  }

  async function submitEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = await postAccount("request_email_change", formValues(event.currentTarget));
    if (!data) return;
    applyAccountData(data);
    setMessage(withDebugCode("Codice inviato alla nuova email.", data));
    event.currentTarget.reset();
  }

  async function confirmEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = await postAccount("confirm_email_change", formValues(event.currentTarget));
    if (!data) return;
    applyAccountData(data);
    setMessage("Email aggiornata.");
    event.currentTarget.reset();
  }

  async function removeFavorite(favorite: Favorite) {
    const data = await postAccount("remove_favorite", {
      tenant_slug: favorite.tenantSlug,
      location_id: String(favorite.locationId),
    });
    if (!data) return;
    applyAccountData(data);
    setMessage("Preferito rimosso.");
  }

  async function logout() {
    const data = await postAccount("logout", {});
    if (!data) return;
    applyAccountData(data);
    setMode("login");
    setMessage("Sessione chiusa.");
  }

  async function postAccount(action: string, payload: Record<string, string>): Promise<AccountResponse | null> {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json() as AccountResponse;
      if (!data.ok) throw new Error(data.error || "Operazione non riuscita.");
      return data;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operazione non riuscita.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  function applyAccountData(data: AccountResponse) {
    setUser(data.user ?? null);
    setFavorites(data.favorites ?? []);
    setActivities(data.activities ?? []);
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#191816]">
      <section className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <aside className="self-start rounded-lg border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <Link className="mb-6 inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-semibold" href="/attivita">
            <ArrowLeft size={16} aria-hidden />
            Marketplace
          </Link>
          <h1 className="text-3xl font-semibold">Account cliente</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Gestisci prenotazioni collegate, preferiti e dati profilo.</p>

          {message ? <Notice tone="success" text={message} /> : null}
          {error ? <Notice tone="error" text={error} /> : null}

          {user ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg bg-[#f7f6f2] p-4">
                <p className="font-semibold">{user.fullName}</p>
                <p className="mt-1 text-sm text-zinc-600">{user.email}</p>
              </div>
              <nav className="grid gap-2">
                <AccountNavButton active={activeMode === "activities"} icon={CalendarDays} label="Attivita" onClick={() => setMode("activities")} />
                <AccountNavButton active={activeMode === "favorites"} icon={Heart} label="Preferiti" onClick={() => setMode("favorites")} />
                <AccountNavButton active={activeMode === "profile"} icon={User} label="Profilo" onClick={() => setMode("profile")} />
              </nav>
              <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-semibold" type="button" onClick={logout} disabled={busy}>
                <LogOut size={16} aria-hidden />
                Esci
              </button>
            </div>
          ) : (
            <AuthPanel
              busy={busy}
              mode={mode}
              pendingAccountId={pendingAccountId}
              pendingEmail={pendingEmail}
              onMode={setMode}
              onResend={resendVerification}
              onSubmit={mode === "verify" ? submitVerification : submitAuth}
            />
          )}
        </aside>

        <section className="space-y-4">
          {user ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {stats.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article className="rounded-lg border border-zinc-200 bg-white p-5" key={item.label}>
                      <Icon size={20} aria-hidden className="text-emerald-700" />
                      <p className="mt-4 text-sm text-zinc-600">{item.label}</p>
                      <p className="mt-1 text-3xl font-semibold">{item.value}</p>
                    </article>
                  );
                })}
              </div>
              {activeMode === "activities" ? <ActivitiesView activities={activities} /> : null}
              {activeMode === "favorites" ? <FavoritesView busy={busy} favorites={favorites} onRemove={removeFavorite} /> : null}
              {activeMode === "profile" ? (
                <ProfileView
                  busy={busy}
                  user={user}
                  onCancelEmailChange={async () => {
                    const data = await postAccount("cancel_email_change", {});
                    if (data) {
                      applyAccountData(data);
                      setMessage("Richiesta annullata.");
                    }
                  }}
                  onConfirmEmailChange={confirmEmailChange}
                  onSubmitEmailChange={submitEmailChange}
                  onSubmitPassword={submitPassword}
                  onSubmitProfile={submitProfile}
                />
              ) : null}
            </>
          ) : (
            <GuestView protectedMode={protectedMode} />
          )}
        </section>
      </section>
    </main>
  );
}

function AuthPanel({
  busy,
  mode,
  pendingAccountId,
  pendingEmail,
  onMode,
  onResend,
  onSubmit,
}: {
  busy: boolean;
  mode: AccountMode;
  pendingAccountId: number;
  pendingEmail: string;
  onMode: (mode: AccountMode) => void;
  onResend: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (mode === "verify") {
    return (
      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        {pendingAccountId > 0 ? (
          <input name="account_id" type="hidden" value={pendingAccountId} readOnly />
        ) : (
          <Field label="ID account" name="account_id" inputMode="numeric" required />
        )}
        <p className="rounded-lg bg-[#f7f6f2] p-3 text-sm text-zinc-700">{pendingEmail || "Email in verifica"}</p>
        <Field label="Codice verifica" name="code" inputMode="numeric" maxLength={6} required />
        <SubmitButton busy={busy} icon={ShieldCheck} label="Verifica" />
        <button className="text-sm font-semibold text-emerald-800" type="button" onClick={onResend} disabled={busy}>
          Reinvia codice
        </button>
      </form>
    );
  }

  if (mode === "reset") {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    return (
      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <Field defaultValue={params.get("email") ?? ""} label="Email" name="email" type="email" required />
        <Field defaultValue={params.get("token") ?? ""} label="Token reset" name="token" required />
        <Field label="Nuova password" name="password" type="password" required />
        <SubmitButton busy={busy} icon={KeyRound} label="Aggiorna password" />
        <AuthLinks mode={mode} onMode={onMode} />
      </form>
    );
  }

  return (
    <form className="mt-5 space-y-3" onSubmit={onSubmit}>
      {mode === "register" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" name="first_name" required />
          <Field label="Cognome" name="last_name" required />
        </div>
      ) : null}
      <Field label="Email" name="email" type="email" required />
      {mode === "register" ? <Field label="Telefono" name="phone" type="tel" /> : null}
      {mode !== "forgot-password" ? <Field label="Password" name="password" type="password" required /> : null}
      {mode === "register" ? <Field label="Conferma password" name="password_confirm" type="password" required /> : null}
      <SubmitButton
        busy={busy}
        icon={mode === "register" ? UserPlus : mode === "forgot-password" ? Mail : KeyRound}
        label={mode === "register" ? "Crea account" : mode === "forgot-password" ? "Invia link" : "Accedi"}
      />
      <AuthLinks mode={mode} onMode={onMode} />
    </form>
  );
}

function AuthLinks({ mode, onMode }: { mode: AccountMode; onMode: (mode: AccountMode) => void }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm font-medium text-zinc-600">
      {mode !== "login" ? <button type="button" onClick={() => onMode("login")}>Login</button> : null}
      {mode !== "register" ? <button type="button" onClick={() => onMode("register")}>Registrati</button> : null}
      {mode !== "forgot-password" ? <button type="button" onClick={() => onMode("forgot-password")}>Password dimenticata?</button> : null}
    </div>
  );
}

function ActivitiesView({ activities }: { activities: Activity[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-2xl font-semibold">Attivita collegate</h2>
      <div className="mt-4 grid gap-3">
        {activities.map((activity) => (
          <article className="rounded-lg border border-zinc-200 p-4" key={`${activity.tenantSlug}:${activity.clientId}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">{activity.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">{[activity.city, activity.address].filter(Boolean).join(", ") || activity.subtitle}</p>
                <p className="mt-2 text-sm text-zinc-500">Cliente #{activity.clientId}</p>
              </div>
              <div className="flex gap-2">
                <Link className="inline-flex h-10 items-center rounded-md border border-zinc-200 px-3 text-sm font-semibold" href={`/attivita/${activity.tenantSlug}`}>
                  Scheda
                </Link>
                <Link className="inline-flex h-10 items-center rounded-md bg-[#191816] px-3 text-sm font-semibold text-white" href={activity.bookingUrl}>
                  Prenota
                </Link>
              </div>
            </div>
            {activity.locations.length ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {activity.locations.map((location) => (
                  <Link className="rounded-lg bg-[#f7f6f2] p-3 text-sm" href={location.bookingUrl} key={location.locationId}>
                    <p className="font-semibold">{location.locationName}</p>
                    <p className="mt-1 text-zinc-600">{[location.city, location.address].filter(Boolean).join(", ")}</p>
                  </Link>
                ))}
              </div>
            ) : null}
          </article>
        ))}
        {!activities.length ? <EmptyState icon={CalendarDays} title="Nessuna attivita collegata" text="Le prenotazioni pubbliche con la tua email appariranno qui." /> : null}
      </div>
    </section>
  );
}

function FavoritesView({ busy, favorites, onRemove }: { busy: boolean; favorites: Favorite[]; onRemove: (favorite: Favorite) => void }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-2xl font-semibold">Preferiti</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {favorites.map((favorite) => (
          <article className="rounded-lg border border-zinc-200 p-4" key={favorite.key}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{favorite.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">{favorite.locationName}</p>
                <p className="mt-2 text-sm text-zinc-500">{[favorite.city, favorite.address].filter(Boolean).join(", ")}</p>
              </div>
              <button
                aria-label="Rimuovi preferito"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-zinc-700"
                disabled={busy}
                type="button"
                onClick={() => onRemove(favorite)}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <Link className="inline-flex h-10 items-center rounded-md border border-zinc-200 px-3 text-sm font-semibold" href={favorite.profileUrl}>
                Scheda
              </Link>
              {favorite.bookingEnabled ? (
                <Link className="inline-flex h-10 items-center rounded-md bg-[#191816] px-3 text-sm font-semibold text-white" href={favorite.bookingUrl}>
                  Prenota
                </Link>
              ) : null}
            </div>
          </article>
        ))}
        {!favorites.length ? <EmptyState icon={Heart} title="Nessun preferito" text="Salva una scheda dal marketplace per ritrovarla qui." /> : null}
      </div>
    </section>
  );
}

function ProfileView({
  busy,
  user,
  onCancelEmailChange,
  onConfirmEmailChange,
  onSubmitEmailChange,
  onSubmitPassword,
  onSubmitProfile,
}: {
  busy: boolean;
  user: PublicCustomer;
  onCancelEmailChange: () => void;
  onConfirmEmailChange: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitEmailChange: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitPassword: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitProfile: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-2xl font-semibold">Profilo</h2>
        <form className="mt-4 space-y-3" onSubmit={onSubmitProfile}>
          <div className="grid grid-cols-2 gap-3">
            <Field defaultValue={user.firstName} label="Nome" name="first_name" required />
            <Field defaultValue={user.lastName} label="Cognome" name="last_name" required />
          </div>
          <Field defaultValue={user.phone} label="Telefono" name="phone" type="tel" />
          <SubmitButton busy={busy} icon={User} label="Salva profilo" />
        </form>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-2xl font-semibold">Password</h2>
        <form className="mt-4 space-y-3" onSubmit={onSubmitPassword}>
          <Field label="Password attuale" name="current_password" type="password" required />
          <Field label="Nuova password" name="new_password" type="password" required />
          <Field label="Conferma password" name="confirm_password" type="password" required />
          <SubmitButton busy={busy} icon={KeyRound} label="Aggiorna password" />
        </form>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 xl:col-span-2">
        <h2 className="text-2xl font-semibold">Email</h2>
        <p className="mt-2 text-sm text-zinc-600">{user.email}</p>
        {user.pendingEmail ? (
          <div className="mt-4 rounded-lg bg-[#f7f6f2] p-4">
            <p className="text-sm font-semibold">Cambio in attesa: {user.pendingEmail}</p>
            <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={onConfirmEmailChange}>
              <input className="h-11 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-900" name="code" placeholder="Codice" required />
              <button className="h-11 rounded-md bg-[#191816] px-4 text-sm font-semibold text-white" disabled={busy}>
                Conferma
              </button>
              <button className="h-11 rounded-md border border-zinc-200 px-4 text-sm font-semibold" type="button" onClick={onCancelEmailChange} disabled={busy}>
                Annulla
              </button>
            </form>
          </div>
        ) : (
          <form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={onSubmitEmailChange}>
            <Field label="Nuova email" name="new_email" type="email" required />
            <Field label="Password attuale" name="current_password" type="password" required />
            <div className="flex items-end">
              <button className="h-11 rounded-md bg-[#191816] px-4 text-sm font-semibold text-white" disabled={busy}>
                Richiedi
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function GuestView({ protectedMode }: { protectedMode: boolean }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
        <ShieldCheck size={22} aria-hidden />
      </div>
      <h2 className="mt-5 text-2xl font-semibold">{protectedMode ? "Accesso richiesto" : "Area cliente marketplace"}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
        Entra o crea un account per gestire profilo, preferiti e attivita collegate.
      </p>
    </section>
  );
}

function Field({
  defaultValue,
  inputMode,
  label,
  maxLength,
  name,
  required,
  type = "text",
}: {
  defaultValue?: string;
  inputMode?: "numeric";
  label: string;
  maxLength?: number;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-600">{label}</span>
      <input
        className="h-11 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-900"
        defaultValue={defaultValue}
        inputMode={inputMode}
        maxLength={maxLength}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function SubmitButton({ busy, icon: Icon, label }: { busy: boolean; icon: typeof KeyRound; label: string }) {
  return (
    <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#191816] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy}>
      {busy ? <Loader2 size={17} aria-hidden className="animate-spin" /> : <Icon size={17} aria-hidden />}
      {label}
    </button>
  );
}

function AccountNavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Heart; label: string; onClick: () => void }) {
  return (
    <button
      className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold ${active ? "bg-[#191816] text-white" : "bg-[#f7f6f2] text-zinc-800"}`}
      type="button"
      onClick={onClick}
    >
      <Icon size={16} aria-hidden />
      {label}
    </button>
  );
}

function EmptyState({ icon: Icon, text, title }: { icon: typeof Heart; text: string; title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center md:col-span-2">
      <Icon className="mx-auto text-zinc-400" size={26} aria-hidden />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600">{text}</p>
    </div>
  );
}

function Notice({ text, tone }: { text: string; tone: "success" | "error" }) {
  return (
    <div className={`mt-4 rounded-lg border p-3 text-sm font-medium ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
      {text}
    </div>
  );
}

function formValues(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of new FormData(form).entries()) {
    values[key] = typeof value === "string" ? value : value.name;
  }
  return values;
}

function withDebugCode(message: string, data: AccountResponse): string {
  return data.devCode ? `${message} Codice locale: ${data.devCode}` : message;
}

function withResetToken(message: string, data: AccountResponse): string {
  return data.devToken ? `${message} Token locale: ${data.devToken}` : message;
}

function redirectToReturn(): boolean {
  if (typeof window === "undefined") return false;
  const returnTo = new URLSearchParams(window.location.search).get("return");
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) return false;
  window.location.assign(returnTo);
  return true;
}
