"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Faithful port of the PHP "Orari & chiusure" settings page (app/pages/hours.php),
// reproducing the original Bootstrap markup verbatim: bs-page-header, nav-pills
// tabs (Orari / Chiusure / Straordinari), and the weekly hours card form with
// per-day main rows and (initially hidden) split rows.
//
// Data: the existing /api/manage/business-settings exposes the location list
// (used here for the active location_id) but does NOT expose the per-weekday
// business_hours / closures / exceptions rows. The form is therefore rendered
// with the PHP default-empty values; saving still posts to the legacy endpoint.

type ApiLocation = {
  id: number;
  name: string;
  isActive?: boolean;
};

// PHP renders days starting at DOW 0 = Domenica through DOW 6 = Sabato.
const DAYS: Array<{ dow: number; label: string }> = [
  { dow: 0, label: "Domenica" },
  { dow: 1, label: "Lunedì" },
  { dow: 2, label: "Martedì" },
  { dow: 3, label: "Mercoledì" },
  { dow: 4, label: "Giovedì" },
  { dow: 5, label: "Venerdì" },
  { dow: 6, label: "Sabato" },
];

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

export function HoursContent() {
  const slug = tenantSlug();
  const [locations, setLocations] = useState<ApiLocation[]>([]);
  const [locationId, setLocationId] = useState<number>(0);
  const [tab, setTab] = useState<"hours" | "closures" | "exceptions">("hours");

  const load = useCallback(() => {
    fetch(`/api/manage/business-settings?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => {
        const locs: ApiLocation[] = Array.isArray(j.locations) ? j.locations : [];
        setLocations(locs);
        setLocationId((prev) => (prev > 0 ? prev : Number(locs[0]?.id ?? 0)));
      })
      .catch(() => setLocations([]));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  function pageHref(suffix: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=hours${suffix}`;
  }

  function tabHref(target: "hours" | "closures" | "exceptions"): string {
    return pageHref(`&tab=${target}&location_id=${locationId}`);
  }

  const navLinkBase = "nav-link";

  return (
    <div className="container-fluid">
      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Impostazioni</div>
          <h1 className="bs-page-title">Orari &amp; chiusure</h1>
          <div className="bs-page-subtitle">Gestisci orari, chiusure e straordinari.</div>
        </div>
        <div className="bs-page-actions">
          <a className="btn btn-outline-primary" href={`/${encodeURIComponent(slug)}/index.php?page=settings`}>
            <i className="bi bi-building me-1" />
            Attivita
          </a>
        </div>
      </div>

      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <a
            className={`${navLinkBase} ${tab === "hours" ? "active" : ""}`}
            href={tabHref("hours")}
            onClick={(e) => {
              e.preventDefault();
              setTab("hours");
            }}
          >
            <i className="bi bi-clock me-1" />
            Orari
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`${navLinkBase} ${tab === "closures" ? "active" : ""}`}
            href={tabHref("closures")}
            onClick={(e) => {
              e.preventDefault();
              setTab("closures");
            }}
          >
            <i className="bi bi-calendar-x me-1" />
            Chiusure
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`${navLinkBase} ${tab === "exceptions" ? "active" : ""}`}
            href={tabHref("exceptions")}
            onClick={(e) => {
              e.preventDefault();
              setTab("exceptions");
            }}
          >
            <i className="bi bi-calendar2-week me-1" />
            Straordinari
          </a>
        </li>
      </ul>

      {tab === "hours" ? (
        <HoursTab locationId={locationId} />
      ) : (
        <PlaceholderTab href={tabHref(tab)} />
      )}
    </div>
  );
}

function HoursTab({ locationId }: { locationId: number }) {
  const rows = useMemo(() => DAYS, []);

  return (
    <div className="card p-3">
      <form method="post">
        <input type="hidden" name="location_id" value={locationId} />
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead>
              <tr>
                <th>Giorno</th>
                <th>Apertura</th>
                <th>Chiusura</th>
                <th className="text-nowrap">Orario spezzato</th>
                <th>Chiuso</th>
              </tr>
            </thead>
            <tbody id="hoursTable">
              {rows.map((day) => (
                <HoursRow key={day.dow} dow={day.dow} label={day.label} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 d-flex justify-content-end">
          <button className="btn btn-primary" type="submit">
            <i className="bi bi-check2-circle me-1" />
            Salva orari
          </button>
        </div>
      </form>
    </div>
  );
}

function HoursRow({ dow, label }: { dow: number; label: string }) {
  const [closed, setClosed] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  return (
    <>
      <tr className="hours-row" data-role="main" data-dow={dow}>
        <td className="fw-semibold">{label}</td>
        <td>
          <input className="form-control" type="time" name={`hours[${dow}][opens]`} defaultValue="" />
        </td>
        <td>
          <input className="form-control" type="time" name={`hours[${dow}][closes]`} defaultValue="" />
        </td>
        <td className="text-nowrap">
          <button
            type="button"
            className={`btn btn-sm btn-outline-secondary js-add-split ${splitOpen ? "d-none" : ""}`}
            data-dow={dow}
            onClick={() => setSplitOpen(true)}
          >
            <i className="bi bi-plus-lg me-1" />
            Aggiungi orario spezzato
          </button>
          <button
            type="button"
            className={`btn btn-sm btn-outline-danger js-remove-split ${splitOpen ? "" : "d-none"}`}
            data-dow={dow}
            onClick={() => setSplitOpen(false)}
          >
            <i className="bi bi-x-lg me-1" />
            Rimuovi
          </button>
        </td>
        <td>
          <div className="form-check">
            <input
              className="form-check-input js-closed"
              type="checkbox"
              name={`hours[${dow}][is_closed]`}
              data-dow={dow}
              checked={closed}
              onChange={(e) => setClosed(e.target.checked)}
            />
          </div>
        </td>
      </tr>
      <tr className={`split-row ${splitOpen ? "" : "d-none"}`} data-role="split" data-dow={dow}>
        <td></td>
        <td>
          <label className="form-label small text-muted mb-1">Riapertura</label>
          <input className="form-control" type="time" name={`hours[${dow}][opens2]`} defaultValue="" />
        </td>
        <td>
          <label className="form-label small text-muted mb-1">Chiusura 2</label>
          <input className="form-control" type="time" name={`hours[${dow}][closes2]`} defaultValue="" />
        </td>
        <td className="small text-muted">Orario spezzato</td>
        <td></td>
      </tr>
    </>
  );
}

function PlaceholderTab({ href }: { href: string }) {
  return (
    <div className="card p-3">
      <div className="text-muted small">
        Apri questa sezione nel gestionale.{" "}
        <a href={href}>Continua</a>
      </div>
    </div>
  );
}
