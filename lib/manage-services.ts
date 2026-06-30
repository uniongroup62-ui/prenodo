import "server-only";

import type { RowDataPacket } from "@/lib/tenant-db";
import { emptyToNull, parseInteger, parseNumber } from "@/lib/api-utils";
import {
  columnExists,
  dbExecute,
  dbQuery,
  quoteIdentifier,
  tableExists,
  tenantDelete,
  tenantIdForSlug,
  tenantInsert,
  tenantSelect,
  tenantTable,
  tenantUpdate,
} from "@/lib/tenant-db";

type TenantTarget = Awaited<ReturnType<typeof tenantTable>>;

export type ManageServiceContext = {
  ok: true;
  sourceMode: "database";
  featureFlags: {
    bookingPublicAllowed: boolean;
    marketplacePublicAllowed: boolean;
  };
  stats: {
    services: number;
    activeServices: number;
    categories: number;
    recommendedLinks: number;
  };
  services: ManageServiceRow[];
  categories: ServiceCategoryRow[];
  locations: ServiceLocationRow[];
  cabins: ServiceCabinRow[];
  staff: ServiceStaffRow[];
  resources: ServiceResourceRow[];
  marketplace: {
    taxonomyCategories: MarketplaceTaxonomyCategory[];
    categoryMappings: ServiceCategoryMarketplaceMapping[];
  };
};

export type ManageServiceRow = {
  id: number;
  name: string;
  durationMin: number;
  duration: string;
  priceValue: number;
  price: string;
  categoryId: number | null;
  categoryName: string;
  categoryImageUrl: string;
  cabinId: number | null;
  sortOrder: number;
  isActive: boolean;
  active: boolean;
  bookingEnabled: boolean;
  noOperator: boolean;
  locationIds: number[];
  cabinIds: number[];
  staffIds: number[];
  resources: Array<{ resourceId: number; qtyRequired: number }>;
  recommendationIds: number[];
  recoCount: number;
};

export type ServiceCategoryRow = {
  id: number;
  name: string;
  imageUrl: string;
  sortOrder: number;
  isDefault: boolean;
  serviceCount: number;
  marketplaceCategoryId: number | null;
  marketplaceCategorySlug: string;
  marketplaceCategoryName: string;
};

export type ServiceLocationRow = {
  id: number;
  name: string;
  isActive: boolean;
};

export type ServiceCabinRow = {
  id: number;
  name: string;
  isActive: boolean;
  locationId: number | null;
  position: number;
};

export type ServiceStaffRow = {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  locationIds: number[];
};

export type ServiceResourceRow = {
  id: number;
  name: string;
  qtyTotal: number;
};

export type MarketplaceTaxonomyCategory = {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
};

export type ServiceCategoryMarketplaceMapping = {
  tenantCategoryId: number;
  tenantCategoryName: string;
  marketplaceCategoryId: number | null;
  marketplaceCategorySlug: string;
  marketplaceCategoryName: string;
};

type NormalizedServiceInput = {
  id: number;
  name: string;
  durationMin: number;
  price: number;
  categoryId: number | null;
  isActive: boolean;
  bookingEnabled: boolean;
  noOperator: boolean;
  locationIds: number[];
  cabinIds: number[];
  staffIds: number[];
  resourceQty: Map<number, number>;
};


export async function getManageServicesContext(slug: string, options: { query?: string; locationId?: number; includeInactive?: boolean } = {}): Promise<ManageServiceContext> {
  const tenant = await getTenant(slug);
  const [locations, cabins, staff, resources, categories, mappings, taxonomyCategories] = await Promise.all([
    listServiceLocations(slug),
    listServiceCabins(slug),
    listServiceStaff(slug),
    listServiceResources(slug),
    listServiceCategories(slug),
    listServiceCategoryMarketplaceMappings(slug),
    listMarketplaceTaxonomyCategories(),
  ]);
  const services = await listManageServices(slug, {
    query: options.query ?? "",
    locationId: options.locationId ?? 0,
    includeInactive: options.includeInactive ?? true,
  });
  const categoriesWithCounts = categories.map((category) => {
    const mapping = mappings.find((item) => item.tenantCategoryId === category.id);
    return {
      ...category,
      serviceCount: services.filter((service) => service.categoryId === category.id).length,
      marketplaceCategoryId: mapping?.marketplaceCategoryId ?? null,
      marketplaceCategorySlug: mapping?.marketplaceCategorySlug ?? "",
      marketplaceCategoryName: mapping?.marketplaceCategoryName ?? "",
    };
  });
  const recommendedLinks = services.reduce((sum, service) => sum + service.recommendationIds.length, 0);

  return {
    ok: true,
    sourceMode: "database",
    featureFlags: {
      bookingPublicAllowed: Boolean(Number(tenant?.booking_public_allowed ?? 1)),
      marketplacePublicAllowed: Boolean(Number(tenant?.marketplace_public_allowed ?? 1)),
    },
    stats: {
      services: services.length,
      activeServices: services.filter((service) => service.isActive).length,
      categories: categoriesWithCounts.length,
      recommendedLinks,
    },
    services,
    categories: categoriesWithCounts,
    locations,
    cabins,
    staff,
    resources,
    marketplace: {
      taxonomyCategories,
      categoryMappings: mappings,
    },
  };
}

export async function saveManageService(slug: string, body: Record<string, string>): Promise<ManageServiceContext> {
  const input = await normalizeServiceInput(slug, body);
  const table = await tenantTable(slug, "services");
  const values = await filterColumns(table.name, {
    category_id: input.categoryId,
    cabin_id: input.cabinIds[0] ?? null,
    name: input.name,
    duration_min: input.durationMin,
    price: input.price,
    is_active: input.isActive ? 1 : 0,
    booking_enabled: input.bookingEnabled ? 1 : 0,
    no_operator: input.noOperator ? 1 : 0,
  });

  let serviceId = input.id;
  if (serviceId > 0) {
    const existing = await getServiceById(slug, serviceId);
    await ensureLocationRemovalAllowed(slug, serviceId, input.locationIds);
    await tenantUpdate({ slug, table: "services", id: serviceId, values });
    await updateOperationalSnapshots(slug, serviceId, existing, input);
  } else {
    serviceId = await tenantInsert(table, {
      ...values,
      sort_order: await nextServiceSortOrder(slug, input.categoryId),
    });
  }

  await syncServiceLinks(slug, serviceId, input);
  await syncTenantDirectoryServices(slug);
  return getManageServicesContext(slug, { includeInactive: true });
}

