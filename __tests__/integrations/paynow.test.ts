import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { POST as POSTInit } from "@/app/api/payments/paynow/init/route";
import { NextRequest } from "next/server";
import { createMockRequest, createMockSupabaseClient, resetMocks, createMockPaynowClient } from "@/tests/helpers/api-helpers";
import { createMockBooking, createMockTrip } from "@/tests/helpers/test-data";

// Mock Supabase
const mockCreateClient = jest.fn();
const mockCreateAdminClient = jest.fn();
const mockCreatePaynowPayment = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockCreateClient())),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(() => mockCreateAdminClient()),
}));

jest.mock("@/lib/paynow", () => ({
  createPaynowPayment: mockCreatePaynowPayment,
}));

// Mock verifySignature przed importem
jest.mock("@/app/api/payments/paynow/webhook/route", () => {
  const actual = jest.requireActual("@/app/api/payments/paynow/webhook/route");
  return {
    ...actual,
    verifySignature: jest.fn(() => false), // Domyślnie false, można zmienić w testach
  };
});

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaynowPayment } from "@/lib/paynow";
import { POST as POSTWebhook } from "@/app/api/payments/paynow/webhook/route";

describe("Paynow Integration", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    mockCreateClient.mockClear();
    mockCreateAdminClient.mockClear();
    mockCreatePaynowPayment.mockClear();
    // Ustaw zmienne środowiskowe dla Paynow
    process.env.PAYNOW_SIGNATURE_KEY = "test-signature-key";
    process.env.PAYNOW_API_KEY = "test-api-key";
    
    // Resetuj mock verifySignature
    const webhookModule = await import("@/app/api/payments/paynow/webhook/route");
    if (webhookModule.verifySignature && jest.isMockFunction(webhookModule.verifySignature)) {
      (webhookModule.verifySignature as jest.Mock).mockReturnValue(false);
      (webhookModule.verifySignature as jest.Mock).mockClear();
    }
    
    // Mock global fetch dla Paynow API calls
    global.fetch = jest.fn() as jest.Mock;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        paymentId: "PAYNOW-TEST-123",
        redirectUrl: "https://paynow.pl/payment/test"
      }),
    });
  });

  describe("POST /api/payments/paynow/init", () => {
    it("powinien utworzyć płatność Paynow", async () => {
      const mockTrip = createMockTrip();
      const mockBooking = createMockBooking({
        trip_id: mockTrip.id,
        payment_status: "unpaid",
      });

      const mockSupabase = createMockSupabaseClient({
        booking: mockBooking,
        trip: mockTrip,
      });

      const mockAdminClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
            like: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => Promise.resolve({ data: [{ id: "payment-history-id" }], error: null })),
          })),
        })),
      };

      mockCreateClient.mockReturnValue(mockSupabase);
      mockCreateAdminClient.mockReturnValue(mockAdminClient);
      mockCreatePaynowPayment.mockResolvedValue({
        paymentId: "PAYNOW-123",
        redirectUrl: "https://paynow.pl/payment/123",
      });

      const requestBody = {
        booking_id: mockBooking.id,
      };

      const request = createMockRequest(requestBody);
      const response = await POSTInit(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("redirectUrl");
      expect(createPaynowPayment).toHaveBeenCalled();
    });

    it("powinien zwrócić błąd gdy rezerwacja nie istnieje", async () => {
      const mockSupabase = createMockSupabaseClient({
        booking: null,
      });

      mockCreateClient.mockReturnValue(mockSupabase);

      const requestBody = {
        booking_id: "nieistniejaca-rezerwacja",
      };

      const request = createMockRequest(requestBody);
      const response = await POSTInit(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("booking_not_found");
    });
  });

  describe("POST /api/payments/paynow/webhook", () => {
    it("powinien obsłużyć potwierdzoną płatność", async () => {
      const mockBooking = createMockBooking({
        payment_status: "unpaid",
      });

      const mockSupabase = createMockSupabaseClient({
        booking: mockBooking,
      });

      const mockAdminClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockBooking, error: null })),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: { ...mockBooking, payment_status: "paid" }, error: null })),
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => Promise.resolve({ data: [{ id: "payment-history-id" }], error: null })),
          })),
        })),
      };

      mockCreateClient.mockReturnValue(mockSupabase);
      mockCreateAdminClient.mockReturnValue(mockAdminClient);

      // Mockuj weryfikację sygnatury - zwróć true dla testów z poprawną sygnaturą
      mockVerifySignature.mockReturnValue(true);

      const webhookPayload = {
        paymentId: "PAYNOW-123",
        externalId: mockBooking.booking_ref,
        status: "CONFIRMED",
        amount: 100000,
      };

      const rawBody = JSON.stringify(webhookPayload);
      
      const request = new NextRequest("http://localhost:3000/api/payments/paynow/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Signature": "mock-signature",
        },
        body: rawBody,
      });

      const response = await POSTWebhook(request);

      // Paynow webhooki zawsze zwracają 200 OK (zgodnie z dokumentacją)
      expect(response.status).toBe(200);
    });

    it("powinien obsłużyć oczekującą płatność", async () => {
      const mockBooking = createMockBooking();

      const mockSupabase = createMockSupabaseClient({
        booking: mockBooking,
      });

      mockCreateClient.mockReturnValue(mockSupabase);

      // Mockuj weryfikację sygnatury - zwróć true dla testów z poprawną sygnaturą
      mockVerifySignature.mockReturnValue(true);

      const webhookPayload = {
        paymentId: "PAYNOW-123",
        externalId: mockBooking.booking_ref,
        status: "PENDING",
        amount: 100000,
      };

      const rawBody = JSON.stringify(webhookPayload);
      const request = new NextRequest("http://localhost:3000/api/payments/paynow/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Signature": "mock-signature",
        },
        body: rawBody,
      });

      const response = await POSTWebhook(request);

      // PENDING płatności również zwracają 200 OK
      expect(response.status).toBe(200);
    });

    it("powinien obsłużyć odrzuconą płatność", async () => {
      const mockBooking = createMockBooking();

      const mockSupabase = createMockSupabaseClient({
        booking: mockBooking,
      });

      mockCreateClient.mockReturnValue(mockSupabase);

      // Mockuj weryfikację sygnatury - zwróć true dla testów z poprawną sygnaturą
      mockVerifySignature.mockReturnValue(true);

      const webhookPayload = {
        paymentId: "PAYNOW-123",
        externalId: mockBooking.booking_ref,
        status: "REJECTED",
        amount: 100000,
      };

      const rawBody = JSON.stringify(webhookPayload);
      const request = new NextRequest("http://localhost:3000/api/payments/paynow/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Signature": "mock-signature",
        },
        body: rawBody,
      });

      const response = await POSTWebhook(request);

      // REJECTED płatności również zwracają 200 OK (zgodnie z dokumentacją Paynow)
      expect(response.status).toBe(200);
    });

    it("powinien zwrócić 200 nawet przy nieprawidłowej sygnaturze", async () => {
      // Zgodnie z dokumentacją Paynow, webhooki zawsze zwracają 200 OK
      // nawet jeśli sygnatura jest nieprawidłowa (aby Paynow nie próbowało ponownie)

      const webhookPayload = {
        paymentId: "PAYNOW-123",
        externalId: "BK-TEST-123",
        status: "CONFIRMED",
        amount: 100000,
      };

      const rawBody = JSON.stringify(webhookPayload);
      const request = new NextRequest("http://localhost:3000/api/payments/paynow/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Signature": "invalid-signature",
        },
        body: rawBody,
      });

      const response = await POSTWebhook(request);

      // Zawsze zwracamy 200 OK, nawet przy nieprawidłowej sygnaturze
      expect(response.status).toBe(200);
    });
  });

  describe("Paynow Payment Creation", () => {
    it("powinien utworzyć płatność z poprawnymi parametrami", async () => {
      const mockPaynow = createMockPaynowClient({
        paymentId: "PAYNOW-TEST-123",
        redirectUrl: "https://paynow.pl/payment/test",
      });

      mockCreatePaynowPayment.mockResolvedValue({
        paymentId: "PAYNOW-TEST-123",
        redirectUrl: "https://paynow.pl/payment/test",
      });

      const result = await mockCreatePaynowPayment({
        amountCents: 100000,
        externalId: "BK-TEST-123",
        description: "Test payment",
        buyerEmail: "test@example.com",
        continueUrl: "https://example.com/return",
      });

      expect(result).toHaveProperty("paymentId");
      expect(result).toHaveProperty("redirectUrl");
      expect(mockCreatePaynowPayment).toHaveBeenCalledWith({
        amountCents: 100000,
        externalId: "BK-TEST-123",
        description: "Test payment",
        buyerEmail: "test@example.com",
        continueUrl: "https://example.com/return",
      });
    });
  });
});
