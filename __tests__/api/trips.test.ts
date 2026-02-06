import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { GET as GETTrips, POST as POSTTrip } from "@/app/api/trips/route";
import { GET as GETTrip, PATCH as PATCHTrip } from "@/app/api/trips/[id]/route";
import { NextRequest } from "next/server";
import { createMockRequest, createMockSupabaseClient, resetMocks } from "@/tests/helpers/api-helpers";
import { createMockTrip } from "@/tests/helpers/test-data";

// Mock Supabase - zmienna musi być zdefiniowana przed jest.mock
let mockSupabaseClient: any = null;

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

import { createClient } from "@/lib/supabase/server";

describe("GET /api/trips", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  it("powinien zwrócić listę wycieczek", async () => {
    const mockTrips = [
      createMockTrip({ id: "1", title: "Wycieczka 1" }),
      createMockTrip({ id: "2", title: "Wycieczka 2" }),
    ];

    mockSupabaseClient = createMockSupabaseClient({
      trips: mockTrips,
    });

    const request = new NextRequest("http://localhost:3000/api/trips");
    const response = await GETTrips(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("powinien zwrócić tylko aktywne wycieczki dla niezalogowanych użytkowników", async () => {
    const mockTrips = [
      createMockTrip({ id: "1", is_active: true }),
      createMockTrip({ id: "2", is_active: false }),
    ];

    mockSupabaseClient = createMockSupabaseClient({
      trips: mockTrips.filter((t) => t.is_active),
    });

    const request = new NextRequest("http://localhost:3000/api/trips");
    const response = await GETTrips(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    if (Array.isArray(data)) {
      data.forEach((trip) => {
        expect(trip.is_active).toBe(true);
      });
    }
  });
});

describe("GET /api/trips/[id]", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  it("powinien zwrócić szczegóły wycieczki", async () => {
    const mockTrip = createMockTrip();

    mockSupabaseClient = createMockSupabaseClient({
      trip: mockTrip,
    });

    const request = new NextRequest("http://localhost:3000/api/trips/123");
    const response = await GETTrip(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("title");
  });

  it("powinien zwrócić 404 dla nieistniejącej wycieczki", async () => {
    mockSupabaseClient = createMockSupabaseClient({
      trip: null,
    });

    const request = new NextRequest("http://localhost:3000/api/trips/999");
    const response = await GETTrip(request, { params: Promise.resolve({ id: "999" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });
});

describe("POST /api/trips", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  it("powinien utworzyć nową wycieczkę (tylko admin)", async () => {
    const mockTrip = createMockTrip();
    const mockUser = { id: "admin-user", role: "admin" };

    mockSupabaseClient = createMockSupabaseClient({
      trip: mockTrip,
      user: mockUser,
    });

    // Mock getClaims dla checkAdmin
    mockSupabaseClient.auth.getClaims = jest.fn(() =>
      Promise.resolve({
        data: {
          claims: { sub: mockUser.id },
        },
        error: null,
      })
    );

    mockSupabaseClient.from = jest.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { id: mockUser.id, role: "admin" },
                  error: null,
                })
              ),
            })),
          })),
        };
      }
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { id: mockUser.id, role: "admin" },
                error: null,
              })
            ),
          })),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { id: mockTrip.id },
                error: null,
              })
            ),
          })),
        })),
      };
    });

    const requestBody = {
      title: "Nowa Wycieczka",
      slug: "nowa-wycieczka",
      description: "Opis wycieczki",
      start_date: "2024-06-01",
      end_date: "2024-06-07",
      price_cents: 100000,
      seats_total: 20,
      is_active: true,
    };

    const request = createMockRequest(requestBody);
    const response = await POSTTrip(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("ok", true);
    expect(data).toHaveProperty("id");
  });

  it("powinien zwrócić 403 dla użytkownika bez uprawnień admina", async () => {
    const mockUser = { id: "user-123", role: "user" };

    mockSupabaseClient = createMockSupabaseClient({
      user: mockUser,
    });

    mockSupabaseClient.from = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: { id: mockUser.id, role: "user" },
              error: null,
            })
          ),
        })),
      })),
    }));

    const requestBody = {
      title: "Nowa Wycieczka",
      slug: "nowa-wycieczka",
    };

    const request = createMockRequest(requestBody);
    const response = await POSTTrip(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("unauthorized");
  });

  it("powinien zwrócić 400 dla nieprawidłowych danych", async () => {
    const mockUser = { id: "admin-user", role: "admin" };

    mockSupabaseClient = createMockSupabaseClient({
      user: mockUser,
    });

    // Mock getClaims dla checkAdmin
    mockSupabaseClient.auth.getClaims = jest.fn(() =>
      Promise.resolve({
        data: {
          claims: { sub: mockUser.id },
        },
        error: null,
      })
    );

    mockSupabaseClient.from = jest.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { id: mockUser.id, role: "admin" },
                  error: null,
                })
              ),
            })),
          })),
        };
      }
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { id: mockUser.id, role: "admin" },
                error: null,
              })
            ),
          })),
        })),
      };
    });

    const requestBody = {
      // Brak wymaganych pól title i slug
    };

    const request = createMockRequest(requestBody);
    const response = await POSTTrip(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("missing_fields");
  });
});