export async function deleteManageService(slug: string, serviceId: number): Promise<ManageServiceContext> {
  if (serviceId <= 0) throw new Error("Servizio non valido.");
  const service = await getServiceById(slug, serviceId);
  const blockers = await serviceDeleteBlockers(slug, serviceId);
  if (blockers.length) {
    const sample = blockers.slice(0, 3).map((item) => `${item.group}: ${item.title}`).join("; ");
    throw new Error(`Servizio non eliminabile: ${sample}`);
  }

  await deleteByOwner(slug, "service_resources", "service_id", serviceId);
  await deleteByOwner(slug, "service_cabins", "service_id", serviceId);
  await deleteByOwner(slug, "staff_services", "service_id", serviceId);
  await deleteByOwner(slug, "service_locations", "service_id", serviceId);
  await deleteRecommendationsForService(slug, serviceId);
  await tenantDelete({ slug, table: "services", id: service.id as number });
  await syncTenantDirectoryServices(slug);
  return getManageServicesContext(slug, { includeInactive: true });
}

export async function saveServiceCategory(slug: string, body: Record<string, string>): Promise<ManageServiceContext> {
  const table = await tenantTable(slug, "service_categories");
  const id = parseInteger(body.id, 0);
  const name = clean(body.name, 190);
  if (!name) throw new Error("Nome categoria obbligatorio.");

  const imageUrl = truthy(body.delete_image ?? body.remove_image) ? null : emptyToNull(clean(body.image_url ?? body.imageUrl, 255));
  if (id > 0) {
    const existing = await getCategoryById(slug, id);
    if (!existing) throw new Error("Categoria non trovata.");
    await tenantUpdate({
      slug,
      table: "service_categories",
      id,
      values: await filterColumns(table.name, { name, image_url: imageUrl }),
    });
  } else {
    await tenantInsert(table, await filterColumns(table.name, {
      name,
      image_url: imageUrl,
      sort_order: await nextCategorySortOrder(slug),
    }));
  }

  await normalizeCategoryOrder(slug);
  await syncTenantDirectoryServices(slug);
  return getManageServicesContext(slug, { includeInactive: true });
}

export async function deleteServiceCategory(slug: string, categoryId: number): Promise<ManageServiceContext> {
  const category = await getCategoryById(slug, categoryId);
  if (!category) throw new Error("Categoria non trovata.");
  if (isDefaultCategoryName(String(category.name ?? ""))) throw new Error("Non puoi eliminare la categoria di default.");

  const linked = await tenantSelect<RowDataPacket>({
    slug,
    table: "services",
    columns: "id,name,is_active",
    where: "category_id = ?",
    params: [categoryId],
    orderBy: "name ASC",
    limit: 200,
  }).catch(() => []);
  if (linked.length) {
    const names = linked.slice(0, 5).map((row) => String(row.name ?? `#${row.id}`)).join(", ");
    throw new Error(`Categoria non eliminabile: servizi associati (${names}).`);
  }

  await tenantDelete({ slug, table: "service_categories", id: categoryId });
  await deleteServiceCategoryMarketplaceMapping(slug, categoryId);
  await normalizeCategoryOrder(slug);
  await syncTenantDirectoryServices(slug);
  return getManageServicesContext(slug, { includeInactive: true });
}

export async function moveServiceCategory(slug: string, categoryId: number, direction: "up" | "down"): Promise<ManageServiceContext> {
  const rows = await normalizeCategoryOrder(slug);
  const index = rows.findIndex((row) => row.id === categoryId);
  if (index < 0) throw new Error("Categoria non trovata.");
  if (rows[index]?.isDefault) return getManageServicesContext(slug, { includeInactive: true });

  const targetIndex = direction === "down" ? index + 1 : index - 1;
  const target = rows[targetIndex];
  const current = rows[index];
  if (!target || !current || target.isDefault) return getManageServicesContext(slug, { includeInactive: true });

  await tenantUpdate({ slug, table: "service_categories", id: current.id, values: { sort_order: target.sortOrder } });
  await tenantUpdate({ slug, table: "service_categories", id: target.id, values: { sort_order: current.sortOrder } });
  await normalizeCategoryOrder(slug);
  await syncTenantDirectoryServices(slug);
  return getManageServicesContext(slug, { includeInactive: true });
}

export async function saveServiceOrder(slug: string, body: Record<string, string>): Promise<ManageServiceContext> {
  const categoryId = parseInteger(body.category_id ?? body.categoryId, 0);
  const ids = parseIdList(body.service_order ?? body.serviceOrder ?? body.ids);
  if (categoryId <= 0 || !ids.length) return getManageServicesContext(slug, { includeInactive: true });

  const table = await tenantTable(slug, "services");
  let sortOrder = 0;
  for (const id of ids) {
    const clauses = ["id = ?", "category_id = ?"];
    const params: unknown[] = [id, categoryId];
    if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
      clauses.push("tenant_id = ?");
      params.push(table.tenantId ?? 0);
    }
    await dbExecute(`UPDATE ${quoteIdentifier(table.name)} SET sort_order=? WHERE ${clauses.join(" AND ")}`, [sortOrder, ...params]);
    sortOrder += 1;
  }

  await syncTenantDirectoryServices(slug);
  return getManageServicesContext(slug, { includeInactive: true });
}

export async function saveServiceCategoryMarketplace(slug: string, body: Record<string, string>): Promise<ManageServiceContext> {
  const tenantCategoryId = parseInteger(body.tenant_category_id ?? body.category_id ?? body.id, 0);
  const marketplaceCategoryId = parseInteger(body.marketplace_category_id ?? body.marketplaceCategoryId, 0);
  if (tenantCategoryId <= 0) throw new Error("Categoria servizio non valida.");
  const category = await getCategoryById(slug, tenantCategoryId);
  if (!category) throw new Error("Categoria servizio non trovata.");

  await saveServiceCategoryMarketplaceMapping(slug, tenantCategoryId, String(category.name ?? ""), marketplaceCategoryId);
  await syncTenantDirectoryServices(slug);
  return getManageServicesContext(slug, { includeInactive: true });
}

export async function saveServiceRecommendations(slug: string, body: Record<string, string>): Promise<ManageServiceContext> {
  const serviceId = parseInteger(body.service_id ?? body.id, 0);
  if (serviceId <= 0) throw new Error("Servizio non valido.");
  await getServiceById(slug, serviceId);
  const requestedIds = parseIdList(body.recommended_ids ?? body.recommendedIds).filter((id) => id !== serviceId);
  const existingIds = new Set((await servicesByIds(slug, requestedIds)).map((row) => Number(row.id ?? 0)));
  const ids = uniquePositive(requestedIds.filter((id) => existingIds.has(id)));

  await deleteByOwner(slug, "service_recommendations", "service_id", serviceId);
  const table = await tenantTable(slug, "service_recommendations").catch(() => null);
  if (!table) throw new Error("Tabella service_recommendations mancante.");
  let sortOrder = 0;
  for (const recommendedId of ids) {
    await tenantInsert(table, await filterColumns(table.name, {
      service_id: serviceId,
      recommended_service_id: recommendedId,
      sort_order: sortOrder,
    }));
    sortOrder += 1;
  }

  await syncTenantDirectoryServices(slug);
  return getManageServicesContext(slug, { includeInactive: true });
}

