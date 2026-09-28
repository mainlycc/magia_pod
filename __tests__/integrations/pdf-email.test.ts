import { describe, it, expect, beforeEach, beforeAll, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { createMockRequest, createMockSupabaseClient, resetMocks } from "@/tests/helpers/api-helpers";
import { createMockBooking, createMockTrip } from "@/tests/helpers/test-data";

// Mock Supabase - zmienne muszą być zdefiniowane przed jest.mock
let mockSupabaseClient: any = null;
let mockAdminClient: any = null;

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(() => mockAdminClient),
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn(() =>
        Promise.resolve({
          id: "email-id-123",
          from: "test@example.com",
          to: ["recipient@example.com"],
          subject: "Test Email",
          error: null, // Upewnij się, że error jest null, nie undefined
        })
      ),
    },
  })),
}));
jest.mock("@/lib/pdf-generator", () => ({
  generatePdfFromHtml: jest.fn((_html: string, filename: string) =>
    Promise.resolve({ base64: Buffer.from("%PDF-1.4 test").toString("base64"), filename }),
  ),
}));

/** Klient admina dla /api/pdf: wiersz wycieczki, puste warianty ubezpieczeń i udany upload. */
function createPdfAdminClient(tripRow: unknown) {
  return {
    from: jest.fn((table: string) => {
      const result =
        table === "trips"
          ? { data: tripRow, error: null }
          : { data: table === "trip_insurance_variants" ? [] : null, error: null };
      const builder: any = {};
      for (const method of ["select", "eq", "in", "order", "update"]) {
        builder[method] = jest.fn(() => builder);
      }
      builder.single = jest.fn(() => Promise.resolve(result));
      builder.maybeSingle = jest.fn(() => Promise.resolve(result));
      builder.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
      return builder;
    }),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: { path: "test-path.pdf" }, error: null })),
      })),
    },
  };
}

type PdfRoute = typeof import("@/app/api/pdf/route");
type EmailRoute = typeof import("@/app/api/email/route");

// Trasy importowane dynamicznie, żeby załadowały się po zarejestrowaniu mocków
let POSTPDF: PdfRoute["POST"];
let POSTEmail: EmailRoute["POST"];

beforeAll(async () => {
  ({ POST: POSTPDF } = await import("@/app/api/pdf/route"));
  ({ POST: POSTEmail } = await import("@/app/api/email/route"));
});

