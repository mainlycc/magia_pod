import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recalculateBookingPaymentsFromHistory } from "@/lib/bookings/recalculate-booking-payments";

/**
 * Jednorazowo synchronizuje bookings.paid_amount_cents oraz statusy z payment_history
 * dla wszystkich rezerwacji danej wycieczki (np. po wpłacie Paynow bez pełnego webhooka).
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data: bookings, error } = await supabase.from("bookings").select("id").eq("trip_id", tripId);

    if (error) {
      console.error("[reconcile-payments] bookings fetch:", error);
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    let ok = 0;
    let failed = 0;
    for (const b of bookings || []) {
      const r = await recalculateBookingPaymentsFromHistory(supabase, b.id);
      if (r.ok) ok++;
      else {
        failed++;
        console.warn("[reconcile-payments] booking", b.id, r);
      }
    }

    return NextResponse.json({ tripId, reconciled: ok, failed });
  } catch (e) {
    console.error("[reconcile-payments]", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