async function normalizeServiceInput(slug: string, body: Record<string, string>): Promise<NormalizedServiceInput> {
  const id = parseInteger(body.id, 0);
  const name = clean(body.name, 190);
  const durationMin = parseInteger(body.duration_min ?? body.duration, 60);
  const price = Math.max(0, roundMoney(parseMoneyValue(body.price)));
  const categoryId = parseInteger(body.category_id ?? body.categoryId, 0) || null;
  const isActive = body.is_active === undefined && body.active === undefined ? true : truthy(body.is_active ?? body.active);
  const bookingEnabled = body.booking_enabled === undefined && body.bookingEnabled === undefined ? true : truthy(body.booking_enabled ?? body.bookingEnabled);
  const noOperator = truthy(body.no_operator ?? body.noOperator);
  const locationIds = await normalizeLocationIds(slug, parseIdList(body.location_ids ?? body.locationIds));
  const cabinIds = await normalizeCabinIds(slug, parseIdList(body.cabin_ids ?? body.cabin_id ?? body.cabinIds), locationIds);
  const staffIds = noOperator ? [] : await normalizeStaffIds(slug, parseIdList(body.staff_ids ?? body.staffIds), locationIds);
  const resourceQty = await normalizeResourceQty(slug, body);

  if (!name) throw new Error("Nome servizio obbligatorio.");
  if (durationMin <= 0) throw new Error("La durata del servizio deve essere maggiore di zero.");
  if (parseMoneyValue(body.price) < 0) throw new Error("Il prezzo del servizio non puo essere negativo.");
  if (categoryId && !await getCategoryById(slug, categoryId)) throw new Error("Categoria servizio non trovata.");

  const activeLocations = await listServiceLocations(slug);
  if (await tableExistsForTenant(slug, "service_locations") && activeLocations.length && !locationIds.length) {
    throw new Error("Seleziona almeno una sede in cui il servizio sara disponibile.");
  }

  const activeCabins = (await listServiceCabins(slug)).filter((cabin) => cabin.isActive);
  if (activeCabins.length && !cabinIds.length) {
    throw new Error("Seleziona almeno una cabina in cui verra effettuato il servizio.");
  }

  const activeStaff = (await listServiceStaff(slug)).filter((item) => item.isActive);
  if (!noOperator && activeStaff.length && !staffIds.length) {
    throw new Error("Seleziona almeno un operatore oppure attiva \"Servizio senza operatore\".");
  }

  return {
    id,
    name,
    durationMin,
    price,
    categoryId,
    isActive,
    bookingEnabled,
    noOperator,
    locationIds,
    cabinIds,
    staffIds,
    resourceQty,
  };
}

async function listManageServices(slug: string, options: { query?: string; locationId?: number; includeInactive?: boolean }): Promise<ManageServiceRow[]> {
  const servicesTable = await tenantTable(slug, "services");
  const categoriesTable = await tenantTable(slug, "service_categories").catch(() => null);
  const hasCategoryTenant = Boolean(categoriesTable && await columnExists(categoriesTable.name, "tenant_id"));
  const categoryJoin = categoriesTable
    ? `LEFT JOIN ${quoteIdentifier(categoriesTable.name)} c ON c.id=s.category_id${hasCategoryTenant && servicesTable.mode === "shared" ? " AND c.tenant_id=s.tenant_id" : ""}`
    : "";
  const categoryColumns = categoriesTable
    ? "c.name AS category_name, c.image_url AS category_image_url, COALESCE(c.sort_order,0) AS category_sort_order"
    : "NULL AS category_name, NULL AS category_image_url, 0 AS category_sort_order";
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (servicesTable.mode === "shared" && await columnExists(servicesTable.name, "tenant_id")) {
    clauses.push("s.tenant_id = ?");
    params.push(servicesTable.tenantId ?? 0);
  }
  const query = clean(options.query ?? "", 120).toLowerCase();
  if (query) {
    clauses.push("LOWER(s.name) LIKE ?");
    params.push(`%${query}%`);
  }
  if (!options.includeInactive) clauses.push("COALESCE(s.is_active,1)=1");

  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT s.*, ${categoryColumns}
       FROM ${quoteIdentifier(servicesTable.name)} s
       ${categoryJoin}
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY ${serviceCategoryJoinOrderSql(Boolean(categoriesTable))}, COALESCE(s.sort_order,0) ASC, s.name ASC`,
    params,
  );
  const ids = rows.map((row) => Number(row.id ?? 0)).filter((id) => id > 0);
  const [locations, cabins, staff, resources, recommendations] = await Promise.all([
    groupedIds(slug, "service_locations", "service_id", "location_id", ids),
    groupedIds(slug, "service_cabins", "service_id", "cabin_id", ids),
    groupedIds(slug, "staff_services", "service_id", "staff_id", ids),
    groupedResources(slug, ids),
    groupedRecommendations(slug, ids),
  ]);

  const services = rows.map((row) => mapService(row, {
    locationIds: locations.get(Number(row.id ?? 0)) ?? [],
    cabinIds: cabins.get(Number(row.id ?? 0)) ?? fallbackPositive(row.cabin_id),
    staffIds: staff.get(Number(row.id ?? 0)) ?? [],
    resources: resources.get(Number(row.id ?? 0)) ?? [],
    recommendationIds: recommendations.get(Number(row.id ?? 0)) ?? [],
  }));
  const filterLocationId = Number(options.locationId ?? 0);
  if (filterLocationId <= 0) return services;
  return services.filter((service) => service.locationIds.length === 0 || service.locationIds.includes(filterLocationId));
}

function mapService(
  row: RowDataPacket,
  links: {
    locationIds: number[];
    cabinIds: number[];
    staffIds: number[];
    resources: Array<{ resourceId: number; qtyRequired: number }>;
    recommendationIds: number[];
  },
): ManageServiceRow {
  const durationMin = Number(row.duration_min ?? 0) || 0;
  const priceValue = roundMoney(Number(row.price ?? 0) || 0);
  const categoryName = String(row.category_name ?? "Non categorizzato");
  const isActive = Number(row.is_active ?? 1) === 1;
  return {
    id: Number(row.id ?? 0),
    name: String(row.name ?? "Servizio"),
    durationMin,
    duration: `${durationMin} min`,
    priceValue,
    price: `${formatMoney(priceValue)} euro`,
    categoryId: nullableNumber(row.category_id),
    categoryName,
    categoryImageUrl: String(row.category_image_url ?? ""),
    cabinId: nullableNumber(row.cabin_id),
    sortOrder: Number(row.sort_order ?? 0) || 0,
    isActive,
    active: isActive,
    bookingEnabled: Number(row.booking_enabled ?? 1) === 1,
    noOperator: Number(row.no_operator ?? 0) === 1,
    locationIds: uniquePositive(links.locationIds),
    cabinIds: uniquePositive(links.cabinIds),
    staffIds: uniquePositive(links.staffIds),
    resources: links.resources,
    recommendationIds: uniquePositive(links.recommendationIds),
    recoCount: uniquePositive(links.recommendationIds).length,
  };
}

async function listServiceCategories(slug: string): Promise<ServiceCategoryRow[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "service_categories",
    columns: "id,name,image_url,COALESCE(sort_order,0) AS sort_order",
    orderBy: categoryOrderSql(),
  }).catch(() => []);
  const mappings = await listServiceCategoryMarketplaceMappings(slug);
  return rows.map((row) => {
    const id = Number(row.id ?? 0);
    const mapping = mappings.find((item) => item.tenantCategoryId === id);
    return {
      id,
      name: String(row.name ?? ""),
      imageUrl: String(row.image_url ?? ""),
      sortOrder: Number(row.sort_order ?? 0) || 0,
      isDefault: isDefaultCategoryName(String(row.name ?? "")),
      serviceCount: 0,
      marketplaceCategoryId: mapping?.marketplaceCategoryId ?? null,
      marketplaceCategorySlug: mapping?.marketplaceCategorySlug ?? "",
      marketplaceCategoryName: mapping?.marketplaceCategoryName ?? "",
    };
  });
}

async function listServiceLocations(slug: string): Promise<ServiceLocationRow[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "locations",
    columns: "id,name,is_active",
    where: "COALESCE(is_active,1)=1",
    orderBy: "COALESCE(sort_order,999999) ASC, name ASC, id ASC",
  }).catch(() => []);
  return rows.map((row) => ({
    id: Number(row.id ?? 0),
    name: String(row.name ?? `Sede #${row.id}`),
    isActive: Number(row.is_active ?? 1) === 1,
  }));
}

