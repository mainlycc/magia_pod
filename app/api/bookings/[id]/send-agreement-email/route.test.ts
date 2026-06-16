import { POST } from "./route";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(async () => ({
    auth: { getClaims: jest.fn(async () => ({ data: { claims: { sub: "u1" } } })) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: "admin" }, error: null }),
        }),
      }),
    }),
  })),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(() => ({
    from: (table: string) => {
      if (table === "bookings") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: "b1",
                  booking_ref: "BK-1",
                  contact_email: "x@example.com",
                  access_token: "t",
                  trips: { id: "t1", title: "Trip" },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "agreements") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [{ id: "a1", pdf_url: "path.pdf", status: "generated" }],
                  error: null,
                }),
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      return { select: () => ({}) } as any;
    },
    storage: {
      from: () => ({
        download: async () => ({
          data: new Blob([new Uint8Array(6000)]),
          error: null,
        }),
      }),
    },
  })),
}));

jest.mock("@/lib/email/send-transactional", () => ({
  sendTransactionalEmail: jest.fn(async () => ({ ok: true })),
}));

describe("POST /api/bookings/[id]/send-agreement-email", () => {
  it("zwraca 200 i ustawia sent_at gdy PDF jest poprawny", async () => {
    const req = new Request("http://localhost:3000/api/bookings/b1/send-agreement-email", {
      method: "POST",
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.sent_at).toBeTruthy();
  });

  it("zwraca 500 gdy PDF jest podejrzanie mały", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as jest.Mock).mockReturnValueOnce({
      from: (table: string) => {
        if (table === "bookings") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: "b1",
                    booking_ref: "BK-1",
                    contact_email: "x@example.com",
                    access_token: "t",
                    trips: { id: "t1", title: "Trip" },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "agreements") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [{ id: "a1", pdf_url: "path.pdf", status: "generated" }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return { select: () => ({}) } as any;
      },
      storage: {
        from: () => ({
          download: async () => ({
            data: new Blob([new Uint8Array(100)]),
            error: null,
          }),
        }),
      },
    });

    const req = new Request("http://localhost:3000/api/bookings/b1/send-agreement-email", { method: "POST" });
    const res = await POST(req as any, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(500);
  });
});

