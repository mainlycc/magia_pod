import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaynowPaymentStatus } from "@/lib/paynow";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { booking_ref, payment_id } = body;

    if (!booking_ref && !payment_id) {
      return NextResponse.json(
        { error: "booking_ref or payment_id is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Znajdź rezerwację
    let booking;
    if (booking_ref) {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, booking_ref, payment_status, trip_id")
        .eq("booking_ref", booking_ref)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "booking_not_found" },
          { status: 404 }
        );
      }
      booking = data;
    } else {
      // Jeśli mamy payment_id, musimy znaleźć rezerwację przez payment_history
      const { data: paymentHistory } = await supabase
        .from("payment_history")
        .select("booking_id, notes")
        .like("notes", `%${payment_id}%`)
        .single();

      if (!paymentHistory) {
        return NextResponse.json(
          { error: "payment_not_found" },
          { status: 404 }
        );
      }

      const { data, error } = await supabase
        .from("bookings")
        .select("id, booking_ref, payment_status, trip_id")
        .eq("id", paymentHistory.booking_id)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "booking_not_found" },
          { status: 404 }
        );
      }
      booking = data;
    }

    // Znajdź paymentId z payment_history dla tej rezerwacji
    const { data: paymentHistory } = await supabase
      .from("payment_history")
      .select("notes")
      .eq("booking_id", booking.id)
      .like("notes", "%Paynow payment%")
      .order("created_at", { ascending: false })
      .limit(1);

    let foundPaymentId = payment_id;
    
    // Jeśli nie podano payment_id, spróbuj wyciągnąć z payment_history
    if (!foundPaymentId && paymentHistory && paymentHistory.length > 0) {
      const notes = paymentHistory[0].notes || "";
      const match = notes.match(/Paynow payment ([A-Za-z0-9-]+)/);
      if (match && match[1]) {
        foundPaymentId = match[1];
      }
    }

    // Jeśli mamy payment_id (z parametru lub z payment_history), sprawdź status przez API Paynow
    if (foundPaymentId) {
      console.log(`Checking Paynow payment status for paymentId: ${foundPaymentId}, booking_ref: ${booking.booking_ref}`);
      
      const paymentStatus = await getPaynowPaymentStatus(foundPaymentId);

      if (!paymentStatus) {
        return NextResponse.json(
          { error: "failed_to_check_status", message: "Nie udało się sprawdzić statusu płatności w Paynow" },
          { status: 500 }
        );
      }

      const status = paymentStatus.status.toUpperCase();
      let newPaymentStatus: "unpaid" | "partial" | "paid" | "overpaid" = booking.payment_status as any;
      let shouldUpdate = false;

      console.log(`Paynow payment status: ${status}, current booking status: ${booking.payment_status}`);

      if (status === "CONFIRMED") {
        newPaymentStatus = "paid";
        shouldUpdate = true;

        // Sprawdź czy wpis w payment_history już istnieje
        const { data: existingPayment } = await supabase
          .from("payment_history")
          .select("id")
          .eq("booking_id", booking.id)
          .like("notes", `%${foundPaymentId}%`)
          .single();

        if (!existingPayment && paymentStatus.amount) {
          // Dodaj wpis w historii płatności
          const { error: insertError } = await supabase.from("payment_history").insert({
            booking_id: booking.id,
            amount_cents: paymentStatus.amount,
            payment_method: "paynow",
            notes: `Paynow payment ${foundPaymentId} - status: ${status}`,
          });

          if (insertError) {
            console.error("Failed to insert payment history:", insertError);
          }
        }
      }

      if (shouldUpdate && newPaymentStatus !== booking.payment_status) {
        // Aktualizuj status płatności w rezerwacji
        const { error: updateError } = await supabase
          .from("bookings")
          .update({ payment_status: newPaymentStatus })
          .eq("id", booking.id);

        if (updateError) {
          console.error("Failed to update booking payment status:", updateError);
          return NextResponse.json(
            { error: "update_failed" },
            { status: 500 }
          );
        }

        console.log(`[Paynow Check Status] Successfully updated booking ${booking.id} payment status from ${booking.payment_status} to ${newPaymentStatus}`);

        // Odśwież dane w cache Supabase, aby zmiany były widoczne natychmiast
        // To pomaga w przypadku gdy Realtime nie działa
        await supabase
          .from("bookings")
          .select("id, payment_status")
          .eq("id", booking.id)
          .single();

        return NextResponse.json({
          success: true,
          payment_status: newPaymentStatus,
          paynow_status: status,
          message: "Status płatności został zaktualizowany na 'opłacona'",
        });
      }

      return NextResponse.json({
        success: true,
        payment_status: booking.payment_status,
        paynow_status: status,
        message: status === "CONFIRMED" 
          ? "Płatność jest potwierdzona w Paynow, ale status w systemie już jest poprawny"
          : `Status płatności w Paynow: ${status}`,
      });
    }

    // Jeśli nie mamy payment_id, zwróć aktualny status
    return NextResponse.json({
      success: false,
      payment_status: booking.payment_status,
      message: "Nie znaleziono paymentId dla tej rezerwacji. Płatność może nie być jeszcze utworzona w Paynow.",
    });
  } catch (error) {
    console.error("Error checking payment status:", error);
    return NextResponse.json(
      { error: "unexpected_error" },
      { status: 500 }
    );
  }
}

