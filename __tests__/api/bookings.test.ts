import { describe, it, expect, beforeEach, beforeAll, jest } from "@jest/globals";
import { createMockRequest, createMockSupabaseClient, resetMocks } from "@/tests/helpers/api-helpers";
import { createMockTrip, createMockBooking, MOCK_REGISTRATION_TOKEN } from "@/tests/helpers/test-data";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/paynow", () => ({
  createPaynowPayment: jest.fn(),
}));

jest.mock("@/lib/email/templates/booking-confirmation", () => ({
  generateBookingConfirmationEmail: jest.fn(),
}));

const { createClient } = jest.requireMock<{ createClient: jest.Mock }>("@/lib/supabase/server");
const { createAdminClient } = jest.requireMock<{ createAdminClient: jest.Mock }>("@/lib/supabase/admin");
const { createPaynowPayment } = jest.requireMock<{ createPaynowPayment: jest.Mock }>("@/lib/paynow");

let POST: (request: ReturnType<typeof createMockRequest>) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import("@/app/api/bookings/route"));
});

function createTripsTableMock(mockTrip: ReturnType<typeof createMockTrip> | null) {
  const tripRegistrationRow = mockTrip
    ? {
        id: mockTrip.id,
        slug: mockTrip.slug,
        public_slug: mockTrip.public_slug ?? null,
        is_active: mockTrip.is_active ?? true,
        registration_token: mockTrip.registration_token ?? MOCK_REGISTRATION_TOKEN,
      }
    : null;

  return {
    select: jest.fn(() => ({
      eq: jest.fn((column: string, value: string) => ({
        maybeSingle: jest.fn(() => {
          if (!tripRegistrationRow) {
            return Promise.resolve({ data: null, error: null });
          }

          const matches =
            (column === "slug" && tripRegistrationRow.slug === value) ||
            (column === "public_slug" && tripRegistrationRow.public_slug === value);

          return Promise.resolve({
            data: matches ? tripRegistrationRow : null,
            error: null,
          });
        }),
      })),
    })),
  };
}

function createMockAdminClientForBookings(
  mockTrip: ReturnType<typeof createMockTrip> | null,
  mockBooking: ReturnType<typeof createMockBooking>,
) {
  return {
    rpc: jest.fn((fnName: string) => {
      if (fnName === "create_booking") {
        return Promise.resolve({
          data: { id: mockBooking.id, booking_ref: mockBooking.booking_ref },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    from: jest.fn((table: string) => {
      if (table === "trips") {
        return createTripsTableMock(mockTrip);
      }
      if (table === "bookings") {
        return {
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
            })),
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: {
                    id: mockBooking.id,
                    booking_ref: mockBooking.booking_ref,
                  },
                  error: null,
                }),
              ),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        };
      }
      if (table === "participants") {
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() =>
              Promise.resolve({
                data: [{ id: "participant-id" }],
                error: null,
              }),
            ),
          })),
        };
      }
      return {
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      };
    }),
  };
}