async function listServiceCabins(slug: string): Promise<ServiceCabinRow[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "cabins",
    columns: "*",
    orderBy: "COALESCE(position,999999) ASC, name ASC, id ASC",
  }).catch(() => []);
  return rows.map((row) => ({
    id: Number(row.id ?? 0),
    name: String(row.name ?? `Cabina #${row.id}`),
    isActive: Number(row.is_active ?? 1) === 1,
    locationId: nullableNumber(row.location_id),
    position: Number(row.position ?? 0) || 0,
  }));
}

async function listServiceStaff(slug: string): Promise<ServiceStaffRow[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "staff",
    columns: "id,full_name,email,is_active",
    where: "full_name <> 'SSO'",
    orderBy: "full_name ASC, id ASC",
  }).catch(() => []);
  const staffIds = rows.map((row) => Number(row.id ?? 0)).filter((id) => id > 0);
  const locationMap = await groupedIds(slug, "staff_locations", "staff_id", "location_id", staffIds);
  return rows.map((row) => ({
    id: Number(row.id ?? 0),
    fullName: String(row.full_name ?? `Operatore #${row.id}`),
    email: String(row.email ?? ""),
    isActive: Number(row.is_active ?? 1) === 1,
    locationIds: locationMap.get(Number(row.id ?? 0)) ?? [],
  }));
}

async function listServiceResources(slug: string): Promise<ServiceResourceRow[]> {
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "resources",
    columns: "id,name,qty_total",
    orderBy: "name ASC, id ASC",
  }).catch(() => []);
  return rows.map((row) => ({
    id: Number(row.id ?? 0),
    name: String(row.name ?? `Risorsa #${row.id}`),
    qtyTotal: Number(row.qty_total ?? 0) || 0,
  }));
}

async function groupedIds(slug: string, tableName: string, ownerColumn: string, valueColumn: string, ownerIds: number[]): Promise<Map<number, number[]>> {
  const ids = uniquePositive(ownerIds);
  const map = new Map<number, number[]>();
  if (!ids.length || !await tableExistsForTenant(slug, tableName)) return map;
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: tableName,
    columns: `${quoteIdentifier(ownerColumn)},${quoteIdentifier(valueColumn)}`,
    where: `${quoteIdentifier(ownerColumn)} IN (${ids.map(() => "?").join(",")})`,
    params: ids,
    orderBy: `${quoteIdentifier(ownerColumn)} ASC, ${quoteIdentifier(valueColumn)} ASC`,
  }).catch(() => []);
  for (const row of rows) {
    const ownerId = Number(row[ownerColumn] ?? 0);
    const value = Number(row[valueColumn] ?? 0);
    if (ownerId <= 0 || value <= 0) continue;
    const list = map.get(ownerId) ?? [];
    list.push(value);
    map.set(ownerId, list);
  }
  return map;
}

async function groupedResources(slug: string, serviceIds: number[]): Promise<Map<number, Array<{ resourceId: number; qtyRequired: number }>>> {
  const ids = uniquePositive(serviceIds);
  const map = new Map<number, Array<{ resourceId: number; qtyRequired: number }>>();
  if (!ids.length || !await tableExistsForTenant(slug, "service_resources")) return map;
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "service_resources",
    columns: "service_id,resource_id,qty_required",
    where: `service_id IN (${ids.map(() => "?").join(",")})`,
    params: ids,
    orderBy: "service_id ASC, resource_id ASC",
  }).catch(() => []);
  for (const row of rows) {
    const serviceId = Number(row.service_id ?? 0);
    const resourceId = Number(row.resource_id ?? 0);
    if (serviceId <= 0 || resourceId <= 0) continue;
    const list = map.get(serviceId) ?? [];
    list.push({ resourceId, qtyRequired: Math.max(1, Number(row.qty_required ?? 1) || 1) });
    map.set(serviceId, list);
  }
  return map;
}

async function groupedRecommendations(slug: string, serviceIds: number[]): Promise<Map<number, number[]>> {
  const ids = uniquePositive(serviceIds);
  const map = new Map<number, number[]>();
  if (!ids.length || !await tableExistsForTenant(slug, "service_recommendations")) return map;
  const rows = await tenantSelect<RowDataPacket>({
    slug,
    table: "service_recommendations",
    columns: "service_id,recommended_service_id,sort_order",
    where: `service_id IN (${ids.map(() => "?").join(",")})`,
    params: ids,
    orderBy: "service_id ASC, sort_order ASC, recommended_service_id ASC",
  }).catch(() => []);
  for (const row of rows) {
    const serviceId = Number(row.service_id ?? 0);
    const recommendedId = Number(row.recommended_service_id ?? 0);
    if (serviceId <= 0 || recommendedId <= 0) continue;
    const list = map.get(serviceId) ?? [];
    list.push(recommendedId);
    map.set(serviceId, list);
  }
  return map;
}

