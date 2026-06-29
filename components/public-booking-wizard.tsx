"use client";

import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  Clock3,
  CreditCard,
  Gift,
  Loader2,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  bookingSteps,
  centerBySlug,
  centerServices,
  locationsByTenant,
  marketplaceCategories,
  operators,
} from "@/lib/demo-data";

type BookingLocation = {
  id: number;
  name: string;
  address: string;
  email: string;
  phone: string;
  bookingEnabled: boolean;
  hoursToday: string;
};

type BookingCategory = {
  id: number;
  name: string;
};

type BookingService = {
  id: number;
  name: string;
  description: string;
  categoryId: number | null;
  duration: number;
  price: number;
  noOperator: boolean;
  locationIds: number[];
};

type BookingStaff = {
  id: number;
  name: string;
  serviceIds: number[];
  active: boolean;
};

type BookingBenefit = {
  id: string;
  type: "coupon" | "promotion" | "giftcard";
  label: string;
  detail: string;
  code?: string;
  promotionId?: number;
  discountType?: "percent" | "fixed";
  discountValue?: number;
};

type BookingContext = {
  business: {
    name: string;
    about: string;
    email: string;
    phone: string;
    website: string;
  };
  locations: BookingLocation[];
  categories: BookingCategory[];
  services: BookingService[];
  staff: BookingStaff[];
  benefits: BookingBenefit[];
  today: string;
};

type BookingSlot = {
  time: string;
  available: boolean;
  staffId: number | null;
  staffName: string;
  reason: string;
};

type BookingHold = {
  token: string;
  expiresAt: string;
  date: string;
  time: string;
  staffId: number | null;
  staffName: string;
};

type BookingConfirmation = {
  id: number;
  publicCode: string;
  status: string;
  date: string;
  time: string;
  total: number;
  discount: number;
  staffId: number | null;
  locationId: number | null;
};

