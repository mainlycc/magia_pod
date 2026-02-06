import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { submitBooking, getFieldsToValidate } from "@/components/booking-form/utils/booking-form-utils";
import type { BookingFormValues } from "@/components/booking-form/booking-form-types";
import type { UseFormReturn } from "react-hook-form";
import { createMockBookingFormValues, createMockCompanyBookingFormValues } from "@/tests/helpers/test-data";
import { mockGlobalFetch, resetMocks } from "@/tests/helpers/api-helpers";

// Mock useRouter
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  pathname: "/",
  query: {},
  asPath: "/",
};

// Mock form
const createMockForm = (): UseFormReturn<BookingFormValues> => {
  return {
    trigger: jest.fn(() => Promise.resolve(true)),
    setError: jest.fn(),
    clearErrors: jest.fn(),
    getValues: jest.fn(),
    setValue: jest.fn(),
    watch: jest.fn(),
    reset: jest.fn(),
    handleSubmit: jest.fn(),
    formState: {
      errors: {},
      isDirty: false,
      isSubmitted: false,
      isValid: true,
      submitCount: 0,
      touchedFields: {},
      dirtyFields: {},
      defaultValues: undefined,
      isSubmitting: false,
      isValidating: false,
    },
    register: jest.fn(),
    unregister: jest.fn(),
    getFieldState: jest.fn(),
    resetField: jest.fn(),
    control: {} as any,
  } as any;
};

