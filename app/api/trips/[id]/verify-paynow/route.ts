import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTrip } from "@/lib/trips/can-manage-trip";
import { getPaynowEnvironment, getPaynowPaymentStatus } from "@/lib/paynow";
import type { PaynowStatusLookup } from "@/lib/paynow";
import {
  extractPaynowPaymentIdFromNotes,
  isPaynowHistoryEntry,
  withPaynowStatusConfirmed,
} from "@/lib/paynow/extract-payment-id";
import { recalculateBookingPaymentsFromHistory } from "@/lib/bookings/recalculate-booking-payments";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LocalPaymentStatus = "unpaid" | "partial" | "paid" | "overpaid" | string;

type PaymentCheck = {
  paymentId: string;
  localAmountCents: number | null;
  localNotes: string | null;
  paynowStatus: string | null;
  paynowAmountCents: number | null;
  verdict:
    | "ok_confirmed"
    | "ok_not_confirmed_and_local_unpaid"
    | "mismatch_local_paid_paynow_not_confirmed"
    | "mismatch_paynow_confirmed_local_unpaid"
    | "paynow_error"
    | "paynow_not_found";
};

type BookingVerifyResult = {
  bookingId: string;
  bookingRef: string;
  localPaymentStatus: LocalPaymentStatus;
  paidAmountCents: number;
  hasPaynowPayments: boolean;
  hasOnlyManualOrNoPaynow: boolean;
  hasManualPayments?: boolean;
  /** Lokalnie opłacone wyłącznie przez Paynow, ale żadna płatność nie jest CONFIRMED w API */
  suspiciousPaidWithoutPaynowConfirm: boolean;
  payments: PaymentCheck[];
  synced: boolean;
};

function isLocallyPaid(status: LocalPaymentStatus): boolean {
  return status === "paid" || status === "partial" || status === "overpaid";
}

function classifyPayment(args: {
  localStatus: LocalPaymentStatus;
  paynowStatus: string | null;
  localNotes: string | null;
}): PaymentCheck["verdict"] {
  if (!args.paynowStatus) return "paynow_not_found";

  const pn = args.paynowStatus.toUpperCase();
  const confirmed = pn === "CONFIRMED";
  const localPaid = isLocallyPaid(args.localStatus);
  const localNotesClaimConfirmed = /status:\s*CONFIRMED/i.test(args.localNotes ?? "");

  if (confirmed && localPaid) return "ok_confirmed";
  if (confirmed && !localPaid) return "mismatch_paynow_confirmed_local_unpaid";
  // Lokalna historia mówi CONFIRMED, a Paynow nie — realny rozjazd
  if (!confirmed && localNotesClaimConfirmed) {
    return "mismatch_local_paid_paynow_not_confirmed";
  }
  // Lokalnie opłacone (np. ręcznie), a Paynow nadal pending — porzucona sesja, nie rozjazd
  if (!confirmed && localPaid) return "ok_not_confirmed_and_local_unpaid";
  return "ok_not_confirmed_and_local_unpaid";
}

