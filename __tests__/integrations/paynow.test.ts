import crypto from "crypto";
import { describe, it, expect, beforeEach, beforeAll, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { createMockRequest, resetMocks } from "@/tests/helpers/api-helpers";
import { createMockBooking, createMockTrip } from "@/tests/helpers/test-data";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/paynow", () => ({
  createPaynowPayment: jest.fn(),
}));

const { createClient } = jest.requireMock<{ createClient: jest.Mock }>("@/lib/supabase/server");
const { createAdminClient } = jest.requireMock<{ createAdminClient: jest.Mock }>("@/lib/supabase/admin");
const { createPaynowPayment } = jest.requireMock<{ createPaynowPayment: jest.Mock }>("@/lib/paynow");

type InitRoute = typeof import("@/app/api/payments/paynow/init/route");
type WebhookRoute = typeof import("@/app/api/payments/paynow/webhook/route");

let POSTInit: InitRoute["POST"];
let POSTWebhook: WebhookRoute["POST"];

beforeAll(async () => {
  ({ POST: POSTInit } = await import("@/app/api/payments/paynow/init/route"));
  ({ POST: POSTWebhook } = await import("@/app/api/payments/paynow/webhook/route"));
});

const SIGNATURE_KEY = "test-signature-key";

type QueryResult = { data: unknown; error: unknown };

/** Łańcuchowy mock query buildera Supabase: każda metoda zwraca builder, await/single zwraca wynik dla tabeli. */
function createChainableClient(results: Record<string, QueryResult>) {
  const builders: Record<string, any> = {};
  const from = jest.fn((table: string) => {
    const result = results[table] ?? { data: null, error: null };
    const builder: any = {};
    for (const method of ["select", "eq", "like", "ilike", "limit", "order", "in", "update", "insert"]) {
      builder[method] = jest.fn(() => builder);
    }
    builder.single = jest.fn(() => Promise.resolve(result));
    builder.maybeSingle = jest.fn(() => Promise.resolve(result));
    builder.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
    builders[table] = builder;
    return builder;
  });
  return { client: { from }, from, builders };
}

function signedWebhookRequest(payload: object, signature?: string) {
  const rawBody = JSON.stringify(payload);
  const validSignature = crypto.createHmac("sha256", SIGNATURE_KEY).update(rawBody, "utf8").digest("base64");
  return new NextRequest("http://localhost:3000/api/payments/paynow/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Signature: signature ?? validSignature,
    },
    body: rawBody,
  });
}

describe("Paynow Integration", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    process.env.PAYNOW_SIGNATURE_KEY = SIGNATURE_KEY;
    process.env.PAYNOW_API_KEY = "test-api-key";
  });

  describe("POST /api/payments/paynow/init", () => {
    it("powinien utworzyć płatność Paynow", async () => {
      const mockTrip = createMockTrip({ payment_split_enabled: false, payment_schedule: null });
      const mockBooking = createMockBooking({
        trip_id: mockTrip.id,
        payment_status: "unpaid",
        trips: mockTrip,
      });

      const supabase = createChainableClient({
        bookings: { data: mockBooking, error: null },
        participants: { data: [{ id: "participant-1", selected_services: null }], error: null },
      });
      const admin = createChainableClient({
        payment_history: { data: [], error: null },
      });

      createClient.mockResolvedValue(supabase.client);
      createAdminClient.mockReturnValue(admin.client);
      createPaynowPayment.mockResolvedValue({
        paymentId: "PAYNOW-123",
        redirectUrl: "https://paynow.pl/payment/123",
      });

      const response = await POSTInit(createMockRequest({ booking_id: mockBooking.id }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("redirectUrl", "https://paynow.pl/payment/123");
      expect(createPaynowPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: mockTrip.price_cents,
          externalId: mockBooking.booking_ref,
          buyerEmail: mockBooking.contact_email,
        }),
      );
      expect(admin.builders.payment_history.insert).toHaveBeenCalled();
    });

    it("powinien zwrócić błąd gdy rezerwacja nie istnieje", async () => {
      const supabase = createChainableClient({
        bookings: { data: null, error: { message: "Not found", code: "PGRST116" } },
      });
      createClient.mockResolvedValue(supabase.client);

      const response = await POSTInit(
        createMockRequest({ booking_id: "123e4567-e89b-12d3-a456-426614179999" }),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("booking_not_found");
      expect(createPaynowPayment).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/payments/paynow/webhook", () => {
    it("powinien zignorować potwierdzenie dla nieistniejącej rezerwacji", async () => {
      const admin = createChainableClient({
        bookings: { data: null, error: { message: "Not found", code: "PGRST116" } },
      });
      createAdminClient.mockReturnValue(admin.client);

      const response = await POSTWebhook(
        signedWebhookRequest({
          paymentId: "PAYNOW-123",
          externalId: "BK-NIE-ISTNIEJE",
          status: "CONFIRMED",
          amount: 100000,
        }),
      );

      expect(response.status).toBe(200);
      expect(admin.from).not.toHaveBeenCalledWith("payment_history");
    });

    it.each(["PENDING", "REJECTED"])(
      "powinien obsłużyć płatność %s bez zmiany rezerwacji",
      async (status) => {
        const mockBooking = createMockBooking({ trips: createMockTrip() });
        const admin = createChainableClient({
          bookings: { data: mockBooking, error: null },
        });
        createAdminClient.mockReturnValue(admin.client);

        const response = await POSTWebhook(
          signedWebhookRequest({
            paymentId: "PAYNOW-123",
            externalId: mockBooking.booking_ref,
            status,
            amount: 100000,
          }),
        );

        expect(response.status).toBe(200);
        expect(admin.from).toHaveBeenCalledWith("bookings");
        expect(admin.builders.bookings.update).not.toHaveBeenCalled();
        expect(admin.from).not.toHaveBeenCalledWith("payment_history");
      },
    );

    it("powinien zwrócić 200 przy nieprawidłowej sygnaturze i nie dotykać bazy", async () => {
      const response = await POSTWebhook(
        signedWebhookRequest(
          {
            paymentId: "PAYNOW-123",
            externalId: "BK-TEST-123",
            status: "CONFIRMED",
            amount: 100000,
          },
          "invalid-signature",
        ),
      );

      expect(response.status).toBe(200);
      expect(createAdminClient).not.toHaveBeenCalled();
    });
  });
});