describe("POST /api/bookings", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    createClient.mockReset();
    createAdminClient.mockReset();
    createPaynowPayment.mockClear();

    global.fetch = jest.fn() as jest.Mock;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        base64: "dGVzdCBwZGYgY29udGVudA==",
        filename: "umowa.pdf",
      }),
    });
  });

  it("powinien utworzyć rezerwację dla osoby fizycznej", async () => {
    const mockTrip = createMockTrip();
    const mockBooking = createMockBooking();

    createClient.mockResolvedValue(
      createMockSupabaseClient({
        trip: mockTrip,
        trips: [mockTrip],
        reservedTrip: { id: mockTrip.id },
      }),
    );
    createAdminClient.mockReturnValue(createMockAdminClientForBookings(mockTrip, mockBooking));

    const requestBody = {
      slug: mockTrip.slug,
      registration_token: mockTrip.registration_token,
      contact_first_name: "Jan",
      contact_last_name: "Kowalski",
      contact_pesel: "12345678901",
      contact_email: "jan.kowalski@example.com",
      contact_phone: "123456789",
      address: {
        street: "ul. Testowa 1",
        city: "Warszawa",
        zip: "00-001",
      },
      participants: [
        {
          first_name: "Jan",
          last_name: "Kowalski",
          birth_date: "1990-01-01",
          pesel: "12345678901",
        },
      ],
      consents: {
        rodo: true,
        terms: true,
        conditions: true,
      },
      applicant_type: "individual",
      invoice_type: "contact",
      with_payment: false,
    };

    const response = await POST(createMockRequest(requestBody));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty("booking_ref");
    expect(data).toHaveProperty("booking_url");
  });

  it("powinien zwrócić błąd gdy wycieczka nie istnieje", async () => {
    createClient.mockResolvedValue(createMockSupabaseClient({ trip: null }));
    createAdminClient.mockReturnValue(createMockAdminClientForBookings(null, createMockBooking()));

    const requestBody = {
      slug: "nieistniejaca-wycieczka",
      registration_token: MOCK_REGISTRATION_TOKEN,
      contact_email: "test@example.com",
      contact_phone: "123456789",
      participants: [
        {
          first_name: "Jan",
          last_name: "Kowalski",
          birth_date: "1990-01-01",
        },
      ],
      consents: {
        rodo: true,
        terms: true,
        conditions: true,
      },
    };

    const response = await POST(createMockRequest(requestBody));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("trip_not_found");
  });

  it("powinien zwrócić błąd gdy brak tokenu rejestracji", async () => {
    createClient.mockResolvedValue(createMockSupabaseClient());

    const requestBody = {
      slug: "test-trip",
      contact_email: "test@example.com",
      contact_phone: "123456789",
      participants: [
        {
          first_name: "Jan",
          last_name: "Kowalski",
          birth_date: "1990-01-01",
        },
      ],
      consents: {
        rodo: true,
        terms: true,
        conditions: true,
      },
    };

    const response = await POST(createMockRequest(requestBody));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid payload");
  });

  it("powinien zwrócić błąd gdy brak miejsc", async () => {
    const mockTrip = createMockTrip({
      seats_total: 10,
      seats_reserved: 10,
    });

    createClient.mockResolvedValue(
      createMockSupabaseClient({
        trip: mockTrip,
        trips: [mockTrip],
      }),
    );
    createAdminClient.mockReturnValue(createMockAdminClientForBookings(mockTrip, createMockBooking()));

    const requestBody = {
      slug: mockTrip.slug,
      registration_token: mockTrip.registration_token,
      contact_email: "test@example.com",
      contact_phone: "123456789",
      participants: [
        {
          first_name: "Jan",
          last_name: "Kowalski",
          birth_date: "1990-01-01",
        },
      ],
      consents: {
        rodo: true,
        terms: true,
        conditions: true,
      },
    };

    const response = await POST(createMockRequest(requestBody));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Not enough seats");
  });

  it("powinien zwrócić błąd gdy token rejestracji jest niepoprawny", async () => {
    const mockTrip = createMockTrip();

    createClient.mockResolvedValue(createMockSupabaseClient({ trip: mockTrip, trips: [mockTrip] }));
    createAdminClient.mockReturnValue(createMockAdminClientForBookings(mockTrip, createMockBooking()));

    const requestBody = {
      slug: mockTrip.slug,
      registration_token: "22222222-2222-4222-8222-222222222222",
      contact_email: "test@example.com",
      contact_phone: "123456789",
      participants: [
        {
          first_name: "Jan",
          last_name: "Kowalski",
          birth_date: "1990-01-01",
        },
      ],
      consents: {
        rodo: true,
        terms: true,
        conditions: true,
      },
    };

    const response = await POST(createMockRequest(requestBody));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("invalid_token");
  });

  it("powinien zwrócić błąd walidacji dla nieprawidłowych danych", async () => {
    createClient.mockResolvedValue(createMockSupabaseClient());

    const requestBody = {
      slug: "test-trip",
      contact_email: "nieprawidlowy-email",
      participants: [],
    };

    const response = await POST(createMockRequest(requestBody));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid payload");
  });

  it("powinien utworzyć rezerwację z płatnością", async () => {
    const mockTrip = createMockTrip();
    const mockBooking = createMockBooking();

    createClient.mockResolvedValue(
      createMockSupabaseClient({
        trip: mockTrip,
        trips: [mockTrip],
        reservedTrip: { id: mockTrip.id },
      }),
    );
    createAdminClient.mockReturnValue(createMockAdminClientForBookings(mockTrip, mockBooking));

    createPaynowPayment.mockResolvedValue({
      paymentId: "PAYNOW-123",
      redirectUrl: "https://paynow.pl/payment/123",
    });

    const requestBody = {
      slug: mockTrip.slug,
      registration_token: mockTrip.registration_token,
      contact_first_name: "Jan",
      contact_last_name: "Kowalski",
      contact_email: "jan.kowalski@example.com",
      contact_phone: "123456789",
      participants: [
        {
          first_name: "Jan",
          last_name: "Kowalski",
          birth_date: "1990-01-01",
        },
      ],
      consents: {
        rodo: true,
        terms: true,
        conditions: true,
      },
      applicant_type: "individual",
      invoice_type: "contact",
      with_payment: true,
    };

    const response = await POST(createMockRequest(requestBody));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty("redirect_url");
    expect(createPaynowPayment).toHaveBeenCalled();
  });

  it("powinien obsłużyć rezerwację dla firmy", async () => {
    const mockTrip = createMockTrip();
    const mockBooking = createMockBooking();

    createClient.mockResolvedValue(
      createMockSupabaseClient({
        trip: mockTrip,
        trips: [mockTrip],
        reservedTrip: { id: mockTrip.id },
      }),
    );
    createAdminClient.mockReturnValue(createMockAdminClientForBookings(mockTrip, mockBooking));

    const requestBody = {
      slug: mockTrip.slug,
      registration_token: mockTrip.registration_token,
      contact_email: "firma@example.com",
      contact_phone: "123456789",
      company_name: "Testowa Firma Sp. z o.o.",
      company_nip: "1234567890",
      company_address: {
        street: "ul. Firmowa 1",
        city: "Warszawa",
        zip: "00-001",
      },
      participants: [
        {
          first_name: "Uczestnik 1",
          last_name: "(dane do uzupełnienia)",
          birth_date: "1990-01-01",
        },
      ],
      consents: {
        rodo: true,
        terms: true,
        conditions: true,
      },
      applicant_type: "company",
      invoice_type: "company",
      with_payment: false,
    };

    const response = await POST(createMockRequest(requestBody));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty("booking_ref");
  });
});
