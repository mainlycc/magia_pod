/**
 * Synchronizacja jak „Sprawdź w Paynow” (sync=true) dla wskazanych wycieczek:
 * wpisy CONFIRMED w Paynow → notatka „status: CONFIRMED”, potem przeliczenie rezerwacji.
 * Przed zmianami zapisuje kopię bookings + payment_history w audyty/.
 * Uruchom: pnpm dlx tsx scripts/sync-paynow-trips.ts "<fragment tytułu>" ["<fragment tytułu>" ...] [--apply]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const root = resolve(__dirname, "..");
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

async function main() {
  const { getPaynowPaymentStatus } = await import("../lib/paynow");
  const { extractPaynowPaymentIdFromNotes, isPaynowHistoryEntry, withPaynowStatusConfirmed } = await import(
    "../lib/paynow/extract-payment-id"
  );
  const { recalculateBookingPaymentsFromHistory } = await import("../lib/bookings/recalculate-booking-payments");

  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const titleFilters = args.filter((a) => a !== "--apply").map((a) => a.toLowerCase());
  if (!titleFilters.length) throw new Error("Podaj fragment tytułu wycieczki");

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: allTrips, error: tripsError } = await admin.from("trips").select("id, title");
  if (tripsError) throw tripsError;
  const trips = (allTrips ?? []).filter((t) => titleFilters.some((f) => (t.title ?? "").toLowerCase().includes(f)));
  console.log("Wycieczki:", trips.map((t) => t.title));
  if (!trips.length) throw new Error("Nie znaleziono wycieczek");

  const { data: bookings, error: bookingsError } = await admin
    .from("bookings")
    .select("id, trip_id, booking_ref, payment_status, paid_amount_cents, first_payment_status, second_payment_status")
    .in("trip_id", trips.map((t) => t.id));
  if (bookingsError) throw bookingsError;
  const { data: history, error: historyError } = await admin
    .from("payment_history")
    .select("id, booking_id, amount_cents, payment_method, notes")
    .in("booking_id", (bookings ?? []).map((b) => b.id));
  if (historyError) throw historyError;

  const outDir = resolve(root, "audyty");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const backupPath = resolve(outDir, `backup-przed-sync-paynow-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify({ trips, bookings, history }, null, 2));
  console.log(`Kopia: ${backupPath}`);

  let notesFixed = 0;
  const changes: string[] = [];
  for (const booking of bookings ?? []) {
    const rows = (history ?? []).filter((h) => h.booking_id === booking.id && isPaynowHistoryEntry(h));
    for (const row of rows) {
      const paymentId = extractPaynowPaymentIdFromNotes(row.notes);
      if (!paymentId) continue;
      const api = await getPaynowPaymentStatus(paymentId);
      if (!api.found || api.status.toUpperCase() !== "CONFIRMED") continue;
      const nextNotes = withPaynowStatusConfirmed(row.notes);
      if (nextNotes === (row.notes ?? "")) continue;
      notesFixed++;
      if (apply) {
        const { error } = await admin.from("payment_history").update({ notes: nextNotes }).eq("id", row.id);
        if (error) throw new Error(`payment_history ${row.id}: ${error.message}`);
      }
    }

    if (apply) {
      const recalc = await recalculateBookingPaymentsFromHistory(admin, booking.id);
      if (!recalc.ok) throw new Error(`recalc ${booking.booking_ref}: ${recalc.error}`);
      if (recalc.totalPaid !== (booking.paid_amount_cents ?? 0) || recalc.paymentStatus !== booking.payment_status) {
        changes.push(
          `${booking.booking_ref}: ${(booking.paid_amount_cents ?? 0) / 100} zł ${booking.payment_status} → ${recalc.totalPaid / 100} zł ${recalc.paymentStatus} (należność ${recalc.amountDue / 100} zł)`,
        );
      }
    }
  }

  console.log(`${apply ? "Poprawiono" : "Do poprawy"} notatek: ${notesFixed}`);
  if (apply) {
    console.log(`Zmienione rezerwacje: ${changes.length}`);
    for (const c of changes) console.log(`- ${c}`);
  } else {
    console.log("Tryb podglądu — dodaj --apply, aby zapisać.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