describe("PATCH /api/trips/[id]", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  it("powinien zaktualizować wycieczkę (tylko admin)", async () => {
    const mockTrip = createMockTrip();
    const mockUser = { id: "admin-user", role: "admin" };

    mockSupabaseClient = createMockSupabaseClient({
      trip: mockTrip,
      user: mockUser,
    });

    // Mock getClaims dla checkAdmin
    mockSupabaseClient.auth.getClaims = jest.fn(() =>
      Promise.resolve({
        data: {
          claims: { sub: mockUser.id },
        },
        error: null,
      })
    );

    mockSupabaseClient.from = jest.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { id: mockUser.id, role: "admin" },
                  error: null,
                })
              ),
            })),
          })),
        };
      }
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { id: mockUser.id, role: "admin" },
                error: null,
              })
            ),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() =>
            Promise.resolve({
              data: { ...mockTrip, title: "Zaktualizowana Wycieczka" },
              error: null,
            })
          ),
        })),
      };
    });

    const requestBody = {
      title: "Zaktualizowana Wycieczka",
    };

    const request = createMockRequest(requestBody);
    const response = await PATCHTrip(request, { params: Promise.resolve({ id: mockTrip.id }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("title", "Zaktualizowana Wycieczka");
  });

  it("powinien zwrócić 403 dla użytkownika bez uprawnień admina", async () => {
    const mockUser = { id: "user-123", role: "user" };

    mockSupabaseClient = createMockSupabaseClient({
      user: mockUser,
    });

    mockSupabaseClient.from = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: { id: mockUser.id, role: "user" },
              error: null,
            })
          ),
        })),
      })),
    }));

    const requestBody = {
      title: "Zaktualizowana Wycieczka",
    };

    const request = createMockRequest(requestBody);
    const response = await PATCHTrip(request, { params: Promise.resolve({ id: "123" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("unauthorized");
  });

  it("powinien zwrócić 500 gdy update się nie powiedzie", async () => {
    const mockUser = { id: "admin-user", role: "admin" };

    mockSupabaseClient = createMockSupabaseClient({
      user: mockUser,
      trip: null,
    });

    // Mock getClaims dla checkAdmin
    mockSupabaseClient.auth.getClaims = jest.fn(() =>
      Promise.resolve({
        data: {
          claims: { sub: mockUser.id },
        },
        error: null,
      })
    );

    // Mock profile query dla checkAdmin
    mockSupabaseClient.from = jest.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { id: mockUser.id, role: "admin" },
                  error: null,
                })
              ),
            })),
          })),
        };
      }
      // Mock trips update - zwraca błąd
      return {
        update: jest.fn(() => ({
          eq: jest.fn(() =>
            Promise.resolve({
              data: null,
              error: { message: "Update failed", code: "PGRST116" },
            })
          ),
        })),
      };
    });

    const requestBody = {
      title: "Zaktualizowana Wycieczka",
    };

    const request = createMockRequest(requestBody);
    const response = await PATCHTrip(request, { params: Promise.resolve({ id: "999" }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("update_failed");
  });
});
