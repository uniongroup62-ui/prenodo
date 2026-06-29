"use client";

import { useCallback, useEffect, useState } from "react";

// Faithful port of the PHP locations list page (app/pages/locations.php), fed by
// the existing DB-backed /api/manage/locations.
//
// NOTE: the PHP page also renders two large Bootstrap modals (locationModal /
// locationMarketplaceModal) driven by assets/js/pages/locations.js and the
// inline #locationsPageConfig JSON. The list API does not expose that data
// (per-location categories, gallery, legal address, etc.), so the editing
// modals stay on the legacy app. The "Modifica"/"Marketplace"/"Elimina"/"Nuova"
// controls below point back to the legacy page so they keep working.

type Location = {
  id: number;
  name: string;
  address?: string;
  city?: string;
  area?: string;
  phone?: string;
  bookingEnabled?: boolean;
  marketplaceEnabled?: boolean;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

export function LocationsContent() {
  const slug = tenantSlug();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/manage/locations?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j) => setLocations(Array.isArray(j.locations) ? j.locations : []))
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  function href(suffix: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=locations${suffix}`;
  }
  function pageHref(page: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=${page}`;
  }

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/locations.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Impostazioni</div>
          <h1 className="bs-page-title">Sedi</h1>
          <div className="bs-page-subtitle">Crea e gestisci le tue sedi e la visibilita.</div>
        </div>
        <div className="bs-page-actions">
          <a className="btn btn-outline-secondary btn-pill" href={pageHref("hours")}>
            <i className="bi bi-clock-history me-1" />
            Orari
          </a>
          <a className="btn btn-outline-secondary btn-pill" href={pageHref("booking")}>
            <i className="bi bi-link-45deg me-1" />
            Booking
          </a>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div>
                <div className="fw-semibold">Elenco sedi</div>
              </div>
              <a className="btn btn-sm btn-primary" href={href("&action=new")}>
                <i className="bi bi-plus-lg me-1" />
                Nuova
              </a>
            </div>
            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Sede</th>
                    <th>Contatti</th>
                    <th>Booking</th>
                    <th>Marketplace</th>
                    <th>Categorie attive</th>
                    <th className="text-center">Ordine</th>
                    <th className="text-end">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-muted small p-3">
                        {loading ? "Caricamento…" : "Nessuna sede."}
                      </td>
                    </tr>
                  ) : (
                    locations.map((location, index) => (
                      <tr key={location.id}>
                        <td>
                          <div className="fw-semibold">{location.name}</div>
                          {location.address ? <div className="small text-muted">{location.address}</div> : null}
                        </td>
                        <td className="small">
                          {location.phone ? <div>{location.phone}</div> : null}
                        </td>
                        <td>
                          {location.bookingEnabled ? (
                            <span className="badge text-bg-success">Visibile</span>
                          ) : (
                            <span className="badge text-bg-secondary">Nascosto</span>
                          )}
                        </td>
                        <td>
                          {location.marketplaceEnabled ? (
                            <span className="badge text-bg-success">Visibile</span>
                          ) : (
                            <span className="badge text-bg-secondary">Nascosto</span>
                          )}
                        </td>
                        <td className="small">—</td>
                        <td className="text-center">
                          <div className="d-inline-flex gap-1">
                            <a
                              className={`btn btn-sm btn-outline-secondary${index === 0 ? " disabled" : ""}`}
                              href={href(`&action=location_move&id=${location.id}&direction=up`)}
                              title="Sposta su"
                              aria-disabled={index === 0 ? true : undefined}
                            >
                              <i className="bi bi-arrow-up" />
                            </a>
                            <a
                              className={`btn btn-sm btn-outline-secondary${index === locations.length - 1 ? " disabled" : ""}`}
                              href={href(`&action=location_move&id=${location.id}&direction=down`)}
                              title="Sposta giu"
                              aria-disabled={index === locations.length - 1 ? true : undefined}
                            >
                              <i className="bi bi-arrow-down" />
                            </a>
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="d-inline-flex gap-1">
                            <a className="btn btn-sm btn-outline-secondary" href={href(`&action=edit&id=${location.id}`)}>
                              Modifica
                            </a>
                            <a
                              className="btn btn-sm btn-outline-secondary"
                              href={href(`&action=marketplace&id=${location.id}`)}
                            >
                              Marketplace
                            </a>
                            <a className="btn btn-sm btn-danger" href={href(`&action=delete_preview&id=${location.id}`)}>
                              Elimina
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
