/**
 * Helpery do zarządzania danymi testowymi w bazie danych
 * 
 * Uwaga: Te helpery są przeznaczone głównie do testów integracyjnych z rzeczywistą bazą.
 * W testach jednostkowych używaj mocków z api-helpers.ts
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingFormValues } from "@/components/booking-form/booking-form-types";

/**
 * Tworzy testową wycieczkę w bazie danych
 * Wymaga: połączenia z rzeczywistą bazą Supabase (testową)
 */
export async function createTestTrip(tripData: Partial<any> = {}) {
  const adminClient = createAdminClient();
  
  const defaultTrip = {
    title: `Test Trip ${Date.now()}`,
    slug: `test-trip-${Date.now()}`,
    description: "Test trip description",
    start_date: "2024-06-01",
    end_date: "2024-06-07",
    price_cents: 100000,
    seats_total: 20,
    seats_reserved: 0,
    is_active: true,
    is_public: true,
    public_slug: `test-trip-${Date.now()}`,
    ...tripData,
  };

  const { data, error } = await adminClient
    .from("trips")
    .insert(defaultTrip)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test trip: ${error.message}`);
  }

  return data;
}

/**
 * Usuwa testową wycieczkę z bazy danych
 */
export async function deleteTestTrip(tripId: string) {
  const adminClient = createAdminClient();
  
  const { error } = await adminClient
    .from("trips")
    .delete()
    .eq("id", tripId);

  if (error) {
    console.error(`Failed to delete test trip: ${error.message}`);
  }
}

/**
 * Tworzy testową rezerwację w bazie danych
 */
export async function createTestBooking(
  tripId: string,
  bookingData: Partial<any> = {}
) {
  const adminClient = createAdminClient();
  
  const defaultBooking = {
    trip_id: tripId,
    booking_ref: `BK-TEST-${Date.now()}`,
    contact_first_name: "Test",
    contact_last_name: "User",
    contact_email: "test@example.com",
    contact_phone: "123456789",
    status: "confirmed",
    payment_status: "unpaid",
    source: "test",
    consents: {
      rodo: { accepted: true, accepted_at: new Date().toISOString() },
      terms: { accepted: true, accepted_at: new Date().toISOString() },
      conditions: { accepted: true, accepted_at: new Date().toISOString() },
    },
    ...bookingData,
  };

  const { data, error } = await adminClient
    .from("bookings")
    .insert(defaultBooking)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test booking: ${error.message}`);
  }

  return data;
}

/**
 * Usuwa testową rezerwację z bazy danych
 */
export async function deleteTestBooking(bookingId: string) {
  const adminClient = createAdminClient();
  
  // Najpierw usuń uczestników
  await adminClient
    .from("participants")
    .delete()
    .eq("booking_id", bookingId);

  // Potem usuń rezerwację
  const { error } = await adminClient
    .from("bookings")
    .delete()
    .eq("id", bookingId);

  if (error) {
    console.error(`Failed to delete test booking: ${error.message}`);
  }
}

/**
 * Tworzy testowego użytkownika w bazie danych
 */
export async function createTestUser(userData: Partial<any> = {}) {
  const adminClient = createAdminClient();
  
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    password: "TestPassword123!",
    email_confirm: true,
    ...userData,
  };

  // Użyj Supabase Auth API do utworzenia użytkownika
  const { data, error } = await adminClient.auth.admin.createUser({
    email: defaultUser.email,
    password: defaultUser.password,
    email_confirm: defaultUser.email_confirm,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  // Utwórz profil
  if (data.user) {
    await adminClient
      .from("profiles")
      .upsert({
        id: data.user.id,
        email: data.user.email,
        role: userData.role || "user",
      });
  }

  return data.user;
}

/**
 * Usuwa testowego użytkownika z bazy danych
 */
export async function deleteTestUser(userId: string) {
  const adminClient = createAdminClient();
  
  // Usuń profil
  await adminClient
    .from("profiles")
    .delete()
    .eq("id", userId);

  // Usuń użytkownika z auth
  await adminClient.auth.admin.deleteUser(userId);
}

/**
 * Czyści wszystkie dane testowe (użyj ostrożnie!)
 */
export async function cleanupTestData() {
  const adminClient = createAdminClient();
  
  // Usuń wszystkie testowe rezerwacje
  await adminClient
    .from("bookings")
    .delete()
    .like("booking_ref", "BK-TEST-%");

  // Usuń wszystkie testowe wycieczki
  await adminClient
    .from("trips")
    .delete()
    .like("slug", "test-trip-%");
}

/**
 * Helper do izolacji testów - tworzy unikalne dane dla każdego testu
 */
export function generateUniqueTestData() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  
  return {
    tripSlug: `test-trip-${timestamp}-${random}`,
    bookingRef: `BK-TEST-${timestamp}-${random}`,
    email: `test-${timestamp}-${random}@example.com`,
  };
}