/**
 * Porównuje lokalne statusy płatności rezerwacji wycieczki ze statusami w Paynow API.
 * Body: { sync?: boolean } — przy sync=true dopina wpisy CONFIRMED i przelicza sumy lokalnie.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!(await canManageTrip(supabase, tripId))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    let sync = false;
    try {
      const body = await request.json();
      sync = Boolean(body?.sync);
    } catch {
      // brak body — tylko raport
    }

    const admin = createAdminClient();

    const { data: bookings, error: bookingsError } = await admin
      .from("bookings")
      .select("id, booking_ref, payment_status, paid_amount_cents")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });

    if (bookingsError) {
      console.error("[verify-paynow] bookings fetch:", bookingsError);
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    if (!bookings?.length) {
      return NextResponse.json({
        tripId,
        sync,
        environment: getPaynowEnvironment(),
        summary: {
          bookingsTotal: 0,
          withPaynow: 0,
          onlyManualOrNoPaynow: 0,
          ok: 0,
          mismatches: 0,
          paynowErrors: 0,
          synced: 0,
        },
        bookings: [] as BookingVerifyResult[],
      });
    }

    const bookingIds = bookings.map((b) => b.id);
    const { data: historyRows, error: historyError } = await admin
      .from("payment_history")
      .select("id, booking_id, amount_cents, payment_method, notes, created_at")
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: false });

    if (historyError) {
      console.error("[verify-paynow] payment_history fetch:", historyError);
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    const historyByBooking = new Map<string, typeof historyRows>();
    for (const row of historyRows || []) {
      const list = historyByBooking.get(row.booking_id) ?? [];
      list.push(row);
      historyByBooking.set(row.booking_id, list);
    }

    // Cache statusów Paynow — ten sam paymentId może wystąpić w wielu wpisach
    const paynowCache = new Map<string, PaynowStatusLookup | "error">();

    async function fetchPaynow(paymentId: string) {
      if (paynowCache.has(paymentId)) return paynowCache.get(paymentId)!;
      try {
        const status = await getPaynowPaymentStatus(paymentId);
        paynowCache.set(paymentId, status);
        return status;
      } catch (e) {
        console.error(`[verify-paynow] getPaynowPaymentStatus ${paymentId}:`, e);
        paynowCache.set(paymentId, "error");
        return "error" as const;
      }
    }

    const results: BookingVerifyResult[] = [];
    let syncedCount = 0;

    for (const booking of bookings) {
      const history = historyByBooking.get(booking.id) ?? [];
      const paynowEntries = history.filter(isPaynowHistoryEntry);

      // Unikalne paymentId (pierwszy wpis = najnowszy przez order desc)
      const seenIds = new Set<string>();
      const uniquePaynow: Array<{
        paymentId: string;
        amount_cents: number | null;
        notes: string | null;
      }> = [];

      for (const entry of paynowEntries) {
        const paymentId = extractPaynowPaymentIdFromNotes(entry.notes);
        if (!paymentId || seenIds.has(paymentId)) continue;
        seenIds.add(paymentId);
        uniquePaynow.push({
          paymentId,
          amount_cents: entry.amount_cents ?? null,
          notes: entry.notes ?? null,
        });
      }

      const payments: PaymentCheck[] = [];
      let needsSync = false;

      for (const pn of uniquePaynow) {
        const apiResult = await fetchPaynow(pn.paymentId);
        const apiFailed = apiResult === "error";
        const notFound = !apiFailed && !apiResult.found && apiResult.reason === "not_found";
        const httpError = !apiFailed && !apiResult.found && apiResult.reason === "error";
        const paynowStatus =
          !apiFailed && apiResult.found ? apiResult.status : null;
        const paynowAmount =
          !apiFailed && apiResult.found ? (apiResult.amount ?? null) : null;

        let verdict: PaymentCheck["verdict"];
        if (apiFailed || httpError) {
          verdict = "paynow_error";
        } else if (notFound) {
          verdict = "paynow_not_found";
        } else {
          verdict = classifyPayment({
            localStatus: booking.payment_status,
            paynowStatus,
            localNotes: pn.notes,
          });
        }

        if (verdict === "mismatch_paynow_confirmed_local_unpaid") {
          needsSync = true;
        }

        // Notes mówią PENDING, a API CONFIRMED — zaktualizuj notatki przy sync
        if (
          sync &&
          paynowStatus?.toUpperCase() === "CONFIRMED" &&
          /PENDING|NEW|WAITING/i.test(pn.notes ?? "")
        ) {
          needsSync = true;
        }

        payments.push({
          paymentId: pn.paymentId,
          localAmountCents: pn.amount_cents,
          localNotes: pn.notes,
          paynowStatus: paynowStatus?.toUpperCase() ?? null,
          paynowAmountCents: paynowAmount,
          verdict,
        });
      }

      let synced = false;
      // Przy sync przeliczamy KAŻDĄ rezerwację (PENDING nie wchodzi do sumy),
      // nie tylko te z needsSync z API Paynow.
      if (sync) {
        if (needsSync) {
          for (const check of payments) {
            if (check.paynowStatus !== "CONFIRMED") continue;

            const matchingRows = (history || []).filter(
              (h) => extractPaynowPaymentIdFromNotes(h.notes) === check.paymentId,
            );

            if (matchingRows.length === 0 && check.paynowAmountCents) {
              await admin.from("payment_history").insert({
                booking_id: booking.id,
                amount_cents: check.paynowAmountCents,
                payment_method: "paynow",
                notes: `Paynow payment ${check.paymentId} - status: CONFIRMED (synced by verify-paynow)`,
              });
            } else {
              for (const row of matchingRows) {
                const nextNotes = withPaynowStatusConfirmed(row.notes);
                if (nextNotes === (row.notes ?? "")) continue;
                await admin.from("payment_history").update({ notes: nextNotes }).eq("id", row.id);
              }
            }
          }
        }

        const recalc = await recalculateBookingPaymentsFromHistory(admin, booking.id);
        if (recalc.ok) {
          synced = true;
          syncedCount++;
          booking.payment_status = recalc.paymentStatus;
          booking.paid_amount_cents = recalc.totalPaid;
        } else {
          console.warn("[verify-paynow] recalc failed", booking.id, recalc);
        }
      }

      const hasManualPayments = history.some((h) => {
        const method = (h.payment_method ?? "").toLowerCase().trim();
        return method === "manual" || /ręczn/i.test(h.notes ?? "");
      });
      const anyPaynowConfirmed = payments.some((p) => p.paynowStatus === "CONFIRMED");
      const suspiciousPaidWithoutPaynowConfirm =
        isLocallyPaid(booking.payment_status) &&
        uniquePaynow.length > 0 &&
        !hasManualPayments &&
        !anyPaynowConfirmed;

      // „Ręcznie” tylko gdy są wpisy manual w historii i nadal jest lokalnie opłacone.
      // Sam brak ID Paynow + stary status ≠ wpłata ręczna.
      const hasOnlyManualOrNoPaynow =
        uniquePaynow.length === 0 &&
        hasManualPayments &&
        isLocallyPaid(booking.payment_status);

      results.push({
        bookingId: booking.id,
        bookingRef: booking.booking_ref,
        localPaymentStatus: booking.payment_status,
        paidAmountCents: booking.paid_amount_cents ?? 0,
        hasPaynowPayments: uniquePaynow.length > 0,
        hasOnlyManualOrNoPaynow,
        hasManualPayments,
        suspiciousPaidWithoutPaynowConfirm,
        payments,
        synced,
      });
    }

    const withPaynow = results.filter((r) => r.hasPaynowPayments).length;
    const onlyManual = results.filter((r) => r.hasOnlyManualOrNoPaynow).length;
    const mismatches = results.filter(
      (r) =>
        r.suspiciousPaidWithoutPaynowConfirm ||
        r.payments.some(
          (p) =>
            p.verdict === "mismatch_local_paid_paynow_not_confirmed" ||
            p.verdict === "mismatch_paynow_confirmed_local_unpaid",
        ),
    ).length;
    const paynowErrors = results.filter((r) =>
      r.payments.some((p) => p.verdict === "paynow_error" || p.verdict === "paynow_not_found"),
    ).length;
    const ok = results.filter(
      (r) =>
        r.hasPaynowPayments &&
        r.payments.every((p) => p.verdict === "ok_confirmed" || p.verdict === "ok_not_confirmed_and_local_unpaid") &&
        !r.payments.some((p) => p.verdict.startsWith("mismatch") || p.verdict.startsWith("paynow_")),
    ).length;

    return NextResponse.json({
      tripId,
      sync,
      environment: getPaynowEnvironment(),
      summary: {
        bookingsTotal: results.length,
        withPaynow,
        onlyManualOrNoPaynow: onlyManual,
        ok,
        mismatches,
        paynowErrors,
        synced: syncedCount,
      },
      bookings: results,
    });
  } catch (e) {
    console.error("[verify-paynow]", e);
    const message = e instanceof Error ? e.message : "internal_error";
    if (message.includes("Paynow is not configured")) {
      return NextResponse.json({ error: "paynow_not_configured", message }, { status: 503 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
