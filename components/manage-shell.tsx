"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Faithful port of the PHP gestionale chrome (app/lib/View.php): app-shell ->
// (app-sidebar + app-main -> (topbar + app-content)). Loads the SAME Bootstrap
// 5.3.3 + Bootstrap Icons + Chart.js + app.css the PHP dashboard uses.
// app.js behaviors (sidebar collapse, notifications polling, quick-booking
// drawer) are not wired yet.

type Item = { page: string; icon: string; label: string; sub?: boolean };
type Group = { label?: string; items: Item[] };

const MENU: Group[] = [
  {
    items: [
      { page: "dashboard", icon: "speedometer2", label: "Dashboard" },
      { page: "calendar", icon: "calendar-week", label: "Calendario" },
      { page: "appointments", icon: "list-task", label: "Appuntamenti" },
      { page: "appointments_plan", icon: "calendar2-plus", label: "Pianifica", sub: true },
      { page: "pos", icon: "credit-card", label: "Pagamenti" },
      { page: "pos_history", icon: "clock-history", label: "Movimenti", sub: true },
      { page: "pos_prepaids", icon: "wallet2", label: "Prepagati", sub: true },
      { page: "pos_preorders", icon: "bag-check", label: "Preordini", sub: true },
      { page: "pos_settings", icon: "gear", label: "Impostazioni", sub: true },
      { page: "installments_manage", icon: "cash-stack", label: "Gestione Rate" },
      { page: "costs", icon: "calendar2-check", label: "Scadenziario e Costi" },
      { page: "costs&tab=categories", icon: "tags", label: "Categorie", sub: true },
      { page: "commissions", icon: "percent", label: "Commissioni" },
      { page: "products", icon: "box-seam", label: "Magazzino" },
      { page: "products&action=categories", icon: "tags", label: "Categorie prodotti", sub: true },
      { page: "stock_moves", icon: "arrow-left-right", label: "Carico / Scarico", sub: true },
      { page: "suppliers", icon: "truck", label: "Fornitori" },
      { page: "coupons", icon: "ticket-perforated", label: "Buoni" },
      { page: "clients", icon: "people", label: "Clienti" },
      { page: "packages&tab=clients", icon: "layers", label: "Pacchetti" },
      { page: "quotes", icon: "file-earmark-text", label: "Preventivi" },
      { page: "giftbox", icon: "box", label: "GiftBox" },
      { page: "giftbox_settings", icon: "gear", label: "Impostazioni", sub: true },
      { page: "giftcard", icon: "credit-card-2-front", label: "GiftCard" },
      { page: "giftcard_settings", icon: "gear", label: "Impostazioni", sub: true },
    ],
  },
  {
    label: "Fidelizzazione",
    items: [
      { page: "fidelity", icon: "award", label: "Fidelity" },
      { page: "fidelity_membership", icon: "person-check", label: "Adesione", sub: true },
      { page: "recharges", icon: "arrow-repeat", label: "Ricariche" },
      { page: "wallet", icon: "wallet2", label: "Portafoglio" },
      { page: "promotions", icon: "megaphone", label: "Promozioni" },
      { page: "fidelity_points", icon: "coin", label: "Punti" },
      { page: "fidelity_points#livelli-card", icon: "stars", label: "Livelli Card", sub: true },
      { page: "gifts", icon: "gift", label: "Omaggi" },
    ],
  },
  {
    label: "Risorse",
    items: [
      { page: "resources", icon: "boxes", label: "Risorse" },
      { page: "services&tab=services", icon: "stars", label: "Servizi" },
      { page: "services&tab=categories", icon: "tags", label: "Categorie servizi", sub: true },
      { page: "services&tab=recommended", icon: "stars", label: "Servizi consigliati", sub: true },
      { page: "cabins", icon: "door-open", label: "Cabine" },
      { page: "staff", icon: "person-badge", label: "Operatori" },
      { page: "staff_availability", icon: "calendar-week", label: "Disponibilità", sub: true },
      { page: "hours", icon: "clock-history", label: "Orari" },
    ],
  },
  {
    label: "Impostazioni",
    items: [
      { page: "business_profile", icon: "gear", label: "Profilo attività" },
      { page: "locations", icon: "building", label: "Sedi" },
      { page: "consent_modules", icon: "shield-check", label: "Moduli consenso" },
      { page: "accessibility", icon: "universal-access", label: "Accessibilità" },
      { page: "roles", icon: "shield-lock", label: "Ruoli" },
      { page: "automation", icon: "lightning-charge", label: "Automazione" },
      { page: "reports", icon: "graph-up", label: "Report" },
      { page: "booking", icon: "globe2", label: "Booking" },
    ],
  },
];

