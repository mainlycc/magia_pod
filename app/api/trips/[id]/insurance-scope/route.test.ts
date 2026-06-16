import { GET } from "./route";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(async () => ({})),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { form_extra_insurances: [] }, error: null }),
        }),
      }),
    }),
  })),
}));

jest.mock("@/lib/trips/can-manage-trip", () => ({
  canManageTrip: jest.fn(async () => true),
}));

jest.mock("@/lib/agreement-insurance-scope", () => ({
  buildInsuranceScope: jest.fn(async () => "SCOPE"),
}));

describe("GET /api/trips/[id]/insurance-scope", () => {
  it("zwraca scope gdy user ma uprawnienia", async () => {
    const res = await GET(new Request("http://localhost:3000/api/trips/x/insurance-scope"), {
      params: Promise.resolve({ id: "trip-1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scope).toBe("SCOPE");
  });

  it("zwraca 403 gdy brak uprawnień", async () => {
    const { canManageTrip } = await import("@/lib/trips/can-manage-trip");
    (canManageTrip as jest.Mock).mockResolvedValueOnce(false);

    const res = await GET(new Request("http://localhost:3000/api/trips/x/insurance-scope"), {
      params: Promise.resolve({ id: "trip-1" }),
    });
    expect(res.status).toBe(403);
  });
});