describe("booking-form-utils", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  describe("submitBooking", () => {
    it("powinien wysłać rezerwację dla osoby fizycznej", async () => {
      const form = createMockForm();
      const values = createMockBookingFormValues();
      const slug = "test-trip";

      const mockResponse = {
        booking_ref: "BK-TEST-123",
        booking_url: "/booking/token123",
      };

      mockGlobalFetch(mockResponse);

      await submitBooking(
        form,
        values,
        "individual",
        slug,
        mockRouter as any,
        undefined,
        false
      );

      expect(global.fetch).toHaveBeenCalledWith("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: expect.stringContaining('"slug":"test-trip"'),
      });

      const callArgs = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      
      expect(body.contact_email).toBe("jan.kowalski@example.com");
      expect(body.contact_phone).toBe("123456789");
      expect(body.participants).toHaveLength(1);
      expect(body.participants[0].first_name).toBe("Jan");
      expect(body.applicant_type).toBe("individual");
    });

    it("powinien wysłać rezerwację dla firmy", async () => {
      const form = createMockForm();
      const values = createMockCompanyBookingFormValues();
      const slug = "test-trip";

      const mockResponse = {
        booking_ref: "BK-TEST-456",
        booking_url: "/booking/token456",
      };

      mockGlobalFetch(mockResponse);

      await submitBooking(
        form,
        values,
        "company",
        slug,
        mockRouter as any,
        5,
        false
      );

      expect(global.fetch).toHaveBeenCalledWith("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: expect.any(String),
      });

      const callArgs = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      
      expect(body.applicant_type).toBe("company");
      expect(body.company_name).toBe("Testowa Firma Sp. z o.o.");
      expect(body.company_nip).toBe("1234567890");
    });

    it("powinien obsłużyć błąd z serwera", async () => {
      const form = createMockForm();
      const values = createMockBookingFormValues();
      const slug = "test-trip";

      const mockErrorResponse = {
        error: "Not enough seats",
        details: {
          fieldErrors: {
            participants: ["Brak wystarczającej liczby miejsc"],
          },
        },
      };

      // Mock fetch z błędem
      global.fetch = jest.fn<typeof fetch>(() =>
        Promise.resolve({
          ok: false,
          status: 409,
          statusText: "Conflict",
          json: () => Promise.resolve(mockErrorResponse),
          text: () => Promise.resolve(JSON.stringify(mockErrorResponse)),
          headers: new Headers(),
        } as Response)
      ) as jest.MockedFunction<typeof fetch>;

      await expect(
        submitBooking(
          form,
          values,
          "individual",
          slug,
          mockRouter as any,
          undefined,
          false
        )
      ).rejects.toThrow("Not enough seats");
    });

    it("powinien przekierować do płatności gdy withPayment=true", async () => {
      const form = createMockForm();
      const values = createMockBookingFormValues();
      const slug = "test-trip";

      const mockResponse = {
        booking_ref: "BK-TEST-789",
        redirect_url: "https://paynow.pl/payment/123",
      };

      mockGlobalFetch(mockResponse);

      // Mock window.location.replace
      const originalReplace = window.location.replace;
      window.location.replace = jest.fn();

      await submitBooking(
        form,
        values,
        "individual",
        slug,
        mockRouter as any,
        undefined,
        true
      );

      // Sprawdź czy został wywołany redirect
      await new Promise((resolve) => setTimeout(resolve, 600));
      
      expect(window.location.replace).toHaveBeenCalledWith("https://paynow.pl/payment/123");

      window.location.replace = originalReplace;
    });

    it("powinien obsłużyć uczestników z usługami dodatkowymi", async () => {
      const form = createMockForm();
      const values = createMockBookingFormValues({
        participant_services: [
          {
            type: "insurance",
            service_id: "ins-1",
            variant_id: "var-1",
            price_cents: 5000,
            participant_index: 0,
          },
          {
            type: "attraction",
            service_id: "attr-1",
            price_cents: 10000,
            currency: "PLN",
            include_in_contract: true,
            participant_index: 0,
          },
        ],
      });
      const slug = "test-trip";

      const mockResponse = {
        booking_ref: "BK-TEST-SERVICES",
        booking_url: "/booking/token",
      };

      mockGlobalFetch(mockResponse);

      await submitBooking(
        form,
        values,
        "individual",
        slug,
        mockRouter as any,
        undefined,
        false
      );

      const callArgs = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      
      expect(body.participants[0].selected_services).toBeDefined();
      expect(body.participants[0].selected_services.insurances).toHaveLength(1);
      expect(body.participants[0].selected_services.attractions).toHaveLength(1);
    });

    it("powinien obsłużyć fakturę z innymi danymi", async () => {
      const form = createMockForm();
      const values = createMockBookingFormValues({
        invoice: {
          use_other_data: true,
          type: "company",
          company: {
            name: "Firma Fakturowa",
            nip: "9876543210",
            address: {
              street: "ul. Fakturowa 1",
              city: "Kraków",
              zip: "30-001",
            },
          },
        },
      });
      const slug = "test-trip";

      const mockResponse = {
        booking_ref: "BK-TEST-INVOICE",
        booking_url: "/booking/token",
      };

      mockGlobalFetch(mockResponse);

      await submitBooking(
        form,
        values,
        "individual",
        slug,
        mockRouter as any,
        undefined,
        false
      );

      const callArgs = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      
      expect(body.invoice_type).toBe("custom");
      expect(body.invoice_name).toBe("Firma Fakturowa");
      expect(body.invoice_nip).toBe("9876543210");
    });
  });

  describe("getFieldsToValidate", () => {
    it("powinien zwrócić pola kontaktowe dla osoby fizycznej", () => {
      const fields = getFieldsToValidate("contact", "individual");
      
      expect(fields).toContain("applicant_type");
      expect(fields).toContain("contact.first_name");
      expect(fields).toContain("contact.last_name");
      expect(fields).toContain("contact.pesel");
      expect(fields).toContain("contact.email");
      expect(fields).toContain("contact.phone");
    });

    it("powinien zwrócić pola kontaktowe dla firmy", () => {
      const fields = getFieldsToValidate("contact", "company");
      
      expect(fields).toContain("applicant_type");
      expect(fields).toContain("contact.email");
      expect(fields).toContain("contact.phone");
      expect(fields).toContain("company.name");
      expect(fields).toContain("company.nip");
      expect(fields).toContain("company.address.street");
      expect(fields).toContain("company.address.city");
      expect(fields).toContain("company.address.zip");
    });

    it("powinien zwrócić pola uczestników dla osoby fizycznej", () => {
      const fields = getFieldsToValidate("participants", "individual");
      
      expect(fields).toContain("participants");
    });

    it("powinien zwrócić pustą tablicę dla uczestników firmy", () => {
      const fields = getFieldsToValidate("participants", "company");
      
      expect(fields).toEqual([]);
    });

    it("powinien zwrócić pustą tablicę dla innych kroków", () => {
      const fields = getFieldsToValidate("services", "individual");
      
      expect(fields).toEqual([]);
    });
  });
});
