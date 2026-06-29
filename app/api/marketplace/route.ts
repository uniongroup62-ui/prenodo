import type { RowDataPacket } from "mysql2/promise";
import { dbFirstValue } from "@/lib/db-first";
import { centers, locations, marketplaceCategories } from "@/lib/demo-data";
import { dbQuery } from "@/lib/tenant-db";

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

export async function GET() {
  const { value, sourceMode } = await dbFirstValue(
    () => marketplaceProfiles(),
    () => ({ profiles: demoProfiles(), categories: marketplaceCategories }),
  );

  return Response.json({
    ok: true,
    source: "app/lib/Marketplace.php::publicProfiles",
    sourceMode,
    ...value,
  });
}

async function marketplaceProfiles(): Promise<{ profiles: MarketplaceProfile[]; categories: string[] }> {
  const rows = await dbQuery<RowDataPacket[]>(`
    SELECT
      t.id AS tenant_id,
      t.slug,
      COALESCE(NULLIF(MAX(b.name), ''), t.name) AS business_name,
      COALESCE(NULLIF(MAX(b.site_city), ''), NULLIF(MAX(b.quote_city), ''), NULLIF(MIN(l.legal_city), ''), '') AS city,
      COALESCE(NULLIF(MAX(b.site_province), ''), NULLIF(MAX(b.quote_province), ''), '') AS area,
      MIN(l.id) AS first_location_id,
      COALESCE(NULLIF(MIN(l.name), ''), 'Sede principale') AS first_location_name,
      COALESCE(NULLIF(MIN(l.address), ''), NULLIF(MAX(b.site_address), ''), NULLIF(MAX(b.address), ''), '') AS first_address,
      MIN(s.price) AS price_from,
      string_agg(DISTINCT COALESCE(NULLIF(sc.name, ''), NULLIF(s.name, ''))::text, '||' ORDER BY COALESCE(NULLIF(sc.name, ''), NULLIF(s.name, ''))::text ASC) AS service_labels,
      COUNT(DISTINCT l.id) AS location_count,
      COUNT(DISTINCT s.id) AS service_count
    FROM saas_tenants t
    LEFT JOIN businesses b ON b.tenant_id = t.id
    LEFT JOIN locations l ON l.tenant_id = t.id AND COALESCE(l.is_active, 1) = 1 AND COALESCE(l.marketplace_enabled, 1) = 1
    LEFT JOIN services s ON s.tenant_id = t.id AND COALESCE(s.is_active, 1) = 1 AND COALESCE(s.booking_enabled, 1) = 1
    LEFT JOIN service_categories sc ON sc.tenant_id = t.id AND sc.id = s.category_id
    WHERE COALESCE(t.is_active, 1) = 1
      AND t.deleted_at IS NULL
      AND t.status = 'active'
      AND COALESCE(t.marketplace_public_allowed, 1) = 1
    GROUP BY t.id, t.slug, t.name
    HAVING COUNT(DISTINCT l.id) > 0 OR COUNT(DISTINCT s.id) > 0
    ORDER BY business_name ASC, t.id ASC
  `);

  const categories = await marketplaceDbCategories(rows);
  const profiles = await Promise.all(rows.map((row, index) => profileFromRow(row, index)));
  return { profiles, categories };
}

async function profileFromRow(row: RowDataPacket, index: number): Promise<MarketplaceProfile> {
  const tenantId = Number(row.tenant_id ?? 0);
  const slug = String(row.slug ?? "");
  const locationRows = tenantId > 0
    ? await dbQuery<RowDataPacket[]>(`
      SELECT id, name, address, legal_city, legal_province
      FROM locations
      WHERE tenant_id = ? AND COALESCE(is_active, 1) = 1 AND COALESCE(marketplace_enabled, 1) = 1
      ORDER BY sort_order ASC, name ASC
      LIMIT 6
    `, [tenantId]).catch(() => [] as RowDataPacket[])
    : [];
  const services = splitLabels(row.service_labels).slice(0, 4);
  const fallback = centers.find((center) => center.slug === slug) ?? centers[index % centers.length] ?? centers[0];
  const city = String(row.city ?? "").trim();
  const area = String(row.area ?? "").trim() || city || fallback.area;
  const price = Number(row.price_from ?? 0);

  return {
    slug,
    name: String(row.business_name ?? fallback.name),
    category: services[0] ?? fallback.category,
    area,
    rating: fallback.rating,
    reviews: fallback.reviews,
    nextSlot: fallback.nextSlot,
    priceFrom: price > 0 ? `Da ${roundMoney(price)} euro` : fallback.priceFrom,
    image: fallback.image,
    services: services.length ? services : fallback.services,
    locations: (locationRows.length ? locationRows : [row]).map((location) => ({
      id: Number(location.id ?? row.first_location_id ?? 0),
      name: String(location.name ?? row.first_location_name ?? "Sede principale"),
      city: String(location.legal_city ?? city),
      area: String(location.legal_province ?? area),
      address: String(location.address ?? row.first_address ?? ""),
    })),
  };
}

async function marketplaceDbCategories(rows: RowDataPacket[]): Promise<string[]> {
  const categoryRows = await dbQuery<RowDataPacket[]>(`
    SELECT name
    FROM marketplace_activity_categories
    WHERE COALESCE(is_active, 1) = 1
    ORDER BY sort_order ASC, name ASC
  `).catch(() => [] as RowDataPacket[]);
  const fromTable = categoryRows.map((row) => String(row.name ?? "").trim()).filter(Boolean);
  if (fromTable.length) return fromTable;
  const fromServices = rows.flatMap((row) => splitLabels(row.service_labels));
  return Array.from(new Set(fromServices.length ? fromServices : marketplaceCategories));
}

function demoProfiles(): MarketplaceProfile[] {
  return centers.map((center) => ({
    ...center,
    locations: locations
      .filter((location) => location.tenantSlug === center.slug)
      .map((location) => ({
        id: location.id,
        name: location.name,
        city: location.city,
        area: location.area,
        address: location.address,
      })),
  }));
}

function splitLabels(value: unknown): string[] {
  return String(value ?? "")
    .split("||")
    .map((item) => item.trim())
    .filter(Boolean);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