async function normalizeLocationIds(slug: string, requestedIds: number[]): Promise<number[]> {
  const locations = await listServiceLocations(slug);
  if (!locations.length) return [];
  const allowed = new Set(locations.filter((location) => location.isActive).map((location) => location.id));
  return uniquePositive(requestedIds.filter((id) => allowed.has(id)));
}

async function normalizeCabinIds(slug: string, requestedIds: number[], locationIds: number[]): Promise<number[]> {
  const activeCabins = (await listServiceCabins(slug)).filter((cabin) => cabin.isActive);
  if (!activeCabins.length) return [];
  const byId = new Map(activeCabins.map((cabin) => [cabin.id, cabin]));
  const ids = uniquePositive(requestedIds.filter((id) => byId.has(id)));
  const selected = ids.map((id) => byId.get(id)).filter((cabin): cabin is ServiceCabinRow => Boolean(cabin));
  if (!selected.length) return [];
  for (const cabin of selected) {
    if (cabin.locationId && locationIds.length && !locationIds.includes(cabin.locationId)) {
      throw new Error(`La cabina "${cabin.name}" non e abilitata nelle sedi selezionate.`);
    }
  }
  for (const locationId of locationIds) {
    if (!selected.some((cabin) => !cabin.locationId || cabin.locationId === locationId)) {
      throw new Error(`Per la sede #${locationId} seleziona almeno una cabina abilitata.`);
    }
  }
  return ids;
}

async function normalizeStaffIds(slug: string, requestedIds: number[], locationIds: number[]): Promise<number[]> {
  const activeStaff = (await listServiceStaff(slug)).filter((staff) => staff.isActive);
  if (!activeStaff.length) return [];
  const byId = new Map(activeStaff.map((staff) => [staff.id, staff]));
  const ids = uniquePositive(requestedIds.filter((id) => byId.has(id)));
  const selected = ids.map((id) => byId.get(id)).filter((staff): staff is ServiceStaffRow => Boolean(staff));
  if (!selected.length) return [];
  const hasStaffLocationSchema = await tableExistsForTenant(slug, "staff_locations");
  if (!hasStaffLocationSchema || !locationIds.length) return ids;

  for (const staff of selected) {
    if (!staff.locationIds.length || !locationIds.some((locationId) => staff.locationIds.includes(locationId))) {
      throw new Error(`L'operatore "${staff.fullName}" non e abilitato in nessuna delle sedi selezionate per il servizio.`);
    }
  }
  for (const locationId of locationIds) {
    if (!selected.some((staff) => staff.locationIds.includes(locationId))) {
      throw new Error(`Per la sede #${locationId} seleziona almeno un operatore abilitato oppure attiva "Servizio senza operatore".`);
    }
  }
  return ids;
}

async function normalizeResourceQty(slug: string, body: Record<string, string>): Promise<Map<number, number>> {
  const ids = new Map<number, number>();
  const resourcesJson = parseJsonArray<{ resourceId?: number; resource_id?: number; qtyRequired?: number; qty_required?: number }>(body.resources_json ?? body.resources);
  for (const item of resourcesJson) {
    const resourceId = Number(item.resourceId ?? item.resource_id ?? 0);
    if (resourceId > 0) ids.set(Math.floor(resourceId), Math.max(1, Number(item.qtyRequired ?? item.qty_required ?? 1) || 1));
  }

  for (const resourceId of parseIdList(body.resource_ids ?? body.resourceIds)) {
    const qty = parseInteger(body[`resource_qty_${resourceId}`] ?? body[`resource_qty[${resourceId}]`], ids.get(resourceId) ?? 1);
    ids.set(resourceId, Math.max(1, qty));
  }

  if (!ids.size) return ids;
  const existing = new Set((await tenantSelect<RowDataPacket>({
    slug,
    table: "resources",
    columns: "id",
    where: `id IN (${Array.from(ids.keys()).map(() => "?").join(",")})`,
    params: Array.from(ids.keys()),
  }).catch(() => [])).map((row) => Number(row.id ?? 0)));
  for (const resourceId of Array.from(ids.keys())) {
    if (!existing.has(resourceId)) ids.delete(resourceId);
  }
  return ids;
}

async function syncServiceLinks(slug: string, serviceId: number, input: NormalizedServiceInput): Promise<void> {
  await replaceOwnerLinks(slug, "service_cabins", "service_id", serviceId, "cabin_id", input.cabinIds);
  await replaceOwnerLinks(slug, "staff_services", "service_id", serviceId, "staff_id", input.staffIds);
  await replaceOwnerLinks(slug, "service_locations", "service_id", serviceId, "location_id", input.locationIds);

  await deleteByOwner(slug, "service_resources", "service_id", serviceId);
  const resourcesTable = await tenantTable(slug, "service_resources").catch(() => null);
  if (!resourcesTable) return;
  for (const [resourceId, qtyRequired] of input.resourceQty.entries()) {
    await tenantInsert(resourcesTable, await filterColumns(resourcesTable.name, {
      service_id: serviceId,
      resource_id: resourceId,
      qty_required: Math.max(1, qtyRequired),
    }));
  }
}

async function replaceOwnerLinks(slug: string, tableName: string, ownerColumn: string, ownerId: number, valueColumn: string, values: number[]): Promise<void> {
  const table = await tenantTable(slug, tableName).catch(() => null);
  if (!table || ownerId <= 0) return;
  await deleteByOwner(slug, tableName, ownerColumn, ownerId);
  for (const value of uniquePositive(values)) {
    await tenantInsert(table, await filterColumns(table.name, { [ownerColumn]: ownerId, [valueColumn]: value })).catch(() => undefined);
  }
}

async function updateOperationalSnapshots(slug: string, serviceId: number, previous: RowDataPacket, input: NormalizedServiceInput): Promise<void> {
  const category = input.categoryId ? await getCategoryById(slug, input.categoryId) : null;
  const previousName = clean(previous.name, 190);
  const previousPrice = roundMoney(Number(previous.price ?? 0) || 0);
  const nameChanged = previousName !== input.name;
  const priceChanged = Math.round(previousPrice * 100) !== Math.round(input.price * 100);
  if (!nameChanged && !priceChanged) return;

  if (nameChanged && await tableExistsForTenant(slug, "appointment_services")) {
    await updateRowsByColumn(slug, "appointment_services", "service_id", serviceId, {
      service_name: input.name,
      service_category_id: input.categoryId,
      service_category_name: category ? String(category.name ?? "") : null,
    });
  }

  if (priceChanged) {
    if (await tableExistsForTenant(slug, "package_services")) {
      await updateRowsByColumn(slug, "package_services", "service_id", serviceId, { price: input.price }).catch(() => undefined);
    }
    if (await tableExistsForTenant(slug, "appointment_services")) {
      await updateRowsByColumn(slug, "appointment_services", "service_id", serviceId, { list_price: input.price }).catch(() => undefined);
    }
  }
}

