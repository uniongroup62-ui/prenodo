"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Faithful port of the PHP services page, "Categorie" tab
// (?page=services&tab=categories). Fed by the existing DB-backed
// /api/manage/services route (getManageServicesContext): the `categories`
// array drives the table, the `services` array drives the per-category
// filter combobox and the delete-block payload.

type Category = {
  id: number;
  name: string;
  imageUrl?: string;
  sortOrder?: number;
  isDefault?: boolean;
  serviceCount?: number;
};

type Service = {
  id: number;
  name: string;
  categoryId?: number;
  isActive?: boolean;
  active?: boolean;
};

type ServicesContext = {
  categories?: Category[];
  services?: Service[];
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

export function ServiceCategoriesContent() {
  const slug = tenantSlug();

  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  const [editModalId, setEditModalId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/manage/services?slug=${encodeURIComponent(slug)}&tab=categories`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j: ServicesContext) => {
        setCategories(Array.isArray(j.categories) ? j.categories : []);
        setServices(Array.isArray(j.services) ? j.services : []);
      })
      .catch(() => {
        setCategories([]);
        setServices([]);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  function tabHref(tab: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=services&tab=${tab}`;
  }

  function actionHref(suffix: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=services&tab=categories${suffix}`;
  }

  function formAction(suffix: string): string {
    return `/${encodeURIComponent(slug)}/index.php?page=services&tab=categories${suffix}`;
  }

  // Filter combobox data (the PHP page emits these as JSON for the client-side combobox).
  const filterItems = useMemo(
    () =>
      categories.map((c) => ({
        id: String(c.id),
        label: c.name,
        meta: "",
        search: String(c.name ?? "").toLowerCase(),
      })),
    [categories],
  );

  const selectedFilterLabel = useMemo(() => {
    if (!filterCategoryId) return "";
    const found = categories.find((c) => String(c.id) === filterCategoryId);
    return found ? found.name : "";
  }, [categories, filterCategoryId]);

  const rows = useMemo(() => {
    if (!filterCategoryId) return categories;
    return categories.filter((c) => String(c.id) === filterCategoryId);
  }, [categories, filterCategoryId]);

  // Services per category drive the delete-block payload (data-category-services).
  function servicesForCategory(categoryId: number): Service[] {
    return services.filter((s) => Number(s.categoryId) === Number(categoryId));
  }

  return (
    <div className="container-fluid">
      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Risorse</div>
          <h1 className="bs-page-title">Categorie</h1>
          <div className="bs-page-subtitle">Gestisci categorie e ordine del catalogo servizi.</div>
        </div>
        <div className="bs-page-actions">
          <button
            className="btn btn-primary btn-pill"
            type="button"
            data-bs-toggle="modal"
            data-bs-target="#serviceCategoryCreateModal"
            onClick={() => setCreateOpen(true)}
          >
            <i className="bi bi-plus-lg me-1" />
            Nuova categoria
          </button>
        </div>
      </div>

      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <a className="nav-link" href={tabHref("services")}>
            Servizi
          </a>
        </li>
        <li className="nav-item">
          <a className="nav-link active" href={tabHref("categories")}>
            Categorie
          </a>
        </li>
        <li className="nav-item">
          <a className="nav-link" href={tabHref("recommended")}>
            Servizi consigliati
          </a>
        </li>
      </ul>

      <link rel="stylesheet" href="/assets/css/pages/services.css" />

      <div className="card p-3 mb-3">
        <form className="row g-2 align-items-end" method="get" onSubmit={(e) => e.preventDefault()}>
          <input type="hidden" name="page" value="services" />
          <input type="hidden" name="tab" value="categories" />
          <div className="col-lg-3 col-md-5">
            <label className="form-label">Categoria</label>
            <div className="app-combobox dropdown" data-service-category-filter-combobox>
              <button
                className="form-control text-start app-combobox-toggle dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                data-bs-auto-close="outside"
                aria-expanded="false"
              >
                <span className={`app-combobox-text${selectedFilterLabel ? "" : " d-none"}`}>
                  {selectedFilterLabel}
                </span>
                <span className={`app-combobox-placeholder text-muted ${selectedFilterLabel ? "d-none" : ""}`}>
                  Tutte
                </span>
              </button>
              <div className="dropdown-menu p-2 w-100">
                <input
                  type="text"
                  className="form-control form-control-sm app-combobox-search"
                  placeholder="Cerca categoria..."
                  autoComplete="off"
                />
                <div className="app-combobox-list mt-2">
                  <button type="button" className="dropdown-item" onClick={() => setFilterCategoryId("")}>
                    Tutte
                  </button>
                  {filterItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="dropdown-item"
                      onClick={() => setFilterCategoryId(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <input type="hidden" name="category_id" value={filterCategoryId} />
            </div>
          </div>
          <div className="col-lg-2 col-md-3 d-grid">
            <button className="btn btn-outline-primary" type="submit">
              <i className="bi bi-funnel me-1" />
              Filtra
            </button>
          </div>
        </form>
      </div>

      <div className="card card-soft">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th className="services-order-col">Ordine</th>
                  <th>Categoria</th>
                  <th className="text-end">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-muted small p-3">
                      {loading ? "Caricamento…" : "Nessuna categoria."}
                    </td>
                  </tr>
                ) : (
                  rows.map((category, index) => {
                    const linkedServices = servicesForCategory(category.id);
                    const isFirst = index === 0;
                    const isLast = index === rows.length - 1;
                    return (
                      <tr key={category.id}>
                        <td>
                          <div className="btn-group btn-group-sm" role="group" aria-label="Ordina categoria">
                            <form method="post" className="d-inline">
                              <input type="hidden" name="_csrf" value="" />
                              <input type="hidden" name="category_id" value={category.id} />
                              <input type="hidden" name="filter_category_id" value={filterCategoryId} />
                              <input type="hidden" name="p" value="1" />
                              <input type="hidden" name="direction" value="up" />
                              <button
                                className="btn btn-outline-secondary"
                                type="submit"
                                name="category_move"
                                value="1"
                                title="Sposta su"
                                disabled={isFirst}
                              >
                                <i className="bi bi-chevron-up" />
                              </button>
                            </form>
                            <form method="post" className="d-inline">
                              <input type="hidden" name="_csrf" value="" />
                              <input type="hidden" name="category_id" value={category.id} />
                              <input type="hidden" name="filter_category_id" value={filterCategoryId} />
                              <input type="hidden" name="p" value="1" />
                              <input type="hidden" name="direction" value="down" />
                              <button
                                className="btn btn-outline-secondary"
                                type="submit"
                                name="category_move"
                                value="1"
                                title="Sposta giu"
                                disabled={isLast}
                              >
                                <i className="bi bi-chevron-down" />
                              </button>
                            </form>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="services-category-icon">
                              <i className="bi bi-tag" />
                            </div>
                            <div className="fw-semibold">{category.name}</div>
                          </div>
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            type="button"
                            data-bs-toggle="modal"
                            data-bs-target={`#serviceCategoryEditModal${category.id}`}
                            onClick={() => setEditModalId(category.id)}
                          >
                            Modifica
                          </button>
                          <a
                            className="btn btn-sm btn-outline-danger"
                            href={actionHref(`&action=delete&id=${category.id}`)}
                            data-category-name={category.name}
                            data-category-services={JSON.stringify(
                              linkedServices.map((s) => ({
                                id: s.id,
                                name: s.name,
                                active: s.isActive ?? s.active ?? false,
                              })),
                            )}
                            data-service-category-delete="1"
                          >
                            Elimina
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit modals (one per category, pre-filled with current name). */}
      {categories.map((category) => {
        const open = editModalId === category.id;
        return (
          <div
            key={category.id}
            className={`modal fade${open ? " show d-block" : ""}`}
            id={`serviceCategoryEditModal${category.id}`}
            tabIndex={-1}
            aria-hidden={open ? undefined : true}
            style={open ? { background: "rgba(0,0,0,.5)" } : undefined}
          >
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content">
                <form method="post" encType="multipart/form-data" action={formAction(`&action=edit&id=${category.id}`)}>
                  <div className="modal-header">
                    <div>
                      <div className="page-eyebrow mb-1">Risorse</div>
                      <h5 className="modal-title mb-0">Modifica categoria</h5>
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      data-bs-dismiss="modal"
                      aria-label="Chiudi"
                      onClick={() => setEditModalId(null)}
                    />
                  </div>
                  <div className="modal-body">
                    <input type="hidden" name="_csrf" value="" />
                    <input type="hidden" name="id" value={category.id} />

                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Nome</label>
                        <input className="form-control" name="name" required defaultValue={category.name} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Immagine categoria</label>
                        <input className="form-control" type="file" name="image_file" accept="image/*" />
                        <div className="form-text">
                          Consigliato: <strong>1200&times;675</strong> (rapporto 16:9) oppure <strong>800&times;450</strong>.
                          Max <strong>5 MB</strong>. L&apos;immagine verr&agrave; compressa automaticamente.
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-pill"
                      data-bs-dismiss="modal"
                      onClick={() => setEditModalId(null)}
                    >
                      Annulla
                    </button>
                    <button className="btn btn-primary btn-pill" type="submit">
                      <i className="bi bi-check2-circle me-1" />
                      Salva
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })}

      {/* Create modal. */}
      <div
        className={`modal fade${createOpen ? " show d-block" : ""}`}
        id="serviceCategoryCreateModal"
        tabIndex={-1}
        aria-hidden={createOpen ? undefined : true}
        style={createOpen ? { background: "rgba(0,0,0,.5)" } : undefined}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <form method="post" encType="multipart/form-data" action={formAction("&action=new")}>
              <div className="modal-header">
                <div>
                  <div className="page-eyebrow mb-1">Risorse</div>
                  <h5 className="modal-title mb-0">Nuova categoria</h5>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Chiudi"
                  onClick={() => setCreateOpen(false)}
                />
              </div>
              <div className="modal-body">
                <input type="hidden" name="_csrf" value="" />
                <input type="hidden" name="id" value="0" />

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Nome</label>
                    <input className="form-control" name="name" required defaultValue="" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Immagine categoria</label>
                    <input className="form-control" type="file" name="image_file" accept="image/*" />
                    <div className="form-text">
                      Consigliato: <strong>1200&times;675</strong> (rapporto 16:9) oppure <strong>800&times;450</strong>. Max{" "}
                      <strong>5 MB</strong>. L&apos;immagine verr&agrave; compressa automaticamente.
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-pill"
                  data-bs-dismiss="modal"
                  onClick={() => setCreateOpen(false)}
                >
                  Annulla
                </button>
                <button className="btn btn-primary btn-pill" type="submit">
                  <i className="bi bi-check2-circle me-1" />
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Delete-block modal (shown by services.js when a category has linked services). */}
      <div className="modal fade" id="categoryDeleteBlockModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title mb-1">Categoria non eliminabile</h5>
                <div className="text-muted small" id="categoryDeleteBlockSubtitle" />
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Chiudi" />
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                Non è possibile eliminare la categoria perché sono associati dei servizi. Sposta o modifica prima i
                servizi collegati, poi riprova.
              </div>
              <div id="categoryDeleteBlockList" />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary btn-pill" data-bs-dismiss="modal">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
