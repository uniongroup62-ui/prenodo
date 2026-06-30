// Shared domain TYPE definitions (formerly the prototype's in-memory demo data
// module). All the hardcoded demo arrays, the `centerBySlug`/`locationsByTenant`
// helpers and the seeded center/location/service/product data have been removed:
// the app is purely DB-backed and multi-tenant-clean. What remains are the base
// shapes that other modules build on:
//   - `Client` / `Service` / `Product` are extended by the Managed* types in
//     lib/tenant-store.ts.
//   - `Location` is the row shape returned by lib/db-repositories.ts.
//   - `Appointment` / `AppointmentStatus` are re-declared as the canonical
//     appointment shapes in lib/appointment-engine.ts; kept here for any legacy
//     type consumer.

export type AppointmentStatus = "Confermato" | "In attesa" | "Completato";

export type Appointment = {
  id: number;
  time: string;
  client: string;
  service: string;
  operator: string;
  room: string;
  price: string;
  status: AppointmentStatus;
};

export type Service = {
  name: string;
  duration: string;
  price: string;
  category: string;
  demand: string;
  color: string;
};

export type Client = {
  name: string;
  lastVisit: string;
  value: string;
  next: string;
  note: string;
};

export type Center = {
  name: string;
  slug: string;
  category: string;
  area: string;
  rating: string;
  reviews: number;
  nextSlot: string;
  priceFrom: string;
  image: string;
  accent: string;
  services: string[];
};

export type Location = {
  id: number;
  tenantSlug: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  area: string;
  phone: string;
  hoursToday: string;
  bookingEnabled: boolean;
  marketplaceEnabled: boolean;
};

export type Product = {
  id: number;
  name: string;
  category: string;
  brand: string;
  price: string;
  image: string;
};