async function ensureLocationRemovalAllowed(slug: string, serviceId: number, newLocationIds: number[]): Promise<void> {
  if (!await tableExistsForTenant(slug, "service_locations")) return;
  const oldIds = (await groupedIds(slug, "service_locations", "service_id", "location_id", [serviceId])).get(serviceId) ?? [];
  if (!oldIds.length) return;
  const next = new Set(newLocationIds);
  const removed = oldIds.filter((id) => !next.has(id));
  if (!removed.length) return;
  const blockers = await openAppointmentBlockers(slug, serviceId, removed);
  if (blockers.length) throw new Error(`Non puoi rimuovere la sede dal servizio: ci sono prenotazioni aperte collegate (${blockers.length}).`);
}

async function serviceDeleteBlockers(slug: string, serviceId: number): Promise<Array<{ group: string; title: string; detail: string }>> {
  const blockers = await openAppointmentBlockers(slug, serviceId);
  const checks: Array<{ table: string; column: string; where?: string; group: string; title: string }> = [
    { table: "client_prepaid_services", column: "service_id", where: "COALESCE(remaining_qty,0)>0 AND LOWER(TRIM(COALESCE(status,'active'))) IN ('active','attivo')", group: "Servizi prepagati da eseguire", title: "Prepagati attivi" },
    { table: "package_services", column: "service_id", group: "Catalogo pacchetti", title: "Pacchetti collegati" },
    { table: "quote_items", column: "item_id", where: "LOWER(TRIM(COALESCE(item_type,'')))='service'", group: "Preventivi", title: "Preventivi collegati" },
    { table: "promotion_services", column: "service_id", group: "Promozioni", title: "Promozioni collegate" },
  ];
  for (const check of checks) {
    const count = await countRowsByColumn(slug, check.table, check.column, serviceId, check.where).catch(() => 0);
    if (count > 0) blockers.push({ group: check.group, title: check.title, detail: `${count} record` });
  }
  return blockers;
}

async function openAppointmentBlockers(slug: string, serviceId: number, locationIds: number[] = []): Promise<Array<{ group: string; title: string; detail: string }>> {
  const blockers: Array<{ group: string; title: string; detail: string }> = [];
  if (!await tableExistsForTenant(slug, "appointments")) return blockers;
  const table = await tenantTable(slug, "appointments");
  const serviceClauses = ["service_id = ?"];
  const serviceParams: unknown[] = [serviceId];
  if (await tableExistsForTenant(slug, "appointment_services")) {
    const itemsTable = await tenantTable(slug, "appointment_services");
    const itemClauses = ["service_id = ?"];
    const itemParams: unknown[] = [serviceId];
    if (itemsTable.mode === "shared" && await columnExists(itemsTable.name, "tenant_id")) {
      itemClauses.unshift("tenant_id = ?");
      itemParams.unshift(itemsTable.tenantId ?? 0);
    }
    serviceClauses.push(`id IN (SELECT appointment_id FROM ${quoteIdentifier(itemsTable.name)} WHERE ${itemClauses.join(" AND ")})`);
    serviceParams.push(...itemParams);
  }
  const clauses = [`(${serviceClauses.join(" OR ")})`, "LOWER(TRIM(COALESCE(status,''))) IN ('pending','scheduled')"];
  const params: unknown[] = [...serviceParams];
  const ids = uniquePositive(locationIds);
  if (ids.length && await columnExists(table.name, "location_id")) {
    clauses.push(`location_id IN (${ids.map(() => "?").join(",")})`);
    params.push(...ids);
  }
  if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
    clauses.unshift("tenant_id = ?");
    params.unshift(table.tenantId ?? 0);
  }
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT id,public_code,starts_at,status,client_id,location_id
       FROM ${quoteIdentifier(table.name)}
      WHERE ${clauses.join(" AND ")}
      ORDER BY starts_at ASC
      LIMIT 30`,
    params,
  ).catch(() => []);
  for (const row of rows) {
    blockers.push({
      group: "Prenotazioni in sospeso/prenotate",
      title: `Prenotazione ${String(row.public_code ?? "") || `#${row.id}`}`,
      detail: `${String(row.status ?? "")}${row.starts_at ? ` - ${String(row.starts_at).slice(0, 16)}` : ""}`,
    });
  }
  return blockers;
}

async function normalizeCategoryOrder(slug: string): Promise<ServiceCategoryRow[]> {
  const categories = await listServiceCategories(slug);
  let sortOrder = 0;
  for (const category of categories) {
    if (category.sortOrder !== sortOrder) {
      await tenantUpdate({ slug, table: "service_categories", id: category.id, values: { sort_order: sortOrder } }).catch(() => undefined);
    }
    category.sortOrder = sortOrder;
    sortOrder += 10;
  }
  return categories;
}

async function nextCategorySortOrder(slug: string): Promise<number> {
  const table = await tenantTable(slug, "service_categories");
  const scope = await tenantScope(table, [], []);
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT COALESCE(MAX(sort_order),-10)+10 AS next_sort FROM ${quoteIdentifier(table.name)}${scope.where}`,
    scope.params,
  ).catch(() => []);
  return Number(rows[0]?.next_sort ?? 0) || 0;
}