export function PublicBookingWizard({
  slug = "centroesteticoelite",
  initialLocationId,
  initialService,
}: {
  slug?: string;
  initialLocationId?: string;
  initialService?: string;
}) {
  const fallbackContext = useMemo(() => buildDemoContext(slug), [slug]);
  const [context, setContext] = useState<BookingContext>(fallbackContext);
  const [loadingContext, setLoadingContext] = useState(true);
  const [step, setStep] = useState(0);
  const [locationId, setLocationId] = useState(() => parsePositiveInt(initialLocationId) ?? fallbackContext.locations[0]?.id ?? 0);
  const [categoryId, setCategoryId] = useState<number | null>(() => fallbackContext.categories[0]?.id ?? null);
  const [serviceIds, setServiceIds] = useState<number[]>(() => initialServiceIds(fallbackContext, initialService));
  const [operatorId, setOperatorId] = useState<number | "any">("any");
  const [date, setDate] = useState(todayIsoLocal());
  const [slot, setSlot] = useState("");
  const [availableSlots, setAvailableSlots] = useState<BookingSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [benefitId, setBenefitId] = useState("none");
  const [hold, setHold] = useState<BookingHold | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  useEffect(() => {
    let active = true;

    async function loadContext() {
      setLoadingContext(true);
      try {
        const response = await fetch(`/api/booking?slug=${encodeURIComponent(slug)}`);
        const data = await response.json();
        if (!active) return;
        const nextContext = data.ok && data.context ? data.context as BookingContext : fallbackContext;
        setContext(nextContext);
        setLocationId((current) => {
          const initial = parsePositiveInt(initialLocationId);
          if (initial && nextContext.locations.some((location) => location.id === initial)) return initial;
          if (nextContext.locations.some((location) => location.id === current)) return current;
          return nextContext.locations[0]?.id ?? 0;
        });
        setCategoryId((current) => {
          if (current && nextContext.categories.some((category) => category.id === current)) return current;
          return nextContext.categories[0]?.id ?? null;
        });
        setServiceIds((current) => {
          const valid = current.filter((id) => nextContext.services.some((service) => service.id === id));
          if (valid.length) return valid;
          return initialServiceIds(nextContext, initialService);
        });
        setError("");
      } catch {
        if (active) {
          setContext(fallbackContext);
          setError("Dati online non disponibili. Sto usando i dati locali.");
        }
      } finally {
        if (active) setLoadingContext(false);
      }
    }

    void loadContext();
    return () => {
      active = false;
    };
  }, [fallbackContext, initialLocationId, initialService, slug]);

  const selectedLocation = context.locations.find((location) => location.id === locationId) ?? context.locations[0];
  const selectedServices = useMemo(
    () => context.services.filter((service) => serviceIds.includes(service.id)),
    [context.services, serviceIds],
  );
  const availableServices = useMemo(
    () => context.services.filter((service) => service.locationIds.length === 0 || service.locationIds.includes(locationId)),
    [context.services, locationId],
  );
  const visibleServices = useMemo(
    () => availableServices.filter((service) => !categoryId || service.categoryId === categoryId),
    [availableServices, categoryId],
  );
  const dateOptions = useMemo(() => buildDateOptions(), []);
  const selectedSlot = availableSlots.find((item) => item.time === slot);
  const selectedBenefit = context.benefits.find((item) => item.id === benefitId) ?? null;
  const selectedStaffId = operatorId === "any" ? hold?.staffId ?? selectedSlot?.staffId ?? null : operatorId;
  const selectedStaffName = operatorId === "any"
    ? hold?.staffName || selectedSlot?.staffName || "Qualsiasi professionista"
    : context.staff.find((staff) => staff.id === operatorId)?.name ?? "Professionista";
  const total = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const discount = estimatedDiscount(selectedBenefit, total);
  const finalTotal = Math.max(0, total - discount);
  const canContinue = canMoveForward(step, serviceIds, slot, customerName, customerEmail, slotsLoading, submitting);

  useEffect(() => {
    let active = true;

    async function loadSlots() {
      if (!serviceIds.length || !locationId) {
        setAvailableSlots([]);
        setSlot("");
        setHold(null);
        return;
      }

      const params = new URLSearchParams({
        slug,
        action: "slots",
        date,
        service_ids: serviceIds.join(","),
        location_id: String(locationId),
      });
      if (operatorId !== "any") params.set("staff_id", String(operatorId));

      setSlotsLoading(true);
      setSlot("");
      setHold(null);
      try {
        const response = await fetch(`/api/booking?${params.toString()}`);
        const data = await response.json();
        if (!active) return;
        if (!data.ok) throw new Error(data.error || "Disponibilita non disponibile.");
        setAvailableSlots(data.slots ?? []);
        setError("");
      } catch (caught) {
        if (active) {
          setAvailableSlots([]);
          setError(caught instanceof Error ? caught.message : "Disponibilita non disponibile.");
        }
      } finally {
        if (active) setSlotsLoading(false);
      }
    }

    void loadSlots();

    return () => {
      active = false;
    };
  }, [date, locationId, operatorId, serviceIds, slug]);

  function toggleService(id: number) {
    setServiceIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function chooseLocation(id: number) {
    setLocationId(id);
    setServiceIds((current) => {
      const allowedServices = context.services.filter((service) => service.locationIds.length === 0 || service.locationIds.includes(id));
      const allowed = current.filter((serviceId) => allowedServices.some((service) => service.id === serviceId));
      if (allowed.length) return allowed;
      return allowedServices[0] ? [allowedServices[0].id] : [];
    });
  }

  async function chooseSlot(item: BookingSlot) {
    if (!item.available) return;
    setSlot(item.time);
    setHold(null);
    setError("");

    try {
      const staffForHold = operatorId === "any" ? item.staffId : operatorId;
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "hold",
          slug,
          date,
          time: item.time,
          service_ids: serviceIds.join(","),
          staff_id: staffForHold ?? "",
          location_id: locationId,
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Orario non piu disponibile.");
      setHold(data.hold);
    } catch (caught) {
      setSlot("");
      setError(caught instanceof Error ? caught.message : "Orario non piu disponibile.");
    }
  }

  async function next() {
    if (step < bookingSteps.length - 1) {
      setStep((current) => Math.min(bookingSteps.length - 1, current + 1));
      return;
    }

    if (!canContinue) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          slug,
          location_id: locationId,
          service_ids: serviceIds.join(","),
          staff_id: selectedStaffId ?? "",
          date,
          time: slot,
          hold_token: hold?.token ?? "",
          client_name: customerName,
          client_email: customerEmail,
          client_phone: customerPhone,
          benefit_id: benefitId,
          coupon_code: selectedBenefit?.type === "coupon" ? selectedBenefit.code ?? selectedBenefit.label : "",
          promotion_id: selectedBenefit?.type === "promotion" ? selectedBenefit.promotionId ?? "" : "",
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Prenotazione non completata.");
      setConfirmation(data.confirmation);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Prenotazione non completata.");
    } finally {
      setSubmitting(false);
    }
  }

  function previous() {
    setStep((current) => Math.max(0, current - 1));
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#191816]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-semibold" href={`/attivita/${slug}`}>
            <ArrowLeft size={16} aria-hidden />
            Scheda attivita
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-700">Prenotazione online</p>
            <h1 className="text-2xl font-semibold">{context.business.name}</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-5 overflow-x-auto">
            <div className="flex min-w-max gap-2">
              {bookingSteps.map((item, index) => (
                <button
                  className={`h-10 rounded-md border px-3 text-sm font-semibold ${
                    step === index
                      ? "border-[#191816] bg-[#191816] text-white"
                      : index < step
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-zinc-200 bg-white text-zinc-600"
                  }`}
                  key={item}
                  type="button"
                  onClick={() => setStep(index)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {confirmation ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-600 text-white">
                <Check size={22} aria-hidden />
              </div>
              <h2 className="mt-5 text-3xl font-semibold">Richiesta inviata</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-900">
                La prenotazione {confirmation.publicCode} e in attesa di conferma per {confirmation.date} alle {confirmation.time}.
              </p>
              <Link className="mt-5 inline-flex h-10 items-center rounded-md bg-[#191816] px-4 text-sm font-semibold text-white" href={`/${slug}/dashboard`}>
                Apri gestionale
              </Link>
            </section>
          ) : (
            <>
              {error ? (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {error}
                </div>
              ) : null}

              {step === 0 ? (
                <StepCard icon={MapPin} title="Scegli una sede" description="Trova la sede piu comoda per il tuo appuntamento.">
                  {loadingContext ? <LoadingLine /> : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    {context.locations.map((location) => (
                      <button
                        className={`rounded-lg border p-4 text-left ${
                          locationId === location.id ? "border-[#191816] bg-[#f7f6f2]" : "border-zinc-200"
                        }`}
                        key={location.id}
                        type="button"
                        onClick={() => chooseLocation(location.id)}
                      >
                        <p className="font-semibold">{location.name}</p>
                        <p className="mt-1 text-sm text-zinc-600">{location.address || "Indirizzo non disponibile"}</p>
                        <p className="mt-2 text-sm font-medium text-emerald-700">{location.hoursToday}</p>
                      </button>
                    ))}
                  </div>
                </StepCard>
              ) : null}

              {step === 1 ? (
                <StepCard icon={CalendarPlus} title="Scegli una categoria" description="Filtra i servizi disponibili per questa sede.">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {context.categories.map((item) => (
                      <button
                        className={`min-h-12 rounded-md border px-3 py-2 text-sm font-semibold ${
                          categoryId === item.id ? "border-[#191816] bg-[#191816] text-white" : "border-zinc-200 bg-white"
                        }`}
                        key={item.id}
                        type="button"
                        onClick={() => setCategoryId(item.id)}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </StepCard>
              ) : null}

              {step === 2 ? (
                <StepCard icon={Clock3} title="Scegli uno o piu servizi" description="Puoi combinare piu trattamenti nello stesso appuntamento.">
                  <div className="grid gap-3 md:grid-cols-2">
                    {visibleServices.map((service) => (
                      <button
                        className={`rounded-lg border p-4 text-left ${
                          serviceIds.includes(service.id) ? "border-[#191816] bg-[#f7f6f2]" : "border-zinc-200"
                        }`}
                        key={service.id}
                        type="button"
                        onClick={() => toggleService(service.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{service.name}</p>
                            <p className="mt-1 text-sm text-zinc-600">{service.description || "Trattamento prenotabile online"}</p>
                          </div>
                          {serviceIds.includes(service.id) ? <Check size={18} aria-hidden className="text-emerald-700" /> : null}
                        </div>
                        <p className="mt-3 text-sm font-semibold">{service.duration} min - {formatEuro(service.price)}</p>
                      </button>
                    ))}
                  </div>
                  {!visibleServices.length ? <EmptyLine text="Nessun servizio disponibile per questa combinazione." /> : null}
                </StepCard>
              ) : null}

              {step === 3 ? (
                <StepCard icon={UserRound} title="Scegli il professionista" description="Se preferisci, puoi lasciare la scelta automatica.">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className={`h-12 rounded-md border px-3 text-sm font-semibold ${
                        operatorId === "any" ? "border-[#191816] bg-[#191816] text-white" : "border-zinc-200 bg-white"
                      }`}
                      type="button"
                      onClick={() => setOperatorId("any")}
                    >
                      Qualsiasi professionista
                    </button>
                    {context.staff.map((item) => (
                      <button
                        className={`h-12 rounded-md border px-3 text-sm font-semibold ${
                          operatorId === item.id ? "border-[#191816] bg-[#191816] text-white" : "border-zinc-200 bg-white"
                        }`}
                        key={item.id}
                        type="button"
                        onClick={() => setOperatorId(item.id)}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </StepCard>
              ) : null}

              {step === 4 ? (
                <StepCard icon={Clock3} title="Scegli data e orario" description="Gli orari disponibili tengono conto di sede, servizi e professionista.">
                  <div className="mb-4 flex gap-2 overflow-x-auto">
                    {dateOptions.map((item) => (
                      <button
                        className={`min-h-11 shrink-0 rounded-md border px-3 py-2 text-sm font-semibold ${
                          date === item.value ? "border-[#191816] bg-[#191816] text-white" : "border-zinc-200 bg-white"
                        }`}
                        key={item.value}
                        type="button"
                        onClick={() => setDate(item.value)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {slotsLoading ? <LoadingLine /> : null}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {availableSlots.map((item) => (
                      <button
                        className={`h-11 rounded-md border text-sm font-semibold ${
                          slot === item.time
                            ? "border-emerald-700 bg-emerald-700 text-white"
                            : item.available
                              ? "border-zinc-200 bg-white"
                              : "cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-400"
                        }`}
                        disabled={!item.available}
                        key={item.time}
                        type="button"
                        onClick={() => chooseSlot(item)}
                        title={item.reason}
                      >
                        {item.time}
                      </button>
                    ))}
                  </div>
                  {!slotsLoading && !availableSlots.length ? <EmptyLine text="Nessun orario disponibile per questa data." /> : null}
                  {hold ? (
                    <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                      Orario riservato fino alle {hold.expiresAt.slice(11, 16)}.
                    </div>
                  ) : null}
                </StepCard>
              ) : null}

              {step === 5 ? (
                <StepCard icon={Gift} title="Vantaggi cliente" description="Applica un eventuale beneficio prima della conferma.">
                  <div className="grid gap-3 md:grid-cols-3">
                    <BenefitButton
                      active={benefitId === "none"}
                      detail="Totale standard"
                      label="Nessun vantaggio"
                      onClick={() => setBenefitId("none")}
                    />
                    {context.benefits.map((benefit) => (
                      <BenefitButton
                        active={benefitId === benefit.id}
                        detail={benefit.detail}
                        key={benefit.id}
                        label={benefit.label}
                        onClick={() => setBenefitId(benefit.id)}
                      />
                    ))}
                  </div>
                </StepCard>
              ) : null}

              {step === 6 ? (
                <StepCard icon={ShieldCheck} title="Conferma" description="Inserisci i dati per inviare la richiesta.">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-zinc-600">Nome cliente</span>
                      <input className="h-11 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-900" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-zinc-600">Email</span>
                      <input className="h-11 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-900" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-sm font-medium text-zinc-600">Telefono</span>
                      <input className="h-11 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-900" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
                    </label>
                  </div>
                </StepCard>
              ) : null}
            </>
          )}
        </div>

        <aside className="rounded-lg border border-zinc-200 bg-white p-4 lg:sticky lg:top-5 lg:self-start">
          <h2 className="text-lg font-semibold">Riepilogo</h2>
          <div className="mt-4 space-y-3 text-sm">
            <SummaryRow label="Sede" value={selectedLocation?.name ?? "Da scegliere"} />
            <SummaryRow label="Categoria" value={context.categories.find((category) => category.id === categoryId)?.name ?? "Da scegliere"} />
            <SummaryRow label="Servizi" value={selectedServices.map((service) => service.name).join(", ") || "Da scegliere"} />
            <SummaryRow label="Operatore" value={selectedStaffName} />
            <SummaryRow label="Data/Ora" value={slot ? `${date} ${slot}` : date} />
            <SummaryRow label="Vantaggio" value={selectedBenefit?.label ?? "Nessuno"} />
          </div>
          <div className="mt-5 rounded-lg bg-[#f7f6f2] p-4">
            <p className="text-sm text-zinc-600">Prezzo totale</p>
            <p className="mt-1 text-2xl font-semibold">{formatEuro(finalTotal)}</p>
            {discount > 0 ? <p className="mt-1 text-sm text-emerald-700">Sconto {formatEuro(discount)}</p> : null}
          </div>
          <div className="mt-5 flex gap-2">
            <button className="h-11 flex-1 rounded-md border border-zinc-200 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={previous} disabled={step === 0 || Boolean(confirmation) || submitting}>
              Indietro
            </button>
            <button className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#191816] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={next} disabled={!canContinue || Boolean(confirmation)}>
              {submitting ? <Loader2 size={16} aria-hidden className="animate-spin" /> : null}
              {step === bookingSteps.length - 1 ? "Conferma" : "Avanti"}
              {!submitting ? <ArrowRight size={16} aria-hidden /> : null}
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function StepCard({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: ElementType;
  title: string;
}) {
  return (
    <section>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
          <Icon size={20} aria-hidden />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function BenefitButton({
  active,
  detail,
  label,
  onClick,
}: {
  active: boolean;
  detail: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-lg border p-4 text-left ${
        active ? "border-[#191816] bg-[#f7f6f2]" : "border-zinc-200 bg-white"
      }`}
      type="button"
      onClick={onClick}
    >
      <CreditCard size={18} aria-hidden className="text-emerald-700" />
      <p className="mt-3 font-semibold">{label}</p>
      <p className="mt-1 text-sm text-zinc-600">{detail}</p>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
      <span className="text-zinc-500">{label}</span>
      <span className="max-w-[190px] text-right font-semibold">{value}</span>
    </div>
  );
}

function LoadingLine() {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
      <Loader2 size={16} aria-hidden className="animate-spin" />
      Caricamento
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
      {text}
    </div>
  );
}

function buildDemoContext(slug: string): BookingContext {
  const center = centerBySlug(slug) ?? centerBySlug("centroesteticoelite")!;
  const locations = locationsByTenant(center.slug);
  const categories = marketplaceCategories.map((name, index) => ({ id: index + 1, name }));
  return {
    business: {
      name: center.name,
      about: center.category,
      email: "",
      phone: locations[0]?.phone ?? "",
      website: "",
    },
    locations: locations.map((location) => ({
      id: location.id,
      name: location.name,
      address: [location.address, location.city].filter(Boolean).join(", "),
      email: "",
      phone: location.phone,
      bookingEnabled: location.bookingEnabled,
      hoursToday: location.hoursToday,
    })),
    categories,
    services: centerServices.map((service, index) => ({
      id: index + 1,
      name: service.name,
      description: service.description,
      categoryId: categories[index % categories.length]?.id ?? 1,
      duration: parseMinutes(service.duration),
      price: parseMoney(service.price),
      noOperator: false,
      locationIds: locations.map((location) => location.id),
    })),
    staff: operators.map((name, index) => ({
      id: index + 1,
      name,
      serviceIds: centerServices.map((_, serviceIndex) => serviceIndex + 1),
      active: true,
    })),
    benefits: [
      {
        id: "coupon:demo",
        type: "coupon",
        label: "WELCOME10",
        detail: "10% di sconto",
        code: "WELCOME10",
        discountType: "percent",
        discountValue: 10,
      },
    ],
    today: todayIsoLocal(),
  };
}

function initialServiceIds(context: BookingContext, initialService?: string): number[] {
  const match = initialService
    ? context.services.find((service) => service.name.toLowerCase() === initialService.toLowerCase())
    : null;
  return [match?.id ?? context.services[0]?.id ?? 0].filter((id) => id > 0);
}

function buildDateOptions(): Array<{ label: string; value: string }> {
  const labels = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];
  return Array.from({ length: 10 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const value = dateIsoLocal(date);
    const label = index === 0
      ? "Oggi"
      : index === 1
        ? "Domani"
        : `${labels[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
    return { label, value };
  });
}

function canMoveForward(step: number, serviceIds: number[], slot: string, name: string, email: string, slotsLoading: boolean, submitting: boolean): boolean {
  if (submitting) return false;
  if (step === 2) return serviceIds.length > 0;
  if (step === 4) return Boolean(slot) && !slotsLoading;
  if (step === 6) return Boolean(name.trim()) && Boolean(email.trim()) && Boolean(slot);
  return true;
}

function estimatedDiscount(benefit: BookingBenefit | null, total: number): number {
  if (!benefit) return 0;
  const value = benefit.discountValue ?? 0;
  const amount = benefit.discountType === "fixed" ? value : total * (value / 100);
  return Math.max(0, Math.min(total, Math.round(amount * 100) / 100));
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