// Build a clean manage URL from a menu page key. The key may embed a legacy
// query (`costs&tab=categories`, `products&action=categories`) or hash anchor
// (`fidelity_points#livelli-card`); the page becomes the path segment and the
// tab/action stay as query params: /<slug>/<page>[?tab=..][#hash].
function pageHref(slug: string, page: string): string {
  const hashIdx = page.indexOf("#");
  const hash = hashIdx >= 0 ? page.slice(hashIdx) : "";
  const noHash = hashIdx >= 0 ? page.slice(0, hashIdx) : page;
  const ampIdx = noHash.indexOf("&");
  const name = ampIdx >= 0 ? noHash.slice(0, ampIdx) : noHash;
  const query = ampIdx >= 0 ? noHash.slice(ampIdx + 1) : "";
  let url = `/${encodeURIComponent(slug)}/${name}`;
  if (query) url += `?${query}`;
  return url + hash;
}

// Flat, searchable index of every menu function (used by the topbar "Cerca..."
// jump-to-function search). Each entry keeps the original page key (so pageHref
// builds the same clean URL the sidebar uses) plus its group label for context.
type FunctionEntry = { page: string; label: string; icon: string; group: string };
const FUNCTION_INDEX: FunctionEntry[] = MENU.flatMap((group) =>
  group.items.map((item) => ({ page: item.page, label: item.label, icon: item.icon, group: group.label ?? "" })),
);

function normalize(value: string): string {
  // Lowercase + strip combining diacritics (U+0300–U+036F) so "attività" matches
  // a typed "attivita" and "disponibilità" matches "disponibilita".
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "");
}

