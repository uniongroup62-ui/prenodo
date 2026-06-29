"use client";

import type { FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  Clock3,
  Heart,
  Loader2,
  MapPin,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import {
  centerBySlug,
  centerServices,
  galleryImages,
  locationsByTenant,
  products,
} from "@/lib/demo-data";

type PublicLocation = {
  id: number;
  name: string;
  address: string;
  phone: string;
  hoursToday: string;
};

type PublicService = {
  id: number;
  name: string;
  description: string;
  categoryId: number | null;
  duration: number;
  price: number;
  locationIds: number[];
};

type PublicStaff = {
  id: number;
  name: string;
  serviceIds: number[];
};

type PublicContext = {
  business: {
    name: string;
    about: string;
    phone: string;
    email: string;
  };
  locations: PublicLocation[];
  services: PublicService[];
  staff: PublicStaff[];
};

type PublicSlot = {
  time: string;
  available: boolean;
  staffId: number | null;
  staffName: string;
};

type PublicHold = {
  token: string;
  staffId: number | null;
  staffName: string;
  expiresAt: string;
};

export function PublicCenterPage({ slug = "centroesteticoelite" }: { slug?: string }) {
  const demoCenter = centerBySlug(slug) ?? centerBySlug("centroesteticoelite")!;
  const fallbackContext = useMemo(() => buildFallbackContext(slug), [slug]);
  const [context, setContext] = useState<PublicContext>(fallbackContext);
  const [selectedServiceId, setSelectedServiceId] = useState(() => fallbackContext.services[0]?.id ?? 0);
  const [selectedLocationId, setSelectedLocationId] = useState(() => fallbackContext.locations[0]?.id ?? 0);
  const [selectedStaffId, setSelectedStaffId] = useState<number | "any">("any");
  const [selectedDate, setSelectedDate] = useState(todayIsoLocal());
  const [availableSlots, setAvailableSlots] = useState<PublicSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [hold, setHold] = useState<PublicHold | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [favoriteKeys, setFavoriteKeys] = useState<Record<string, boolean>>({});
  const [pendingFavorite, setPendingFavorite] = useState(false);
  const [error, setError] = useState("");

  const selectedService = context.services.find((item) => item.id === selectedServiceId) ?? context.services[0];
  const selectedLocation = context.locations.find((item) => item.id === selectedLocationId) ?? context.locations[0];
  const filteredServices = useMemo(
    () => context.services.filter((service) => service.locationIds.length === 0 || service.locationIds.includes(selectedLocationId)),
    [context.services, selectedLocationId],
  );
  const dateOptions = useMemo(() => buildDateOptions(), []);
  const selectedStaffName = selectedStaffId === "any"
    ? hold?.staffName || availableSlots.find((item) => item.time === selectedSlot)?.staffName || "Qualsiasi professionista"
    : context.staff.find((staff) => staff.id === selectedStaffId)?.name ?? "Professionista";
  const favoriteKey = favoriteKeyFor(slug, selectedLocationId);
  const favorite = !!favoriteKeys[favoriteKey];

  useEffect(() => {
    let active = true;

    async function loadContext() {
      try {
        const response = await fetch(`/api/booking?slug=${encodeURIComponent(slug)}`);
        const data = await response.json();
        if (!active) return;
        const nextContext = data.ok && data.context ? data.context as PublicContext : fallbackContext;
        setContext(nextContext);
        setSelectedLocationId((current) => nextContext.locations.some((location) => location.id === current) ? current : nextContext.locations[0]?.id ?? 0);
        setSelectedServiceId((current) => nextContext.services.some((service) => service.id === current) ? current : nextContext.services[0]?.id ?? 0);
        setError("");
      } catch {
        if (active) {
          setContext(fallbackContext);
          setError("Profilo online non disponibile. Sto usando i dati locali.");
        }
      }
    }

    void loadContext();
    return () => {
      active = false;
    };
  }, [fallbackContext, slug]);

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

  useEffect(() => {
    let active = true;

    async function loadSlots() {
      if (!selectedServiceId || !selectedLocationId) {
        setAvailableSlots([]);
        return;
      }
      const params = new URLSearchParams({
        slug,
        action: "slots",
        date: selectedDate,
        service_ids: String(selectedServiceId),
        location_id: String(selectedLocationId),
      });
      if (selectedStaffId !== "any") params.set("staff_id", String(selectedStaffId));
      setLoadingSlots(true);
      setSelectedSlot("");
      setHold(null);
      try {
        const response = await fetch(`/api/booking?${params.toString()}`);
        const data = await response.json();
        if (!active) return;
        if (!data.ok) throw new Error(data.error || "Orari non disponibili.");
        setAvailableSlots(data.slots ?? []);
        setError("");
      } catch (caught) {
        if (active) {
          setAvailableSlots([]);
          setError(caught instanceof Error ? caught.message : "Orari non disponibili.");
        }
      } finally {
        if (active) setLoadingSlots(false);
      }
    }

    void loadSlots();
    return () => {
      active = false;
    };
  }, [selectedDate, selectedLocationId, selectedServiceId, selectedStaffId, slug]);

  function chooseLocation(id: number) {
    setSelectedLocationId(id);
    setSelectedServiceId((current) => {
      const allowed = context.services.filter((service) => service.locationIds.length === 0 || service.locationIds.includes(id));
      return allowed.some((service) => service.id === current) ? current : allowed[0]?.id ?? 0;
    });
  }

  async function chooseSlot(slot: PublicSlot) {
    if (!slot.available || !selectedService) return;
    setSelectedSlot(slot.time);
    setHold(null);
    try {
      const staffId = selectedStaffId === "any" ? slot.staffId : selectedStaffId;
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "hold",
          slug,
          date: selectedDate,
          time: slot.time,
          service_ids: String(selectedService.id),
          staff_id: staffId ?? "",
          location_id: selectedLocationId,
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Orario non piu disponibile.");
      setHold(data.hold);
      setError("");
    } catch (caught) {
      setSelectedSlot("");
      setError(caught instanceof Error ? caught.message : "Orario non piu disponibile.");
    }
  }

  async function requestBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService || !selectedSlot || !name.trim()) return;
    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          slug,
          date: selectedDate,
          time: selectedSlot,
          service_ids: String(selectedService.id),
          staff_id: hold?.staffId ?? (selectedStaffId === "any" ? "" : selectedStaffId),
          location_id: selectedLocationId,
          hold_token: hold?.token ?? "",
          client_name: name,
          client_phone: phone,
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Richiesta non inviata.");
      setSent(true);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Richiesta non inviata.");
    }
  }

  function shareProfile() {
    const shareUrl = `${window.location.origin}/attivita/${slug}`;
    if (navigator.share) {
      navigator.share({ title: context.business.name, url: shareUrl }).catch(() => undefined);
      return;
    }
    navigator.clipboard?.writeText(shareUrl);
  }

  async function toggleFavorite() {
    if (!selectedLocationId) return;
    setPendingFavorite(true);
    setFavoriteKeys((current) => ({ ...current, [favoriteKey]: !current[favoriteKey] }));
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "toggle_favorite",
          tenant_slug: slug,
          location_id: selectedLocationId,
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
      setFavoriteKeys((current) => ({ ...current, [favoriteKey]: !current[favoriteKey] }));
    } finally {
      setPendingFavorite(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#191816]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link
            className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-semibold transition hover:border-zinc-900"
            href="/attivita"
          >
            <ArrowLeft size={16} aria-hidden />
            Attivita
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
              <Star size={14} aria-hidden />
              {demoCenter.rating}
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-700">
              {demoCenter.reviews} recensioni
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-700">{selectedLocation?.address || demoCenter.area}</span>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
            <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-900">
              <Image
                src={demoCenter.image}
                alt={context.business.name}
                fill
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
              />
              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute right-4 top-4 flex gap-2">
                <button
                  aria-label={favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
                  className="flex h-10 w-10 items-center justify-center rounded-md bg-white/95 text-zinc-800 shadow-sm"
                  type="button"
                  disabled={pendingFavorite}
                  onClick={() => void toggleFavorite()}
                >
                  {pendingFavorite ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Heart fill={favorite ? "currentColor" : "none"} size={18} aria-hidden />}
                </button>
                <button
                  aria-label="Condividi scheda"
                  className="flex h-10 w-10 items-center justify-center rounded-md bg-white/95 text-zinc-800 shadow-sm"
                  type="button"
                  onClick={shareProfile}
                >
                  <Share2 size={18} aria-hidden />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white sm:p-7">
                <p className="mb-3 inline-flex items-center gap-2 rounded-md bg-white/90 px-3 py-1 text-sm font-semibold text-[#191816]">
                  <Sparkles size={16} aria-hidden />
                  {demoCenter.category}
                </p>
                <h1 className="max-w-2xl text-4xl font-semibold tracking-normal sm:text-5xl">
                  {context.business.name}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-white/90 sm:text-lg">
                  {context.business.about || "Trattamenti, sedi pubblicate e prenotazione online collegata al gestionale."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              {galleryImages.map((image, index) => (
                <div
                  className="relative h-28 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 lg:h-full"
                  key={image}
                >
                  <Image
                    src={image}
                    alt={`Ambiente ${context.business.name} ${index + 1}`}
                    fill
                    sizes="(min-width: 1024px) 28vw, 33vw"
                  />
                </div>
              ))}
            </div>
          </div>

          <section className="grid gap-3 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Conferma rapida", text: "Richieste gestite dal gestionale" },
              { icon: CalendarCheck, title: "Slot online", text: `${availableSlots.filter((item) => item.available).length} orari disponibili` },
              {
                icon: MapPin,
                title: selectedLocation?.name ?? "Sede principale",
                text: selectedLocation?.address ?? demoCenter.area,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article className="rounded-lg border border-zinc-200 bg-white p-4" key={item.title}>
                  <Icon size={20} aria-hidden className="text-emerald-700" />
                  <h2 className="mt-3 font-semibold">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{item.text}</p>
                </article>
              );
            })}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">Sedi</h2>
              <span className="text-sm font-medium text-zinc-500">{context.locations.length} pubblicata/e</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {context.locations.map((location) => (
                <article className="rounded-lg bg-[#f7f6f2] p-4" key={location.id}>
                  <h3 className="font-semibold">{location.name}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{location.address || "Indirizzo non disponibile"}</p>
                  <p className="mt-2 text-sm font-medium text-emerald-700">{location.hoursToday}</p>
                  <button
                    className="mt-4 inline-flex h-10 items-center rounded-md bg-[#191816] px-3 text-sm font-semibold text-white"
                    type="button"
                    onClick={() => chooseLocation(location.id)}
                  >
                    Prenota in questa sede
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Servizi</h2>
              <span className="text-sm font-medium text-zinc-500">{context.services.length} prenotabile/i</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {filteredServices.map((item) => (
                <button
                  className={`rounded-lg border bg-white p-4 text-left transition ${
                    selectedServiceId === item.id
                      ? "border-[#191816] shadow-sm"
                      : "border-zinc-200 hover:border-zinc-900"
                  }`}
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedServiceId(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description || "Trattamento prenotabile online"}</p>
                    </div>
                    {selectedServiceId === item.id ? <Check size={18} aria-hidden className="text-emerald-700" /> : null}
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-sm font-medium text-zinc-600">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 size={15} aria-hidden />
                      {item.duration} min
                    </span>
                    <span>{formatEuro(item.price)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Prodotti in evidenza</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {products.map((product) => (
                <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white" key={product.id}>
                  <div className="relative h-40">
                    <Image src={product.image} alt={product.name} fill sizes="(min-width: 768px) 30vw, 100vw" />
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-semibold uppercase text-zinc-500">{product.category}</p>
                    <h3 className="mt-2 font-semibold">{product.name}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{product.brand}</p>
                    <p className="mt-3 text-sm font-semibold">{product.price}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-5 lg:self-start">
          <form className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm" onSubmit={requestBooking}>
            <h2 className="text-2xl font-semibold">Prenota</h2>
            {selectedService ? (
              <div className="mt-4 rounded-lg bg-[#f7f6f2] p-4">
                <p className="font-semibold">{selectedService.name}</p>
                <p className="mt-1 text-sm text-zinc-600">
                  {selectedService.duration} min - {formatEuro(selectedService.price)}
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {error}
              </div>
            ) : null}

            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium text-zinc-600">Servizio</span>
              <select
                className="h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900"
                value={selectedServiceId}
                onChange={(event) => setSelectedServiceId(Number(event.target.value))}
              >
                {filteredServices.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium text-zinc-600">Sede</span>
              <select
                className="h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900"
                value={selectedLocationId}
                onChange={(event) => chooseLocation(Number(event.target.value))}
              >
                {context.locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </label>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-600">Professionista</span>
                <select
                  className="h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900"
                  value={selectedStaffId}
                  onChange={(event) => setSelectedStaffId(event.target.value === "any" ? "any" : Number(event.target.value))}
                >
                  <option value="any">Qualsiasi</option>
                  {context.staff.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-600">Giorno</span>
                <select
                  className="h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                >
                  {dateOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-zinc-600">Orario</p>
              {loadingSlots ? (
                <div className="flex h-10 items-center gap-2 text-sm text-zinc-600">
                  <Loader2 size={16} aria-hidden className="animate-spin" />
                  Caricamento
                </div>
              ) : null}
              <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto pr-1">
                {availableSlots.map((item) => (
                  <button
                    className={`h-10 rounded-md border text-sm font-semibold transition ${
                      selectedSlot === item.time
                        ? "border-[#191816] bg-[#191816] text-white"
                        : item.available
                          ? "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900"
                          : "cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-400"
                    }`}
                    disabled={!item.available}
                    key={item.time}
                    type="button"
                    onClick={() => chooseSlot(item)}
                  >
                    {item.time}
                  </button>
                ))}
              </div>
              {!loadingSlots && !availableSlots.length ? (
                <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">Nessun orario disponibile.</p>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-600">Nome</span>
                <input
                  className="h-11 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-900"
                  placeholder="Il tuo nome"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-600">Telefono</span>
                <input
                  className="h-11 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-900"
                  placeholder="+39"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>
            </div>

            <button
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#191816] px-4 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedSlot || !name.trim()}
            >
              <Send size={17} aria-hidden />
              Richiedi prenotazione
            </button>

            <Link
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-md border border-zinc-200 px-4 text-sm font-semibold transition hover:border-zinc-900"
              href={`/${slug}/booking?start=1&service=${encodeURIComponent(selectedService?.name ?? "")}&location_id=${selectedLocationId}`}
            >
              Apri wizard completo
            </Link>

            {sent ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                Richiesta inviata per {selectedSlot} con {selectedStaffName}.
              </div>
            ) : null}
          </form>
        </aside>
      </section>
    </main>
  );
}

function buildFallbackContext(slug: string): PublicContext {
  const center = centerBySlug(slug) ?? centerBySlug("centroesteticoelite")!;
  const locations = locationsByTenant(center.slug);
  return {
    business: {
      name: center.name,
      about: center.category,
      phone: locations[0]?.phone ?? "",
      email: "",
    },
    locations: locations.map((location) => ({
      id: location.id,
      name: location.name,
      address: [location.address, location.city].filter(Boolean).join(", "),
      phone: location.phone,
      hoursToday: location.hoursToday,
    })),
    services: centerServices.map((service, index) => ({
      id: index + 1,
      name: service.name,
      description: service.description,
      categoryId: null,
      duration: parseMinutes(service.duration),
      price: parseMoney(service.price),
      locationIds: locations.map((location) => location.id),
    })),
    staff: ["Marta", "Sara", "Nora"].map((name, index) => ({
      id: index + 1,
      name,
      serviceIds: centerServices.map((_, serviceIndex) => serviceIndex + 1),
    })),
  };
}

function buildDateOptions(): Array<{ label: string; value: string }> {
  const labels = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      value: dateIsoLocal(date),
      label: index === 0 ? "Oggi" : index === 1 ? "Domani" : `${labels[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`,
    };
  });
}

function parseMinutes(value: string): number {
  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 30;
}

function parseMoney(value: string): number {
  const match = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : 0;
}

function formatEuro(value: number): string {
  return `${Math.round(value * 100) / 100} euro`;
}

function todayIsoLocal(): string {
  return dateIsoLocal(new Date());
}

function dateIsoLocal(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function favoriteKeyFor(tenantSlug: string, locationId: number): string {
  return `${tenantSlug.trim().toLowerCase()}:${Math.max(0, Number(locationId) || 0)}`;
}
