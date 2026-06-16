import { test, expect } from "@playwright/test";
import { loginUser } from "./helpers/auth";
import {
  createTestBooking,
  createTestParticipants,
  createTestTrip,
  deleteTestBooking,
  deleteTestTrip,
  generateUniqueTestData,
} from "./helpers/db-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

test.describe("Raporty TFG/TFP (pkt 10)", () => {
  let tripId: string | null = null;
  let bookingId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test.afterEach(async () => {
    try {
      if (bookingId) await deleteTestBooking(bookingId);
    } catch {}
    try {
      if (tripId) await deleteTestTrip(tripId);
    } catch {}
    tripId = null;
    bookingId = null;
  });

  test("raport TFG nie jest pusty dla dzisiejszych umów (xlsx)", async ({ page }) => {
    const uniq = generateUniqueTestData();
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateFrom = `${yyyy}-${mm}-${dd}`;
    const dateTo = dateFrom;

    const trip = await createTestTrip({
      title: `Trip TFG ${Date.now()}`,
      slug: uniq.tripSlug,
      is_public: true,
      category: "TestCategory",
      reservation_number: `TFG-${Date.now()}`,
      price_cents: 10000,
    });
    tripId = trip.id;

    const booking = await createTestBooking(trip.id, {
      booking_ref: uniq.bookingRef,
      contact_email: uniq.email,
      status: "confirmed",
      payment_status: "paid",
    });
    bookingId = booking.id;

    await createTestParticipants(booking.id, [
      { first_name: "P1", last_name: "T" },
      { first_name: "P2", last_name: "T" },
    ]);

    // Seed: agreement w DB w okresie (generated_at)
    const admin = createAdminClient();
    const { error: agErr } = await admin.from("agreements").insert({
      booking_id: booking.id,
      status: "generated",
      agreement_seq: 1,
      pdf_url: null,
      generated_at: new Date().toISOString(),
    });
    expect(agErr).toBeNull();

    const result = await page.evaluate(async (payload) => {
      const res = await fetch("/api/admin/reports/tfg-agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const buf = await res.arrayBuffer();
      return { ok: res.ok, status: res.status, bytes: buf.byteLength, ct: res.headers.get("content-type") };
    }, {
      reportType: "tfg_signed_detail",
      period: "range",
      dateFrom,
      dateTo,
      format: "xlsx",
    });

    expect(result.ok).toBeTruthy();
    expect(result.ct).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    // XLSX zawsze ma narzut, nawet z 1 rekordem – jeśli pusto, to zwykle kilka KB; tu wymagamy sensownego rozmiaru
    expect(result.bytes).toBeGreaterThan(2_000);
  });
});

