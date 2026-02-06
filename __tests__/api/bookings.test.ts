import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { POST } from "@/app/api/bookings/route";
import { NextRequest } from "next/server";
import { createMockRequest, createMockSupabaseClient, resetMocks } from "@/tests/helpers/api-helpers";
import { createMockTrip, createMockBooking } from "@/tests/helpers/test-data";

// Mock Supabase - zmienne muszą być zdefiniowane przed jest.mock
let mockSupabaseClient: any = null;
let mockAdminClient: any = null;
const mockCreatePaynowPayment = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(() => mockAdminClient),
}));

jest.mock("@/lib/paynow", () => ({
  createPaynowPayment: mockCreatePaynowPayment,
}));

jest.mock("@/lib/email/templates/booking-confirmation", () => ({
  generateBookingConfirmationEmail: jest.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaynowPayment } from "@/lib/paynow";

describe("POST /api/bookings", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    mockCreatePaynowPayment.mockClear();
    
    // Mock fetch dla wywołań do /api/pdf i /api/email
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

    mockSupabaseClient = createMockSupabaseClient({
      trip: mockTrip,
      trips: [mockTrip], // Dodaj trips jako tablicę dla .or() query
      reservedTrip: { id: mockTrip.id },
    });

    mockAdminClient = {
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
        if (table === "bookings") {
          return {
            select: jest.fn((columns?: string) => ({
              single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn((columns?: string) => ({
                single: jest.fn(() => Promise.resolve({ 
                  data: { id: mockBooking.id, booking_ref: mockBooking.booking_ref }, 
                  error: null 
                })),
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
              select: jest.fn(() => Promise.resolve({ 
                data: [{ id: "participant-id" }], 
                error: null 
              })),
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

    const requestBody = {
      slug: mockTrip.slug,
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

    const request = createMockRequest(requestBody);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty("booking_ref");
    expect(data).toHaveProperty("booking_url");
  });

  it("powinien zwrócić błąd gdy wycieczka nie istnieje", async () => {
    mockSupabaseClient = createMockSupabaseClient({
      trip: null,
    });

    const requestBody = {
      slug: "nieistniejaca-wycieczka",
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

    const request = createMockRequest(requestBody);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Trip not found or inactive");
  });

  it("powinien zwrócić błąd gdy brak miejsc", async () => {
    const mockTrip = createMockTrip({
      seats_total: 10,
      seats_reserved: 10, // Wszystkie miejsca zajęte
    });

    mockSupabaseClient = createMockSupabaseClient({
      trip: mockTrip,
      trips: [mockTrip], // Dodaj trips jako tablicę dla .or() query
    });

    const requestBody = {
      slug: mockTrip.slug,
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

    const request = createMockRequest(requestBody);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Not enough seats");
  });

  it("powinien zwrócić błąd walidacji dla nieprawidłowych danych", async () => {
    mockSupabaseClient = createMockSupabaseClient();

    const requestBody = {
      slug: "test-trip",
      // Brak wymaganych pól
      contact_email: "nieprawidlowy-email", // Nieprawidłowy email
      participants: [], // Brak uczestników
    };

    const request = createMockRequest(requestBody);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid payload");
  });

  it("powinien utworzyć rezerwację z płatnością", async () => {
    const mockTrip = createMockTrip();
    const mockBooking = createMockBooking();

    mockSupabaseClient = createMockSupabaseClient({
      trip: mockTrip,
      trips: [mockTrip], // Dodaj trips jako tablicę dla .or() query
      reservedTrip: { id: mockTrip.id },
    });

    mockAdminClient = {
      rpc: jest.fn((fnName: string, params?: any) => {
        if (fnName === "create_booking") {
          return Promise.resolve({
            data: { id: mockBooking.id, booking_ref: mockBooking.booking_ref },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      from: jest.fn((table: string) => {
        if (table === "bookings") {
          return {
            select: jest.fn((columns?: string) => ({
              single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn((columns?: string) => ({
                single: jest.fn(() => Promise.resolve({ 
                  data: { id: mockBooking.id, booking_ref: mockBooking.booking_ref }, 
                  error: null 
                })),
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
              select: jest.fn(() => Promise.resolve({ 
                data: [{ id: "participant-id" }], 
                error: null 
              })),
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

    mockCreatePaynowPayment.mockResolvedValue({
      paymentId: "PAYNOW-123",
      redirectUrl: "https://paynow.pl/payment/123",
    });

    const requestBody = {
      slug: mockTrip.slug,
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

    const request = createMockRequest(requestBody);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty("redirect_url");
    expect(createPaynowPayment).toHaveBeenCalled();
  });

  it("powinien obsłużyć rezerwację dla firmy", async () => {
    const mockTrip = createMockTrip();
    const mockBooking = createMockBooking();

    mockSupabaseClient = createMockSupabaseClient({
      trip: mockTrip,
      trips: [mockTrip], // Dodaj trips jako tablicę dla .or() query
      reservedTrip: { id: mockTrip.id },
    });

    mockAdminClient = {
      rpc: jest.fn((fnName: string, params?: any) => {
        if (fnName === "create_booking") {
          return Promise.resolve({
            data: { id: mockBooking.id, booking_ref: mockBooking.booking_ref },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      from: jest.fn((table: string) => {
        if (table === "bookings") {
          return {
            select: jest.fn((columns?: string) => ({
              single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn((columns?: string) => ({
                single: jest.fn(() => Promise.resolve({ 
                  data: { id: mockBooking.id, booking_ref: mockBooking.booking_ref }, 
                  error: null 
                })),
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
              select: jest.fn(() => Promise.resolve({ 
                data: [{ id: "participant-id" }], 
                error: null 
              })),
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

    const requestBody = {
      slug: mockTrip.slug,
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

    const request = createMockRequest(requestBody);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty("booking_ref");
  });
});
