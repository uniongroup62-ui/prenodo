"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  Loader2,
  MapPin,
  Search,
  Share2,
  Sparkles,
  Star,
  Store,
} from "lucide-react";
type MarketplaceProfile = {
  slug: string;
  name: string;
  category: string;
  area: string;
  rating: string;
  reviews: number;
  nextSlot: string;
  priceFrom: string;
  image: string;
  services: string[];
  locations: Array<{
    id: number;
    name: string;
    city: string;
    area: string;
    address: string;
  }>;
};

export function PublicMarketplace({ resultsOnly = false }: { resultsOnly?: boolean }) {
  // Purely DB-backed: profiles/categories come from /api/marketplace. No demo
  // seed data — start empty and render the real published tenants once loaded.
  const [profiles, setProfiles] = useState<MarketplaceProfile[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [favoriteKeys, setFavoriteKeys] = useState<Record<string, boolean>>({});
  const [pendingFavoriteKey, setPendingFavoriteKey] = useState("");

  useEffect(() => {
    let active = true;

    async function loadMarketplace() {
      try {
        const response = await fetch("/api/marketplace");
        const data = await response.json();
        if (!active) return;
        if (!data.ok) throw new Error("Marketplace non disponibile.");
        setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
      } catch {
        if (active) {
          setProfiles([]);
          setCategories([]);
        }
      }
    }

    void loadMarketplace();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadFavorites() {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        const data = await response.json();
        if (active && data.ok) setFavoriteKeys(data.favoriteKeys ?? {});
      } catch {
      }
    }

    void loadFavorites();
    return () => {
      active = false;
    };
  }, []);

  const filteredProfiles = useMemo(() => {
    const needle = [query, category].join(" ").trim().toLowerCase();
    const cityNeedle = city.trim().toLowerCase();

    return profiles.filter((profile) => {
      const text = [
        profile.name,
        profile.category,
        profile.area,
        ...profile.services,
        ...profile.locations.map((location) => `${location.name} ${location.city} ${location.area} ${location.address}`),
      ]
        .join(" ")
        .toLowerCase();
      const cityText = profile.locations.map((location) => `${location.city} ${location.area}`).join(" ").toLowerCase();

      return (
        (needle === "" || text.includes(needle)) &&
        (cityNeedle === "" || cityText.includes(cityNeedle))
      );
    });
  }, [category, city, profiles, query]);

  async function toggleFavorite(profile: MarketplaceProfile) {
    const location = profile.locations[0];
    if (!location?.id) return;

    const key = favoriteKeyFor(profile.slug, location.id);
    setPendingFavoriteKey(key);
    setFavoriteKeys((current) => ({ ...current, [key]: !current[key] }));

    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "toggle_favorite",
          tenant_slug: profile.slug,
          location_id: location.id,
        }),
      });
      if (response.status === 401) {
        window.location.assign(`/account/login?return=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Preferito non aggiornato.");
      setFavoriteKeys(data.favoriteKeys ?? { [data.key]: data.active });
    } catch {
      setFavoriteKeys((current) => ({ ...current, [key]: !current[key] }));
    } finally {
      setPendingFavoriteKey("");
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#191816]">
      <MarketplaceTopbar />

      {!resultsOnly ? (
        <section className="bg-[#191816] text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
            <div className="min-w-0 self-center">
              <p className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1 text-sm font-semibold">
                <Sparkles size={16} aria-hidden />
                Marketplace BeautySuite
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-normal sm:text-6xl">
                Prenota nelle attivita disponibili
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-white/80">
                Cerca un centro per citta, trattamento o categoria e apri subito la prenotazione online.
              </p>
              <MarketplaceSearch
                categories={categories}
                category={category}
                city={city}
                query={query}
                setCategory={setCategory}
                setCity={setCity}
                setQuery={setQuery}
              />
            </div>
            <div className="relative min-h-[320px] overflow-hidden rounded-lg border border-white/10 bg-white/5">
              <Image
                src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80"
                alt="Marketplace beauty"
                fill
                priority
                sizes="(min-width: 1024px) 34vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-white/92 p-4 text-[#191816]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white">
                    <CalendarDays size={19} aria-hidden />
                  </div>
                  <div>
                    <p className="font-semibold">{profiles.length} attivita pubblicate</p>
                    <p className="text-sm text-zinc-600">Sedi e servizi sincronizzati dal gestionale</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-semibold">Attivita</h1>
            <MarketplaceSearch
              categories={categories}
              category={category}
              city={city}
              query={query}
              setCategory={setCategory}
              setCity={setCity}
              setQuery={setQuery}
            />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Le nostre attivita</h2>
            <p className="mt-1 text-sm text-zinc-600">{filteredProfiles.length} risultato/i disponibili</p>
          </div>
          <Link
            className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold transition hover:border-zinc-900"
            href="/manage/register"
          >
            Diventa partner
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto">
          <button
            className={`h-10 shrink-0 rounded-md border px-3 text-sm font-semibold ${
              category === "" ? "border-[#191816] bg-[#191816] text-white" : "border-zinc-200 bg-white"
            }`}
            type="button"
            onClick={() => setCategory("")}
          >
            Tutti
          </button>
          {categories.map((item) => (
            <button
              className={`h-10 shrink-0 rounded-md border px-3 text-sm font-semibold ${
                category === item ? "border-[#191816] bg-[#191816] text-white" : "border-zinc-200 bg-white"
              }`}
              key={item}
              type="button"
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {filteredProfiles.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProfiles.map((profile) => (
              <MarketplaceCard
                favorite={!!favoriteKeys[favoriteKeyFor(profile.slug, profile.locations[0]?.id ?? 0)]}
                key={profile.slug}
                onFavorite={() => void toggleFavorite(profile)}
                pending={pendingFavoriteKey === favoriteKeyFor(profile.slug, profile.locations[0]?.id ?? 0)}
                profile={profile}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center">
            <h3 className="text-lg font-semibold">Nessuna attivita trovata</h3>
            <p className="mt-2 text-sm text-zinc-600">Modifica citta, servizio o categoria.</p>
          </div>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg bg-emerald-700 p-6 text-white">
            <h2 className="text-2xl font-semibold">Area cliente</h2>
            <p className="mt-2 max-w-lg text-white/85">Prenota il tuo prossimo trattamento e salva le tue attivita preferite.</p>
            <Link className="mt-5 inline-flex h-10 items-center rounded-md bg-white px-4 text-sm font-semibold text-emerald-800" href="/account/activities">
              Accedi
            </Link>
          </section>
          <section className="rounded-lg bg-[#191816] p-6 text-white">
            <h2 className="text-2xl font-semibold">Hai una attivita di bellezza?</h2>
            <p className="mt-2 max-w-lg text-white/80">Crea il gestionale, configura sedi e operatori, pubblica il profilo sul marketplace.</p>
            <Link className="mt-5 inline-flex h-10 items-center rounded-md bg-white px-4 text-sm font-semibold text-[#191816]" href="/manage/register">
              Crea gestionale
            </Link>
          </section>
        </div>
      </section>
    </main>
  );
}

function MarketplaceTopbar() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-3" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#191816] text-white">
            <Store size={19} aria-hidden />
          </span>
          <span className="text-lg font-semibold">BeautySuite</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link className="hidden h-10 items-center rounded-md px-3 text-sm font-semibold text-zinc-600 transition hover:text-zinc-950 sm:inline-flex" href="/attivita">
            Attivita
          </Link>
          <Link className="hidden h-10 items-center rounded-md px-3 text-sm font-semibold text-zinc-600 transition hover:text-zinc-950 sm:inline-flex" href="/account/activities">
            Account
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md bg-[#191816] px-3 text-sm font-semibold text-white" href="/manage/login">
            Gestionale
          </Link>
        </nav>
      </div>
    </header>
  );
}

function MarketplaceSearch({
  categories,
  category,
  city,
  query,
  setCategory,
  setCity,
  setQuery,
}: {
  categories: string[];
  category: string;
  city: string;
  query: string;
  setCategory: (value: string) => void;
  setCity: (value: string) => void;
  setQuery: (value: string) => void;
}) {
  return (
    <div className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-[#191816] shadow-sm lg:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.7fr)_minmax(200px,0.8fr)_auto]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-3 text-zinc-400" size={18} aria-hidden />
        <input
          className="h-11 w-full rounded-md border border-zinc-200 pl-10 pr-3 text-sm outline-none transition focus:border-zinc-900"
          placeholder="Attivita o servizio"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <label className="relative block">
        <MapPin className="pointer-events-none absolute left-3 top-3 text-zinc-400" size={18} aria-hidden />
        <input
          className="h-11 w-full rounded-md border border-zinc-200 pl-10 pr-3 text-sm outline-none transition focus:border-zinc-900"
          placeholder="Citta"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
      </label>
      <select
        className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
      >
        <option value="">Tutte le categorie</option>
        {categories.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <Link
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#191816] px-4 text-sm font-semibold text-white"
        href="/attivita"
      >
        Cerca
        <ArrowRight size={16} aria-hidden />
      </Link>
    </div>
  );
}

function MarketplaceCard({
  favorite,
  onFavorite,
  pending,
  profile,
}: {
  favorite: boolean;
  onFavorite: () => void;
  pending: boolean;
  profile: MarketplaceProfile;
}) {
  const firstLocation = profile.locations[0];

  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="relative h-48">
        <Image src={profile.image} alt={profile.name} fill sizes="(min-width: 1280px) 30vw, 90vw" />
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            aria-label={favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
            className={`flex h-10 w-10 items-center justify-center rounded-md bg-white/95 shadow-sm ${
              favorite ? "text-rose-600" : "text-zinc-700"
            }`}
            type="button"
            disabled={pending}
            onClick={onFavorite}
          >
            {pending ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Heart fill={favorite ? "currentColor" : "none"} size={18} aria-hidden />}
          </button>
          <button
            aria-label="Condividi scheda"
            className="flex h-10 w-10 items-center justify-center rounded-md bg-white/95 text-zinc-700 shadow-sm"
            type="button"
            onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/attivita/${profile.slug}`)}
          >
            <Share2 size={18} aria-hidden />
          </button>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{profile.name}</h3>
            <p className="mt-1 text-sm text-zinc-600">{profile.category}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-sm font-semibold text-amber-800">
            <Star size={14} fill="currentColor" aria-hidden />
            {profile.rating}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-zinc-500">Dove</p>
            <p className="font-medium">{firstLocation ? [firstLocation.city, firstLocation.area].filter(Boolean).join(", ") || firstLocation.address : profile.area}</p>
          </div>
          <div>
            <p className="text-zinc-500">Sedi</p>
            <p className="font-medium">{profile.locations.length}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.services.map((service) => (
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700" key={service}>
              {service}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          <p className="text-sm font-semibold">{profile.priceFrom}</p>
          <div className="flex gap-2">
            <Link className="inline-flex h-10 items-center rounded-md border border-zinc-200 px-3 text-sm font-semibold" href={`/attivita/${profile.slug}`}>
              Scheda
            </Link>
            <Link className="inline-flex h-10 items-center rounded-md bg-[#191816] px-3 text-sm font-semibold text-white" href={`/${profile.slug}/booking?start=1`}>
              Prenota
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function favoriteKeyFor(tenantSlug: string, locationId: number): string {
  return `${tenantSlug.trim().toLowerCase()}:${Math.max(0, Number(locationId) || 0)}`;
}
