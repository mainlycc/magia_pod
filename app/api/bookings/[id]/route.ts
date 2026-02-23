import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_STATUS_VALUES } from "@/app/admin/trips/[id]/bookings/payment-status";

const updateSchema = z.object({
  payment_status: z.enum(PAYMENT_STATUS_VALUES).optional(),
  first_payment_status: z.enum(["unpaid", "paid"]).optional(),
  second_payment_status: z.enum(["unpaid", "paid"]).optional(),
  paid_amount_cents: z.number().int().min(0).optional(),
  status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
  internal_notes: z.array(z.any()).optional(),
});

type UpdatePayload = z.infer<typeof updateSchema>;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      *,
      trips:trips(*),
      participants:participants(*),
      agreements:agreements(*),
      payment_history:payment_history(*)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Failed to fetch booking", error);
    if (error.code === "PGRST301") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Upewnij się, że payment_history jest tablicą
  if (data.payment_history && !Array.isArray(data.payment_history)) {
    data.payment_history = [];
  } else if (!data.payment_history) {
    data.payment_history = [];
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let payload: UpdatePayload;

  try {
    const body = await request.json();
    payload = updateSchema.parse(body);
  } catch (error) {
    console.error("Invalid payload for PATCH /api/bookings/[id]", error);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createClient();

  const updateData: Record<string, any> = {};
  if (payload.payment_status !== undefined) {
    updateData.payment_status = payload.payment_status;
  }
  if (payload.first_payment_status !== undefined) {
    updateData.first_payment_status = payload.first_payment_status;
  }
  if (payload.second_payment_status !== undefined) {
    updateData.second_payment_status = payload.second_payment_status;
  }
  if (payload.paid_amount_cents !== undefined) {
    updateData.paid_amount_cents = payload.paid_amount_cents;
  }
  if (payload.status !== undefined) {
    updateData.status = payload.status;
  }
  if (payload.internal_notes !== undefined) {
    updateData.internal_notes = payload.internal_notes;
  }

  // Automatycznie przelicz statusy jeśli zmieniono kwotę wpłaty lub status raty
  if (
    payload.paid_amount_cents !== undefined ||
    payload.first_payment_status !== undefined ||
    payload.second_payment_status !== undefined
  ) {
    // Pobierz aktualny stan bookingu + cenę wycieczki
    const { data: currentBooking } = await supabase
      .from("bookings")
      .select(
        "first_payment_status, second_payment_status, first_payment_amount_cents, second_payment_amount_cents, paid_amount_cents, trips:trips(price_cents)"
      )
      .eq("id", id)
      .single();

    if (currentBooking) {
      const trip = Array.isArray(currentBooking.trips)
        ? currentBooking.trips[0]
        : currentBooking.trips;
      const totalCents = trip?.price_cents ?? 0;
      const paidCents = payload.paid_amount_cents ?? currentBooking.paid_amount_cents ?? 0;
      const firstAmount = currentBooking.first_payment_amount_cents ?? 0;
      const secondAmount = currentBooking.second_payment_amount_cents ?? 0;

      // Przelicz statusy rat na podstawie wpłaconej kwoty
      if (payload.paid_amount_cents !== undefined) {
        if (firstAmount > 0) {
          updateData.first_payment_status = paidCents >= firstAmount ? "paid" : "unpaid";
        }
        if (secondAmount > 0) {
          updateData.second_payment_status =
            paidCents >= firstAmount + secondAmount ? "paid" : "unpaid";
        }
      }

      // Przelicz ogólny payment_status
      if (totalCents > 0) {
        if (paidCents >= totalCents) {
          updateData.payment_status = paidCents > totalCents ? "overpaid" : "paid";
        } else if (paidCents > 0) {
          updateData.payment_status = "partial";
        } else {
          updateData.payment_status = "unpaid";
        }
      } else {
        // Fallback po statusach rat
        const first =
          updateData.first_payment_status ??
          payload.first_payment_status ??
          currentBooking.first_payment_status ??
          "unpaid";
        const second =
          updateData.second_payment_status ??
          payload.second_payment_status ??
          currentBooking.second_payment_status ??
          "unpaid";
        const hasSecondPayment = secondAmount > 0;

        if (hasSecondPayment) {
          if (first === "paid" && second === "paid") {
            updateData.payment_status = "paid";
          } else if (first === "paid" || second === "paid") {
            updateData.payment_status = "partial";
          } else {
            updateData.payment_status = "unpaid";
          }
        } else {
          updateData.payment_status = first === "paid" ? "paid" : "unpaid";
        }
      }
    }
  }

  const { data, error } = await supabase
    .from("bookings")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to update booking payment status", error);
    if (error.code === "PGRST301") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    payment_status: data.payment_status,
    first_payment_status: data.first_payment_status,
    second_payment_status: data.second_payment_status,
    paid_amount_cents: data.paid_amount_cents,
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Pobierz rezerwację, aby uzyskać trip_id i liczbę uczestników
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("trip_id, participants:participants(id)")
      .eq("id", id)
      .single();

    if (bookingError || !booking) {
      console.error("Failed to fetch booking for deletion", bookingError);
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const participantsCount = Array.isArray(booking.participants)
      ? booking.participants.length
      : 0;

    // Zwolnij miejsca w wycieczce
    if (participantsCount > 0 && booking.trip_id) {
      const { error: releaseError } = await supabase.rpc("release_trip_seats", {
        p_trip_id: booking.trip_id,
        p_requested: participantsCount,
      });

      if (releaseError) {
        console.error("Failed to release seats", releaseError);
        // Kontynuuj usuwanie nawet jeśli zwolnienie miejsc się nie powiodło
      }
    }

    // Usuń rezerwację (participants, agreements, payment_history zostaną usunięte przez CASCADE)
    const { error: deleteError } = await adminSupabase
      .from("bookings")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Failed to delete booking", deleteError);
      if (deleteError.code === "PGRST301") {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/bookings/[id] error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

