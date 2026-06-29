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

export const appointments: Appointment[] = [
  {
    id: 1,
    time: "09:00",
    client: "Giulia R.",
    service: "Pulizia viso Hydra",
    operator: "Marta",
    room: "Cabina 2",
    price: "85 euro",
    status: "Confermato",
  },
  {
    id: 2,
    time: "10:30",
    client: "Elena P.",
    service: "Manicure gel",
    operator: "Sara",
    room: "Nails bar",
    price: "42 euro",
    status: "Completato",
  },
  {
    id: 3,
    time: "12:00",
    client: "Martina F.",
    service: "Massaggio decontratturante",
    operator: "Nora",
    room: "Cabina 1",
    price: "70 euro",
    status: "In attesa",
  },
  {
    id: 4,
    time: "15:30",
    client: "Chiara V.",
    service: "Laminazione ciglia",
    operator: "Marta",
    room: "Cabina 3",
    price: "58 euro",
    status: "Confermato",
  },
];

export const services: Service[] = [
  {
    name: "Pulizia viso Hydra",
    duration: "60 min",
    price: "85 euro",
    category: "Viso",
    demand: "+18%",
    color: "bg-emerald-100 text-emerald-800",
  },
  {
    name: "Manicure gel",
    duration: "45 min",
    price: "42 euro",
    category: "Nails",
    demand: "+11%",
    color: "bg-rose-100 text-rose-800",
  },
  {
    name: "Massaggio relax",
    duration: "50 min",
    price: "65 euro",
    category: "Corpo",
    demand: "+7%",
    color: "bg-sky-100 text-sky-800",
  },
  {
    name: "Laminazione ciglia",
    duration: "40 min",
    price: "58 euro",
    category: "Sguardo",
    demand: "+22%",
    color: "bg-amber-100 text-amber-800",
  },
];

export const clients: Client[] = [
  {
    name: "Giulia Rinaldi",
    lastVisit: "12 giugno",
    value: "620 euro",
    next: "Oggi 09:00",
    note: "Preferisce prodotti senza profumo",
  },
  {
    name: "Elena Parisi",
    lastVisit: "20 giugno",
    value: "340 euro",
    next: "Oggi 10:30",
    note: "Pacchetto nails attivo",
  },
  {
    name: "Martina Ferri",
    lastVisit: "3 maggio",
    value: "415 euro",
    next: "Oggi 12:00",
    note: "Richiamare per follow-up",
  },
];

export const centers: Center[] = [
  {
    name: "Centro Estetico Elite",
    slug: "centroesteticoelite",
    category: "Estetica avanzata",
    area: "Centro storico",
    rating: "4.9",
    reviews: 286,
    nextSlot: "Oggi 15:30",
    priceFrom: "Da 35 euro",
    image:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=80",
    accent: "bg-emerald-600",
    services: ["Viso", "Nails", "Massaggi"],
  },
  {
    name: "Studio Armonia",
    slug: "studioarmonia",
    category: "Massaggi e benessere",
    area: "Porta Romana",
    rating: "4.8",
    reviews: 174,
    nextSlot: "Domani 11:00",
    priceFrom: "Da 45 euro",
    image:
      "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=900&q=80",
    accent: "bg-sky-600",
    services: ["Relax", "Corpo", "Spa"],
  },
  {
    name: "Nail Lab Milano",
    slug: "naillabmilano",
    category: "Nails specialist",
    area: "Isola",
    rating: "4.7",
    reviews: 212,
    nextSlot: "Oggi 18:00",
    priceFrom: "Da 28 euro",
    image:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80",
    accent: "bg-rose-600",
    services: ["Gel", "Nail art", "Pedicure"],
  },
];

export const locations: Location[] = [
  {
    id: 1,
    tenantSlug: "centroesteticoelite",
    slug: "milano-centro-storico-1",
    name: "Elite Milano Centro",
    address: "Via Torino 18",
    city: "Milano",
    area: "Centro storico",
    phone: "+39 02 1234 8890",
    hoursToday: "Oggi 09:00 - 19:30",
    bookingEnabled: true,
    marketplaceEnabled: true,
  },
  {
    id: 2,
    tenantSlug: "centroesteticoelite",
    slug: "milano-porta-romana-2",
    name: "Elite Porta Romana",
    address: "Corso Lodi 42",
    city: "Milano",
    area: "Porta Romana",
    phone: "+39 02 7788 1122",
    hoursToday: "Oggi 10:00 - 18:00",
    bookingEnabled: true,
    marketplaceEnabled: true,
  },
  {
    id: 3,
    tenantSlug: "studioarmonia",
    slug: "milano-porta-romana-3",
    name: "Studio Armonia",
    address: "Via Crema 9",
    city: "Milano",
    area: "Porta Romana",
    phone: "+39 02 4455 0101",
    hoursToday: "Oggi 10:00 - 20:00",
    bookingEnabled: true,
    marketplaceEnabled: true,
  },
];

export const operators = ["Marta", "Sara", "Nora", "Livia"];

export const slots = ["09:00", "10:30", "12:00", "15:30", "17:00", "18:30"];

export const categories = ["Tutti", "Estetica avanzata", "Massaggi e benessere", "Nails specialist"];

export const centerServices = [
  {
    name: "Pulizia viso Hydra",
    duration: "60 min",
    price: "85 euro",
    description: "Detersione profonda, ossigenazione e maschera lenitiva.",
  },
  {
    name: "Manicure gel",
    duration: "45 min",
    price: "42 euro",
    description: "Forma, cuticole, base rinforzante e colore semipermanente.",
  },
  {
    name: "Massaggio relax",
    duration: "50 min",
    price: "65 euro",
    description: "Trattamento corpo distensivo con oli botanici.",
  },
  {
    name: "Laminazione ciglia",
    duration: "40 min",
    price: "58 euro",
    description: "Curvatura, fissaggio e trattamento nutriente.",
  },
];

export const marketplaceCategories = [
  "Trattamenti viso",
  "Nails",
  "Massaggi",
  "Epilazione laser",
  "Make-up",
  "Rimodellamento",
];

export const bookingSteps = [
  "Sede",
  "Categoria",
  "Servizi",
  "Professionista",
  "Ora",
  "Vantaggi",
  "Conferma",
];

export const products: Product[] = [
  {
    id: 1,
    name: "Siero Hydra Glow",
    category: "Skincare",
    brand: "Elite Lab",
    price: "38 euro",
    image:
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: 2,
    name: "Crema notte repair",
    category: "Viso",
    brand: "Dermalux",
    price: "46 euro",
    image:
      "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: 3,
    name: "Olio corpo botanico",
    category: "Corpo",
    brand: "Natura Spa",
    price: "29 euro",
    image:
      "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=700&q=80",
  },
];

export function centerBySlug(slug: string): Center | undefined {
  return centers.find((center) => center.slug === slug);
}

export function locationsByTenant(slug: string): Location[] {
  return locations.filter((location) => location.tenantSlug === slug);
}

export const galleryImages = [
  "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=900&q=80",
];