async function nextServiceSortOrder(slug: string, categoryId: number | null): Promise<number> {
  const table = await tenantTable(slug, "services");
  const scope = await tenantScope(table, ["category_id IS NOT DISTINCT FROM ?"], [categoryId]);
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT COALESCE(MAX(sort_order),-1)+1 AS next_sort FROM ${quoteIdentifier(table.name)}${scope.where}`,
    scope.params,
  ).catch(() => []);
  return Number(rows[0]?.next_sort ?? 0) || 0;
}

async function getServiceById(slug: string, id: number): Promise<RowDataPacket> {
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "services", where: "id = ?", params: [id], limit: 1 });
  if (!rows[0]) throw new Error("Servizio non trovato.");
  return rows[0];
}

async function servicesByIds(slug: string, ids: number[]): Promise<RowDataPacket[]> {
  const unique = uniquePositive(ids);
  if (!unique.length) return [];
  return tenantSelect<RowDataPacket>({
    slug,
    table: "services",
    columns: "id,name",
    where: `id IN (${unique.map(() => "?").join(",")})`,
    params: unique,
  }).catch(() => []);
}

async function getCategoryById(slug: string, id: number): Promise<RowDataPacket | null> {
  if (id <= 0) return null;
  const rows = await tenantSelect<RowDataPacket>({ slug, table: "service_categories", where: "id = ?", params: [id], limit: 1 }).catch(() => []);
  return rows[0] ?? null;
}

async function getTenant(slug: string) {
  const tenantId = await tenantIdForSlug(slug);
  if (!tenantId) return null;
  const rows = await dbQuery<RowDataPacket[]>(
    "SELECT id, slug, name, booking_public_allowed, marketplace_public_allowed FROM saas_tenants WHERE id=? LIMIT 1",
    [tenantId],
  ).catch(() => []);
  return rows[0] ?? null;
}

async function listMarketplaceTaxonomyCategories(): Promise<MarketplaceTaxonomyCategory[]> {
  if (!await tableExists("marketplace_taxonomy_categories")) return [];
  const rows = await dbQuery<RowDataPacket[]>(
    "SELECT id,slug,name,sort_order FROM marketplace_taxonomy_categories WHERE COALESCE(is_active,1)=1 ORDER BY sort_order ASC, name ASC, id ASC",
  ).catch(() => []);
  return rows.map((row) => ({
    id: Number(row.id ?? 0),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    sortOrder: Number(row.sort_order ?? 0) || 0,
  }));
}

async function listServiceCategoryMarketplaceMappings(slug: string): Promise<ServiceCategoryMarketplaceMapping[]> {
  const tenantId = await tenantIdForSlug(slug);
  if (!tenantId || !await tableExists("marketplace_service_category_mappings")) return [];
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT m.tenant_category_id,m.tenant_category_name,m.marketplace_category_id,m.marketplace_category_slug,c.name AS marketplace_category_name
       FROM marketplace_service_category_mappings m
       LEFT JOIN marketplace_taxonomy_categories c ON c.id=m.marketplace_category_id
      WHERE m.tenant_id=?
      ORDER BY m.tenant_category_name ASC, m.tenant_category_id ASC`,
    [tenantId],
  ).catch(() => []);
  return rows.map((row) => ({
    tenantCategoryId: Number(row.tenant_category_id ?? 0),
    tenantCategoryName: String(row.tenant_category_name ?? ""),
    marketplaceCategoryId: nullableNumber(row.marketplace_category_id),
    marketplaceCategorySlug: String(row.marketplace_category_slug ?? ""),
    marketplaceCategoryName: String(row.marketplace_category_name ?? ""),
  }));
}

async function saveServiceCategoryMarketplaceMapping(slug: string, tenantCategoryId: number, tenantCategoryName: string, marketplaceCategoryId: number): Promise<void> {
  const tenant = await getTenant(slug);
  const tenantId = Number(tenant?.id ?? 0);
  const tenantSlug = String(tenant?.slug ?? slug);
  if (tenantId <= 0 || tenantCategoryId <= 0 || !await tableExists("marketplace_service_category_mappings")) return;

  let taxonomy: RowDataPacket | null = null;
  if (marketplaceCategoryId > 0) {
    const rows = await dbQuery<RowDataPacket[]>(
      "SELECT id,slug FROM marketplace_taxonomy_categories WHERE id=? AND COALESCE(is_active,1)=1 LIMIT 1",
      [marketplaceCategoryId],
    );
    taxonomy = rows[0] ?? null;
    if (!taxonomy) throw new Error("Categoria marketplace non valida.");
  }

  await dbExecute(
    `INSERT INTO marketplace_service_category_mappings
      (tenant_id,tenant_slug,tenant_category_id,tenant_category_name,marketplace_category_id,marketplace_category_slug)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT (tenant_id,tenant_category_id) DO UPDATE SET
      tenant_slug=EXCLUDED.tenant_slug,
      tenant_category_name=EXCLUDED.tenant_category_name,
      marketplace_category_id=EXCLUDED.marketplace_category_id,
      marketplace_category_slug=EXCLUDED.marketplace_category_slug`,
    [
      tenantId,
      tenantSlug,
      tenantCategoryId,
      emptyToNull(clean(tenantCategoryName, 190)),
      taxonomy ? Number(taxonomy.id ?? 0) : null,
      taxonomy ? String(taxonomy.slug ?? "") : null,
    ],
  );
}

async function deleteServiceCategoryMarketplaceMapping(slug: string, tenantCategoryId: number): Promise<void> {
  const tenantId = await tenantIdForSlug(slug);
  if (!tenantId || tenantCategoryId <= 0 || !await tableExists("marketplace_service_category_mappings")) return;
  await dbExecute("DELETE FROM marketplace_service_category_mappings WHERE tenant_id=? AND tenant_category_id=?", [tenantId, tenantCategoryId]).catch(() => undefined);
}

export async function syncTenantDirectoryServices(slug: string): Promise<void> {
  const tenant = await getTenant(slug);
  const tenantId = Number(tenant?.id ?? 0);
  const tenantSlug = String(tenant?.slug ?? slug);
  if (tenantId <= 0 || !tenantSlug || !await tableExists("tenant_directory_services")) return;
  if (Number(tenant?.marketplace_public_allowed ?? 1) !== 1) {
    await dbExecute("DELETE FROM tenant_directory_services WHERE tenant_id=?", [tenantId]).catch(() => undefined);
    return;
  }

  const services = await listManageServices(slug, { includeInactive: true });
  const mappings = await listServiceCategoryMarketplaceMappings(slug);
  const mappingByCategory = new Map(mappings.map((mapping) => [mapping.tenantCategoryId, mapping]));
  const bookingPublicAllowed = Number(tenant?.booking_public_allowed ?? 1) === 1;
  const seenIds: number[] = [];

  for (const service of services) {
    if (!service.name.trim()) continue;
    seenIds.push(service.id);
    const mapping = service.categoryId ? mappingByCategory.get(service.categoryId) : null;
    const marketplaceCategoryId = mapping?.marketplaceCategoryId ?? null;
    const marketplaceCategorySlug = mapping?.marketplaceCategorySlug ?? "";
    const marketplaceCategoryName = mapping?.marketplaceCategoryName ?? "";
    const searchText = serviceSearchText(service.name, service.categoryName, marketplaceCategoryName, marketplaceCategorySlug);
    await dbExecute(
      `INSERT INTO tenant_directory_services
        (tenant_id,tenant_slug,service_id,service_name,service_category_id,service_category_name,marketplace_category_id,marketplace_category_slug,marketplace_category_name,is_active,booking_enabled,search_text)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT (tenant_id,service_id) DO UPDATE SET
        tenant_slug=EXCLUDED.tenant_slug,
        service_name=EXCLUDED.service_name,
        service_category_id=EXCLUDED.service_category_id,
        service_category_name=EXCLUDED.service_category_name,
        marketplace_category_id=EXCLUDED.marketplace_category_id,
        marketplace_category_slug=EXCLUDED.marketplace_category_slug,
        marketplace_category_name=EXCLUDED.marketplace_category_name,
        is_active=EXCLUDED.is_active,
        booking_enabled=EXCLUDED.booking_enabled,
        search_text=EXCLUDED.search_text`,
      [
        tenantId,
        tenantSlug,
        service.id,
        clean(service.name, 190),
        service.categoryId,
        emptyToNull(clean(service.categoryName, 190)),
        marketplaceCategoryId,
        emptyToNull(clean(marketplaceCategorySlug, 120)),
        emptyToNull(clean(marketplaceCategoryName, 190)),
        service.isActive ? 1 : 0,
        bookingPublicAllowed && service.bookingEnabled ? 1 : 0,
        emptyToNull(searchText),
      ],
    );
  }

  if (seenIds.length) {
    await dbExecute(
      `DELETE FROM tenant_directory_services WHERE tenant_id=? AND service_id NOT IN (${seenIds.map(() => "?").join(",")})`,
      [tenantId, ...seenIds],
    );
  } else {
    await dbExecute("DELETE FROM tenant_directory_services WHERE tenant_id=?", [tenantId]);
  }
}