describe("PDF Generation", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    // Ustaw zmienne środowiskowe
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.RESEND_FROM = "test@mail.mainly.pl";
  });

  it("powinien wygenerować PDF umowy", async () => {
    const mockTrip = createMockTrip();
    const mockBooking = createMockBooking({
      trip_id: mockTrip.id,
    });

    mockSupabaseClient = createMockSupabaseClient({
      trip: mockTrip,
      booking: mockBooking,
    });

    mockAdminClient = createPdfAdminClient(mockTrip);

    // Endpoint PDF oczekuje pełnego payloadu PdfPayload
    const requestBody = {
      booking_ref: mockBooking.booking_ref,
      trip_id: mockTrip.id,
      trip: {
        title: mockTrip.title,
        start_date: mockTrip.start_date,
        end_date: mockTrip.end_date,
        price_cents: mockTrip.price_cents,
      },
      contact_email: mockBooking.contact_email || "test@example.com",
      contact_first_name: mockBooking.contact_first_name,
      contact_last_name: mockBooking.contact_last_name,
      contact_phone: mockBooking.contact_phone,
      participants: [
        {
          first_name: "Jan",
          last_name: "Kowalski",
          pesel: "12345678901",
        },
      ],
    };

    const request = createMockRequest(requestBody);
    const response = await POSTPDF(request);
    const data = await response.json();

    // Endpoint zwraca JSON z base64 PDF
    expect(response.status).toBe(200);
    expect(data).toHaveProperty("base64");
    expect(data).toHaveProperty("filename");
  });

  it("powinien zwrócić błąd gdy rezerwacja nie istnieje", async () => {
    mockSupabaseClient = createMockSupabaseClient({
      booking: null,
    });

    const requestBody = {
      // Brak wymaganych pól
      booking_ref: "nieistniejaca-rezerwacja",
    };

    const request = createMockRequest(requestBody);
    const response = await POSTPDF(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});

describe("Email Sending", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    // Ustaw zmienne środowiskowe dla Resend
    process.env.RESEND_API_KEY = "test-resend-api-key";
    process.env.RESEND_FROM = "noreply@mail.mainly.pl";
  });

  it("powinien wysłać email z potwierdzeniem rezerwacji", async () => {
    const mockTrip = createMockTrip();
    const mockBooking = createMockBooking({
      trip_id: mockTrip.id,
      contact_email: "test@example.com",
    });

    mockSupabaseClient = createMockSupabaseClient({
      trip: mockTrip,
      booking: mockBooking,
    });

    mockAdminClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      storage: {
        from: jest.fn((bucket: string) => ({
          upload: jest.fn(() => Promise.resolve({ 
            data: { 
              path: "test-path.pdf",
              id: "test-id",
              fullPath: "test-path.pdf"
            },
            error: null,
            // Upewnij się, że error jest null, nie undefined
          })),
        })),
      },
    };

    const requestBody = {
      to: mockBooking.contact_email || "test@example.com",
      subject: `Potwierdzenie rezerwacji ${mockBooking.booking_ref}`,
      html: "<p>Test email</p>",
      text: "Test email",
    };

    const request = createMockRequest(requestBody);
    const response = await POSTEmail(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("ok", true);
  });

  it("powinien wysłać email z załącznikiem PDF", async () => {
    const mockTrip = createMockTrip();
    const mockBooking = createMockBooking({
      trip_id: mockTrip.id,
      contact_email: "test@example.com",
    });

    mockSupabaseClient = createMockSupabaseClient({
      trip: mockTrip,
      booking: mockBooking,
    });

    mockAdminClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      storage: {
        from: jest.fn((bucket: string) => ({
          upload: jest.fn(() => Promise.resolve({ 
            data: { 
              path: "test-path.pdf",
              id: "test-id",
              fullPath: "test-path.pdf"
            },
            error: null,
            // Upewnij się, że error jest null, nie undefined
          })),
        })),
      },
    };

    const requestBody = {
      to: mockBooking.contact_email || "test@example.com",
      subject: `Potwierdzenie rezerwacji ${mockBooking.booking_ref}`,
      html: "<p>Test email</p>",
      text: "Test email",
      attachment: {
        filename: "umowa.pdf",
        base64: "dGVzdCBwZGYgY29udGVudA==",
      },
    };

    const request = createMockRequest(requestBody);
    const response = await POSTEmail(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("ok", true);
  });

  it("powinien zwrócić błąd gdy rezerwacja nie istnieje", async () => {
    mockSupabaseClient = createMockSupabaseClient({
      booking: null,
    });

    const requestBody = {
      // Brak wymaganych pól to i subject
      subject: "Test",
    };

    const request = createMockRequest(requestBody);
    const response = await POSTEmail(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("powinien zwrócić błąd gdy brak adresu email", async () => {
    const mockBooking = createMockBooking({
      contact_email: null,
    });

    mockSupabaseClient = createMockSupabaseClient({
      booking: mockBooking,
    });

    const requestBody = {
      // Brak pola to (wymagane)
      subject: "Test",
    };

    const request = createMockRequest(requestBody);
    const response = await POSTEmail(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});

describe("PDF and Email Integration", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    // Ustaw zmienne środowiskowe dla Resend
    process.env.RESEND_API_KEY = "test-resend-api-key";
    process.env.RESEND_FROM = "noreply@mail.mainly.pl";
  });

  it("powinien wygenerować PDF i wysłać email w jednym flow", async () => {
    const mockTrip = createMockTrip();
    const mockBooking = createMockBooking({
      trip_id: mockTrip.id,
      contact_email: "test@example.com",
    });

    mockSupabaseClient = createMockSupabaseClient({
      trip: mockTrip,
      booking: mockBooking,
    });

    mockAdminClient = createPdfAdminClient(mockTrip);

    // Najpierw wygeneruj PDF - endpoint oczekuje pełnego payloadu
    const pdfRequestBody = {
      booking_ref: mockBooking.booking_ref,
      trip_id: mockTrip.id,
      trip: {
        title: mockTrip.title,
        start_date: mockTrip.start_date,
        end_date: mockTrip.end_date,
        price_cents: mockTrip.price_cents,
      },
      contact_email: mockBooking.contact_email || "test@example.com",
      contact_first_name: mockBooking.contact_first_name,
      contact_last_name: mockBooking.contact_last_name,
      contact_phone: mockBooking.contact_phone,
      participants: [
        {
          first_name: "Jan",
          last_name: "Kowalski",
          pesel: "12345678901",
        },
      ],
    };

    const pdfRequest = createMockRequest(pdfRequestBody);
    const pdfResponse = await POSTPDF(pdfRequest);
    const pdfData = await pdfResponse.json();

    expect(pdfResponse.status).toBe(200);
    expect(pdfData).toHaveProperty("base64");

    // Potem wyślij email z PDF
    const emailRequestBody = {
      to: mockBooking.contact_email || "test@example.com",
      subject: `Potwierdzenie rezerwacji ${mockBooking.booking_ref}`,
      html: "<p>Test email</p>",
      text: "Test email",
      attachment: {
        filename: pdfData.filename || "umowa.pdf",
        base64: pdfData.base64,
      },
    };

    const emailRequest = createMockRequest(emailRequestBody);
    const emailResponse = await POSTEmail(emailRequest);
    const emailData = await emailResponse.json();

    expect(emailResponse.status).toBe(200);
    expect(emailData).toHaveProperty("ok", true);
  });
});
