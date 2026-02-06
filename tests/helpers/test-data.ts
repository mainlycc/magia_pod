import type { BookingFormValues } from "@/components/booking-form/booking-form-types";
import type { TripConfig } from "@/components/booking-form/booking-form-types";

/**
 * Helpery do tworzenia mock danych testowych
 */

export function createMockTrip(overrides?: Partial<any>): any {
  return {
    id: "123e4567-e89b-12d3-a456-426614174000",
    title: "Testowa Wycieczka",
    slug: "testowa-wycieczka",
    description: "Opis testowej wycieczki",
    start_date: "2024-06-01",
    end_date: "2024-06-07",
    price_cents: 100000, // 1000 PLN
    seats_total: 20,
    seats_reserved: 5,
    is_active: true,
    is_public: true,
    public_slug: "testowa-wycieczka",
    category: "test",
    location: "Test Location",
    registration_mode: "both",
    require_pesel: true,
    form_show_additional_services: true,
    company_participants_info: null,
    ...overrides,
  };
}

export function createMockTripConfig(overrides?: Partial<TripConfig>): TripConfig {
  return {
    registration_mode: "both",
    require_pesel: true,
    form_show_additional_services: true,
    company_participants_info: null,
    seats_total: 20,
    additional_attractions: [],
    diets: [],
    extra_insurances: [],
    form_required_participant_fields: {
      pesel: true,
      document: true,
      gender: false,
      phone: false,
    },
    ...overrides,
  };
}

export function createMockBookingFormValues(
  overrides?: Partial<BookingFormValues>
): BookingFormValues {
  return {
    applicant_type: "individual",
    contact: {
      first_name: "Jan",
      last_name: "Kowalski",
      pesel: "12345678901",
      email: "jan.kowalski@example.com",
      phone: "123456789",
      address: {
        street: "ul. Testowa 1",
        city: "Warszawa",
        zip: "00-001",
      },
      comment: "",
    },
    company: undefined,
    participants: [
      {
        first_name: "Jan",
        last_name: "Kowalski",
        birth_date: "1990-01-01",
        pesel: "12345678901",
        email: "jan.kowalski@example.com",
        phone: "123456789",
        document_type: "ID",
        document_number: "ABC123456",
        gender_code: "M",
      },
    ],
    participants_count: undefined,
    participant_services: [],
    consents: {
      rodo: true,
      terms: true,
      conditions: true,
    },
    invoice: {
      use_other_data: false,
    },
    ...overrides,
  };
}

export function createMockCompanyBookingFormValues(
  overrides?: Partial<BookingFormValues>
): BookingFormValues {
  return {
    applicant_type: "company",
    contact: {
      first_name: "",
      last_name: "",
      pesel: "",
      email: "firma@example.com",
      phone: "123456789",
      address: {
        street: "",
        city: "",
        zip: "",
      },
      comment: "",
    },
    company: {
      name: "Testowa Firma Sp. z o.o.",
      nip: "1234567890",
      address: {
        street: "ul. Firmowa 1",
        city: "Warszawa",
        zip: "00-001",
      },
      has_representative: false,
      representative_first_name: "",
      representative_last_name: "",
    },
    participants: [],
    participants_count: 5,
    participant_services: [],
    consents: {
      rodo: true,
      terms: true,
      conditions: true,
    },
    invoice: {
      use_other_data: false,
    },
    ...overrides,
  };
}

export function createMockBooking(overrides?: Partial<any>): any {
  return {
    id: "123e4567-e89b-12d3-a456-426614174001",
    booking_ref: "BK-TEST-12345",
    trip_id: "123e4567-e89b-12d3-a456-426614174000",
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
    status: "confirmed",
    payment_status: "unpaid",
    source: "public_page",
    consents: {
      rodo: { accepted: true, accepted_at: new Date().toISOString() },
      terms: { accepted: true, accepted_at: new Date().toISOString() },
      conditions: { accepted: true, accepted_at: new Date().toISOString() },
    },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockUser(overrides?: Partial<any>): any {
  return {
    id: "user-123",
    email: "test@example.com",
    role: "admin",
    ...overrides,
  };
}

export function createMockParticipant(overrides?: Partial<any>): any {
  return {
    id: "participant-123",
    booking_id: "123e4567-e89b-12d3-a456-426614174001",
    first_name: "Jan",
    last_name: "Kowalski",
    birth_date: "1990-01-01",
    pesel: "12345678901",
    email: "jan.kowalski@example.com",
    phone: "123456789",
    document_type: "ID",
    document_number: "ABC123456",
    gender_code: "M",
    ...overrides,
  };
}