async function updateRowsByColumn(slug: string, tableName: string, column: string, value: unknown, values: Record<string, unknown>): Promise<void> {
  const table = await tenantTable(slug, tableName);
  const filtered = await filterColumns(table.name, values);
  const entries = Object.entries(filtered).filter(([, entryValue]) => entryValue !== undefined);
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `${quoteIdentifier(key)}=?`).join(",");
  const clauses = [`${quoteIdentifier(column)}=?`];
  const params = [...entries.map(([, entryValue]) => entryValue), value];
  if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
    clauses.push("tenant_id=?");
    params.push(table.tenantId ?? 0);
  }
  await dbExecute(`UPDATE ${quoteIdentifier(table.name)} SET ${assignments} WHERE ${clauses.join(" AND ")}`, params);
}

async function countRowsByColumn(slug: string, tableName: string, column: string, value: unknown, extraWhere = ""): Promise<number> {
  if (!await tableExistsForTenant(slug, tableName)) return 0;
  const table = await tenantTable(slug, tableName);
  if (!await columnExists(table.name, column)) return 0;
  const clauses = [`${quoteIdentifier(column)}=?`];
  const params: unknown[] = [value];
  if (extraWhere) clauses.push(`(${extraWhere})`);
  if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
    clauses.unshift("tenant_id=?");
    params.unshift(table.tenantId ?? 0);
  }
  const rows = await dbQuery<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table.name)} WHERE ${clauses.join(" AND ")}`, params);
  return Number(rows[0]?.count ?? 0) || 0;
}

async function deleteByOwner(slug: string, tableName: string, ownerColumn: string, ownerId: number): Promise<void> {
  const table = await tenantTable(slug, tableName).catch(() => null);
  if (!table || ownerId <= 0 || !await columnExists(table.name, ownerColumn)) return;
  const clauses = [`${quoteIdentifier(ownerColumn)} = ?`];
  const params: unknown[] = [ownerId];
  if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
    clauses.unshift("tenant_id = ?");
    params.unshift(table.tenantId ?? 0);
  }
  await dbExecute(`DELETE FROM ${quoteIdentifier(table.name)} WHERE ${clauses.join(" AND ")}`, params).catch(() => undefined);
}

async function deleteRecommendationsForService(slug: string, serviceId: number): Promise<void> {
  const table = await tenantTable(slug, "service_recommendations").catch(() => null);
  if (!table) return;
  const clauses = ["(service_id=? OR recommended_service_id=?)"];
  const params: unknown[] = [serviceId, serviceId];
  if (table.mode === "shared" && await columnExists(table.name, "tenant_id")) {
    clauses.unshift("tenant_id=?");
    params.unshift(table.tenantId ?? 0);
  }
  await dbExecute(`DELETE FROM ${quoteIdentifier(table.name)} WHERE ${clauses.join(" AND ")}`, params).catch(() => undefined);
}

async function filterColumns(table: string, values: Record<string, unknown>): Promise<Record<string, unknown>> {
  const rows = await dbQuery<RowDataPacket[]>(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table],
  );
  const columns = new Set(rows.map((row) => String(row.column_name ?? row.COLUMN_NAME)));
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => columns.has(key) && value !== undefined));
}

async function tenantScope(target: TenantTarget, clauses: string[], params: unknown[]) {
  const scopedClauses = [...clauses];
  const scopedParams = [...params];
  if (target.mode === "shared" && await columnExists(target.name, "tenant_id")) {
    scopedClauses.unshift("tenant_id = ?");
    scopedParams.unshift(target.tenantId ?? 0);
  }
  return {
    where: scopedClauses.length ? ` WHERE ${scopedClauses.join(" AND ")}` : "",
    params: scopedParams,
  };
}

async function tableExistsForTenant(slug: string, table: string): Promise<boolean> {
  try {
    await tenantTable(slug, table);
    return true;
  } catch {
    return false;
  }
}

function categoryOrderSql(alias = ""): string {
  const prefix = alias ? `${alias}.` : "";
  return [
    `CASE WHEN LOWER(${prefix}name)='non categorizzato' THEN 1 ELSE 0 END ASC`,
    `COALESCE(${prefix}sort_order,999999) ASC`,
    `${prefix}name ASC`,
    `${prefix}id ASC`,
  ].join(", ");
}

function serviceCategoryJoinOrderSql(hasCategory: boolean): string {
  if (!hasCategory) return "COALESCE(s.sort_order,0) ASC";
  return [
    "CASE WHEN c.id IS NULL OR LOWER(c.name)='non categorizzato' THEN 1 ELSE 0 END ASC",
    "COALESCE(c.sort_order,999999) ASC",
    "COALESCE(c.name,'Non categorizzato') ASC",
    "COALESCE(c.id,999999) ASC",
  ].join(", ");
}

function serviceSearchText(...parts: string[]): string {
  return parts.map((part) => clean(part, 190).toLowerCase()).filter(Boolean).join(" ");
}

function isDefaultCategoryName(value: string): boolean {
  return value.trim().toLowerCase() === "non categorizzato";
}

function parseIdList(value: unknown): number[] {
  if (Array.isArray(value)) return uniquePositive(value.map(Number));
  const raw = String(value ?? "");
  if (!raw) return [];
  return uniquePositive(raw.split(/[,\s]+/).map((item) => Number.parseInt(item, 10)));
}

function parseJsonArray<T>(value: unknown): T[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function uniquePositive(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value) && value > 0).map((value) => Math.floor(value))));
}

function fallbackPositive(value: unknown): number[] {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue > 0 ? [Math.floor(numberValue)] : [];
}

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function truthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return ["1", "true", "yes", "on", "si", "sì"].includes(String(value ?? "").trim().toLowerCase());
}

function parseMoneyValue(value: unknown): number {
  const normalized = String(value ?? "0").replace(/\s*euro\s*/i, "").replace(",", ".");
  return parseNumber(normalized, 0);
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function formatMoney(value: number): string {
  return roundMoney(value).toFixed(2).replace(".", ",");
}

function nullableNumber(value: unknown): number | null {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}
