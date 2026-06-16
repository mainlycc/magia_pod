/**
 * Helpery do zarządzania danymi testowymi w bazie danych
 * 
 * Uwaga: Te helpery są przeznaczone głównie do testów integracyjnych z rzeczywistą bazą.
 * W testach jednostkowych używaj mocków z api-helpers.ts
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingFormValues } from "@/components/booking-form/booking-form-types";
import { SYNCED_INSURANCE_ID_PREFIX } from "@/lib/insurance-local/sync-form-extra-insurances";
import { PDFDocument, StandardFonts } from "pdf-lib";

type CreatedFile = { bucket: "agreements" | "documents"; path: string };

async function ensureBucket(adminClient: ReturnType<typeof createAdminClient>, bucket: CreatedFile["bucket"]) {
  const { data: buckets } = await adminClient.storage.listBuckets();
  const exists = buckets?.some((b) => b.id === bucket);
  if (exists) return;
  await adminClient.storage.createBucket(bucket, {
    public: true,
    allowedMimeTypes: ["application/pdf"],
  });
}

async function createTinyPdfBytes(label: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4-ish
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(label, { x: 72, y: 770, size: 12, font });
  return await pdf.save();
}

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
        allowed_trip_ids: userData.allowed_trip_ids ?? null,
      });
  }

  return data.user;
}

export async function createTestParticipants(
  bookingId: string,
  participants: Array<
    Partial<{
      first_name: string;
      last_name: string;
      pesel: string;
      email: string;
      phone: string;
      document_type: string;
      document_number: string;
      address: any;
      selected_services: any;
    }>
  >
) {
  const adminClient = createAdminClient();
  const defaults = participants.map((p, idx) => ({
    booking_id: bookingId,
    first_name: p.first_name ?? `Uczestnik${idx + 1}`,
    last_name: p.last_name ?? "Testowy",
    pesel: p.pesel ?? `${String(Date.now()).slice(-9)}${idx}`.padEnd(11, "0"),
    email: p.email ?? `participant-${Date.now()}-${idx}@example.com`,
    phone: p.phone ?? "123456789",
    document_type: p.document_type ?? "passport",
    document_number: p.document_number ?? `TEST${Date.now()}${idx}`,
    address: p.address ?? { city: "Warszawa", street: "Testowa 1", zip: "00-001" },
    selected_services: p.selected_services ?? {},
  }));

  const { data, error } = await adminClient
    .from("participants")
    .insert(defaults)
    .select();

  if (error) throw new Error(`Failed to create test participants: ${error.message}`);
  return data ?? [];
}

export async function createTestInsuranceVariant(opts: {
  type: 1 | 2 | 3;
  name?: string;
  provider?: string;
  description?: string | null;
  is_default?: boolean;
  is_active?: boolean;
}) {
  const adminClient = createAdminClient();
  const row = {
    type: opts.type,
    name: opts.name ?? `Test Variant ${opts.type} ${Date.now()}`,
    provider: opts.provider ?? "TEST",
    description: opts.description ?? null,
    is_default: opts.is_default ?? false,
    is_active: opts.is_active ?? true,
  };
  const { data, error } = await adminClient.from("insurance_variants").insert(row).select().single();
  if (error) throw new Error(`Failed to create insurance variant: ${error.message}`);
  return data;
}

export async function deleteTestInsuranceVariant(variantId: string) {
  const adminClient = createAdminClient();
  const { error } = await adminClient.from("insurance_variants").delete().eq("id", variantId);
  if (error) {
    console.error(`Failed to delete insurance variant: ${error.message}`);
  }
}

export async function createTestTripInsuranceVariant(opts: {
  tripId: string;
  variantId: string;
  price_grosz?: number | null;
  is_enabled?: boolean;
}) {
  const adminClient = createAdminClient();
  const row = {
    trip_id: opts.tripId,
    variant_id: opts.variantId,
    price_grosz: opts.price_grosz ?? null,
    is_enabled: opts.is_enabled ?? true,
  };
  const { data, error } = await adminClient.from("trip_insurance_variants").insert(row).select().single();
  if (error) throw new Error(`Failed to create trip_insurance_variant: ${error.message}`);
  return data;
}

export function buildSyncedInsuranceServiceId(tripInsuranceVariantId: string): string {
  return `${SYNCED_INSURANCE_ID_PREFIX}${tripInsuranceVariantId}`;
}

export async function setParticipantSelectedServices(
  participantId: string,
  selected_services: Record<string, unknown>
) {
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("participants")
    .update({ selected_services })
    .eq("id", participantId);
  if (error) throw new Error(`Failed to set selected_services: ${error.message}`);
}

export async function createTestAgreementPdf(opts: {
  bookingId: string;
  pdfLabel?: string;
  status?: "generated" | "sent" | "signed";
}) {
  const adminClient = createAdminClient();
  await ensureBucket(adminClient, "agreements");

  const bytes = await createTinyPdfBytes(opts.pdfLabel ?? `Agreement ${opts.bookingId}`);
  const path = `tests/${opts.bookingId}-${Date.now()}.pdf`;

  const { error: uploadErr } = await adminClient.storage
    .from("agreements")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadErr) throw new Error(`Failed to upload agreement pdf: ${uploadErr.message}`);

  const { data: agreement, error } = await adminClient
    .from("agreements")
    .insert({
      booking_id: opts.bookingId,
      status: opts.status ?? "generated",
      pdf_url: path,
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create agreement row: ${error.message}`);

  return { agreement, file: { bucket: "agreements" as const, path } };
}

export async function createTripInsuranceTermsDocument(opts: { tripId: string; label?: string }) {
  const adminClient = createAdminClient();
  await ensureBucket(adminClient, "documents");

  const bytes = await createTinyPdfBytes(opts.label ?? `OWU ${opts.tripId}`);
  const path = `tests/trips/${opts.tripId}/insurance_terms-${Date.now()}.pdf`;

  const { error: uploadErr } = await adminClient.storage
    .from("documents")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadErr) throw new Error(`Failed to upload insurance_terms pdf: ${uploadErr.message}`);

  const { data, error } = await adminClient
    .from("trip_documents")
    .upsert(
      {
        trip_id: opts.tripId,
        document_type: "insurance_terms",
        file_name: path,
        display_name: "OWU (test)",
      },
      { onConflict: "trip_id,document_type" }
    )
    .select()
    .single();
  if (error) throw new Error(`Failed to upsert trip_documents insurance_terms: ${error.message}`);

  return { document: data, file: { bucket: "documents" as const, path } };
}

export async function createTestInvoiceForBooking(opts: { bookingId: string; amount_cents?: number }) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("invoices")
    .insert({
      booking_id: opts.bookingId,
      amount_cents: opts.amount_cents ?? 12345,
      status: "wystawiona",
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create invoice: ${error.message}`);
  return data;
}

export async function cleanupUploadedFiles(files: CreatedFile[]) {
  const adminClient = createAdminClient();
  const byBucket = new Map<CreatedFile["bucket"], string[]>();
  for (const f of files) {
    byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.path]);
  }
  for (const [bucket, paths] of byBucket.entries()) {
    if (paths.length === 0) continue;
    await adminClient.storage.from(bucket).remove(paths);
  }
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

export async function setTestUserPassword(userId: string, password: string) {
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(`Failed to set user password: ${error.message}`);
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
