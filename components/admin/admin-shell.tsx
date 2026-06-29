"use client";

// Pixel-faithful port of the legacy PHP /admin/ chrome.
// Reproduces the captured admin markup verbatim:
//   admin-shell
//     > admin-header (admin-brand + admin-subtitle + admin-user)
//     > admin-nav  (sidebar nav links to the ?page=… admin pages)
//     > admin-main (page header rendered by the page itself + {children})
//
// The legacy nav links point at the PHP entrypoint (./?page=…). They are kept
// verbatim so the chrome matches 1:1; the parent route wiring can rewrite these
// hrefs to the Next admin routes when those exist.
//
// The legacy logout link carried a `_csrf` query param — dropped here per spec;
// it now points at the Next logout route.

export type AdminNavItem = {
  label: string;
  href: string;
  /** matches the legacy ?page= key (empty string = Dashboard) */
  page: string;
};

// Nav items captured verbatim from the legacy authenticated /admin/ body.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Dashboard", href: "./", page: "" },
  { label: "Controlli", href: "./?page=controls", page: "controls" },
  { label: "Piani SMS", href: "./?page=sms_plans", page: "sms_plans" },
  { label: "Movimenti Invii", href: "./?page=send_movements", page: "send_movements" },
  { label: "Tenant", href: "./?page=tenants", page: "tenants" },
  { label: "Nuovo tenant", href: "./?page=tenant_new", page: "tenant_new" },
  { label: "Manutenzione", href: "./?page=maintenance", page: "maintenance" },
  { label: "Audit", href: "./?page=audit", page: "audit" },
];

export function AdminShell({
  children,
  activePage = "",
  userEmail = "",
  logoutHref = "/api/admin/auth/logout",
}: {
  children: React.ReactNode;
  /** the ?page= key of the active page; "" highlights Dashboard */
  activePage?: string;
  userEmail?: string;
  logoutHref?: string;
}) {
  return (
    <>
      {/* Legacy admin pages load Bootstrap 5.3.3 + assets/admin.css. */}
      <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        rel="stylesheet"
      />
      <link href="/admin/assets/admin.css" rel="stylesheet" />

      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <a className="admin-brand" href="./">
              SaaS Admin
            </a>
            <div className="admin-subtitle">Gestione tenant, accessi e diagnostica.</div>
          </div>
          {userEmail ? (
            <div className="admin-user">
              <span>{userEmail}</span>
              <a className="btn btn-outline-secondary btn-sm" href={logoutHref}>
                Logout
              </a>
            </div>
          ) : null}
        </header>

        <nav className="admin-nav" aria-label="Navigazione admin">
          {ADMIN_NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              className={item.page === activePage ? "active" : ""}
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <main className="admin-main">{children}</main>
      </div>
    </>
  );
}