export function ManageShell({
  slug,
  userName,
  currentPage = "dashboard",
  children,
}: {
  slug: string;
  userName: string;
  currentPage?: string;
  children: React.ReactNode;
}) {
  // Port of the app.js sidebar behaviors: desktop collapse (persisted in
  // localStorage) and the mobile off-canvas (sidebar-open + backdrop).
  useEffect(() => {
    const previous = document.body.className;
    let collapsed = false;
    try {
      collapsed = localStorage.getItem("beautysuite_sidebar_collapsed") === "1";
    } catch {
      collapsed = false;
    }
    document.body.className = collapsed ? "sidebar-collapsed" : "";
    document.documentElement.classList.remove("sidebar-collapsed-initial");

    const desktopToggle = document.getElementById("sidebarDesktopToggle");
    const openBtn = document.getElementById("sidebarOpen");
    const closeBtn = document.getElementById("sidebarClose");
    const backdrop = document.getElementById("sidebarBackdrop");

    const onDesktopToggle = () => {
      const next = !document.body.classList.contains("sidebar-collapsed");
      document.body.classList.toggle("sidebar-collapsed", next);
      try {
        localStorage.setItem("beautysuite_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // ignore storage failures, like the PHP app
      }
    };
    const openSidebar = () => document.body.classList.add("sidebar-open");
    const closeSidebar = () => document.body.classList.remove("sidebar-open");

    desktopToggle?.addEventListener("click", onDesktopToggle);
    openBtn?.addEventListener("click", openSidebar);
    closeBtn?.addEventListener("click", closeSidebar);
    backdrop?.addEventListener("click", closeSidebar);

    return () => {
      desktopToggle?.removeEventListener("click", onDesktopToggle);
      openBtn?.removeEventListener("click", openSidebar);
      closeBtn?.removeEventListener("click", closeSidebar);
      backdrop?.removeEventListener("click", closeSidebar);
      document.body.className = previous;
    };
  }, []);

  const basePage = currentPage.split("&")[0];

  // Topbar "Cerca..." jump-to-function search over the MENU items. Filters the flat
  // FUNCTION_INDEX as you type and shows a lightweight dropdown of matches; Enter or
  // a click navigates to the matching page via pageHref (the same clean URL the
  // sidebar uses). Keyboard: ArrowUp/Down move the highlight, Escape closes.
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const searchMatches = useMemo(() => {
    const q = normalize(searchQuery.trim());
    if (!q) return [] as FunctionEntry[];
    return FUNCTION_INDEX.filter((entry) => {
      const haystack = normalize(`${entry.label} ${entry.group} ${entry.page}`);
      return haystack.includes(q);
    }).slice(0, 8);
  }, [searchQuery]);

  // Close the dropdown when clicking outside the search box.
  useEffect(() => {
    if (!searchOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [searchOpen]);

  const goToFunction = (entry: FunctionEntry | undefined) => {
    if (!entry) return;
    setSearchOpen(false);
    window.location.href = pageHref(slug, entry.page);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(searchMatches.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      goToFunction(searchMatches[activeIndex] ?? searchMatches[0]);
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" precedence="bs" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" precedence="bs" />
      <link rel="stylesheet" href="/assets/css/app.css" precedence="app" />
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" async />
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" async />

      <div id="sidebarBackdrop" className="app-backdrop" />
      <div className="app-shell">
        <aside className="app-sidebar" id="sidebar">
          <div className="d-flex align-items-center justify-content-between">
            <a className="brand" href={pageHref(slug, "dashboard")}>
              <span className="mark">B</span>
              <span className="name">BeautySuite</span>
            </a>
            <button className="sidebar-toggle sidebar-collapse-toggle d-none d-lg-inline-flex" id="sidebarDesktopToggle" type="button" aria-label="Comprimi sidebar" aria-expanded="true">
              <i className="bi bi-chevron-left" />
            </button>
            <button className="sidebar-toggle d-lg-none" id="sidebarClose" type="button" aria-label="Chiudi">
              <i className="bi bi-x-lg" />
            </button>
          </div>

          {MENU.map((group, gi) => (
            <div className="nav-section" key={gi}>
              {group.label ? <div className="nav-label">{group.label}</div> : null}
              {group.items.map((item) => (
                <a
                  key={item.page}
                  className={`nav-item ${item.sub ? "nav-subitem " : ""}${basePage === item.page.split("&")[0] ? "active" : ""}`.trim()}
                  href={pageHref(slug, item.page)}
                >
                  <i className={`bi bi-${item.icon}`} />
                  {item.label}
                </a>
              ))}
            </div>
          ))}

          <div className="mt-auto pt-3">
            <div className="small-muted px-2">
              <strong>Accesso:</strong> <strong>{userName}</strong>
            </div>
            <a className="nav-item mt-2" href={`/${encodeURIComponent(slug)}/index.php?page=logout`}>
              <i className="bi bi-box-arrow-right" />
              Esci
            </a>
          </div>
        </aside>

        <div className="app-main">
          <header className="topbar">
            <button className="icon-btn d-lg-none" id="sidebarOpen" type="button" aria-label="Menu">
              <i className="bi bi-list" />
            </button>

            <div className="search d-none d-md-block" ref={searchBoxRef}>
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Cerca..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                  setActiveIndex(0);
                }}
                onFocus={() => {
                  if (searchQuery.trim()) setSearchOpen(true);
                }}
                onKeyDown={onSearchKeyDown}
                role="combobox"
                aria-expanded={searchOpen && searchMatches.length > 0}
                aria-controls="topbarFunctionSearchMenu"
                aria-autocomplete="list"
              />
              {searchOpen && searchMatches.length > 0 ? (
                <ul
                  className="dropdown-menu show w-100 mt-1"
                  id="topbarFunctionSearchMenu"
                  style={{ position: "absolute", top: "100%", left: 0, maxHeight: "60vh", overflowY: "auto", zIndex: 1080 }}
                >
                  {searchMatches.map((entry, i) => (
                    <li key={entry.page}>
                      <button
                        type="button"
                        className={`dropdown-item d-flex align-items-center gap-2${i === activeIndex ? " active" : ""}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          goToFunction(entry);
                        }}
                        onMouseEnter={() => setActiveIndex(i)}
                      >
                        <i className={`bi bi-${entry.icon}`} />
                        <span className="flex-grow-1 text-truncate">{entry.label}</span>
                        {entry.group ? <small className="text-muted">{entry.group}</small> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="actions ms-auto">
              <button
                className="btn btn-primary btn-pill"
                type="button"
                data-qb-new="1"
                aria-label="Nuova prenotazione"
                onClick={() => {
                  window.location.href = `${pageHref(slug, "calendar")}?qbnew=1`;
                }}
              >
                <i className="bi bi-plus-lg me-1" />
                <span className="topbar-action-text">Prenotazione</span>
              </button>
              <a className="icon-btn position-relative notification-bell" href={pageHref(slug, "notifications_birthdays")} title="Compleanni clienti" aria-label="Compleanni clienti">
                <i className="bi bi-cake2" />
                <span className="bell-badge d-none">0</span>
              </a>
              <a className="icon-btn position-relative notification-bell" href={pageHref(slug, "notifications_installments")} title="Rate in scadenza / scadute" aria-label="Rate in scadenza / scadute">
                <i className="bi bi-cash-stack" />
                <span className="bell-badge d-none">0</span>
              </a>
              <a className="icon-btn position-relative notification-bell" href={pageHref(slug, "notifications_quotes")} title="Preventivi" aria-label="Preventivi">
                <i className="bi bi-file-earmark-text" />
                <span className="bell-badge d-none">0</span>
              </a>
              <a className="icon-btn position-relative notification-bell" href={pageHref(slug, "notifications")} title="Notifiche" aria-label="Notifiche">
                <i className="bi bi-bell" />
                <span className="bell-badge d-none">0</span>
              </a>
              <div className="dropdown">
                <button className="icon-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Account">
                  <i className="bi bi-person-circle" />
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li><a className="dropdown-item" href={pageHref(slug, "business_profile")}><i className="bi bi-gear me-2" />Profilo attività</a></li>
                  <li><a className="dropdown-item" href={pageHref(slug, "locations")}><i className="bi bi-building me-2" />Sedi</a></li>
                  <li><a className="dropdown-item" href={pageHref(slug, "consent_modules")}><i className="bi bi-shield-check me-2" />Moduli consenso</a></li>
                  <li><a className="dropdown-item" href={pageHref(slug, "accessibility")}><i className="bi bi-universal-access me-2" />Accessibilità</a></li>
                  <li><a className="dropdown-item" href={pageHref(slug, "roles")}><i className="bi bi-shield-lock me-2" />Ruoli</a></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><a className="dropdown-item" href={`/${encodeURIComponent(slug)}/index.php?page=logout`}><i className="bi bi-box-arrow-right me-2" />Esci</a></li>
                </ul>
              </div>
            </div>
          </header>

          <main className="app-content">{children}</main>
        </div>
      </div>
    </>
  );
}
