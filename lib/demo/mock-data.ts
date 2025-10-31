export type DemoTrip = {
  id: string;
  title: string;
  slug: string;
  dateRange: string;
  location: string;
  price: number;
  spotsTotal: number;
  spotsLeft: number;
  isActive: boolean;
  shortDescription: string;
};

export const demoTrips: DemoTrip[] = [
  {
    id: "t1",
    title: "Islandia – Zorza i wodospady",
    slug: "islandia-zorza",
    dateRange: "12–20 sty 2026",
    location: "Islandia",
    price: 7490,
    spotsTotal: 16,
    spotsLeft: 4,
    isActive: true,
    shortDescription:
      "Epicka wyprawa po islandzkich wodospadach, lodowcach i gorących źródłach.",
  },
  {
    id: "t2",
    title: "Gruzja – Góry, wino i kuchnia",
    slug: "gruzja-gory-wino",
    dateRange: "5–13 mar 2026",
    location: "Gruzja",
    price: 4890,
    spotsTotal: 20,
    spotsLeft: 11,
    isActive: true,
    shortDescription:
      "Kaukaskie krajobrazy, tysięczne tradycje i wyjątkowa gościnność.",
  },
];

export type DemoParticipant = {
  id: string;
  name: string;
  email: string;
  status: "confirmed" | "pending" | "cancelled";
};

export const demoParticipants: DemoParticipant[] = [
  { id: "u1", name: "Anna Kowalska", email: "anna@example.com", status: "confirmed" },
  { id: "u2", name: "Jan Nowak", email: "jan@example.com", status: "pending" },
  { id: "u3", name: "Piotr Zieliński", email: "piotr@example.com", status: "confirmed" },
];

export type DemoMessage = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
};

export const demoMessages: DemoMessage[] = [
  { id: "m1", author: "Koord.", content: "Pamiętajcie o kurtkach przeciwdeszczowych.", createdAt: "2025-10-01 10:20" },
  { id: "m2", author: "Anna", content: "Czy zabieramy raki na lodowiec?", createdAt: "2025-10-01 11:05" },
  { id: "m3", author: "Koord.", content: "Tak, zapewniamy na miejscu.", createdAt: "2025-10-01 11:15" },
];


