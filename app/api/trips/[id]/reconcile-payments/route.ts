import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recalculateTripBookingsPayments } from "@/lib/bookings/recalculate-booking-payments";

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

    const result = await recalculateTripBookingsPayments(supabase, tripId);

    if (result.error) {
      console.error("[reconcile-payments] batch:", result.error);
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    return NextResponse.json({
      tripId,
      reconciled: result.reconciled,
      failed: result.failed,
    });
  } catch (e) {
    console.error("[reconcile-payments]", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
