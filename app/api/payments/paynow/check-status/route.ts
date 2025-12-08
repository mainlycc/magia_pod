import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaynowPaymentStatus } from "@/lib/paynow";

// Wymuś dynamiczne renderowanie - wyłącz cache całkowicie
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    // Szukamy wszystkich wpisów związanych z Paynow, nie tylko pierwszego
    // Używamy admin clienta, aby ominąć RLS i mieć pewność, że znajdziemy wszystkie wpisy
    const adminClient = createAdminClient();
    const { data: paymentHistory, error: paymentHistoryError } = await adminClient
      .from("payment_history")
      .select("notes, created_at, amount_cents")
      .eq("booking_id", booking.id)
      .like("notes", "%Paynow payment%")
      .order("created_at", { ascending: false });

    if (paymentHistoryError) {
      console.error(`[Paynow Check Status] Error fetching payment history:`, paymentHistoryError);
    }

    let foundPaymentId = payment_id;
    
    // Jeśli nie podano payment_id, spróbuj wyciągnąć z payment_history
    if (!foundPaymentId && paymentHistory && paymentHistory.length > 0) {
      // Przeszukaj wszystkie wpisy, aby znaleźć payment_id
      // Szukamy różnych formatów:
      // - "Paynow payment XXX"
      // - "Paynow payment XXX - status: YYY"
      // - "Paynow payment XXX - status: PENDING (initialized)"
      for (const history of paymentHistory) {
        const notes = history.notes || "";
        // Szukaj różnych formatów - payment_id może być UUID lub innym identyfikatorem
        const patterns = [
          /Paynow payment ([A-Za-z0-9-]+)/i,  // Podstawowy format
          /payment[:\s]+([A-Za-z0-9-]+)/i,    // Alternatywny format
          /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i, // UUID format
        ];
        
        for (const pattern of patterns) {
          const match = notes.match(pattern);
          if (match && match[1]) {
            foundPaymentId = match[1];
            console.log(`[Paynow Check Status] Found payment_id ${foundPaymentId} from payment_history for booking ${booking.booking_ref}`, {
              notes: notes.substring(0, 100),
              pattern: pattern.toString(),
            });
            break;
          }
        }
        
        if (foundPaymentId) break;
      }
    }

    // Jeśli nadal nie znaleziono payment_id, loguj to dla debugowania
    if (!foundPaymentId) {
      console.log(`[Paynow Check Status] No payment_id found for booking ${booking.booking_ref}. Payment history entries:`, 
        paymentHistory?.map(h => ({ 
          notes: h.notes?.substring(0, 150), 
          created_at: h.created_at,
          amount_cents: h.amount_cents,
        })) || []
      );
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
        // NIE używamy .single() bo zwróci błąd gdy nie ma wpisu
        // Używamy admin clienta, aby ominąć RLS
        const adminClient = createAdminClient();
        const { data: existingPayment, error: checkError } = await adminClient
          .from("payment_history")
          .select("id, notes, amount_cents")
          .eq("booking_id", booking.id)
          .like("notes", `%${foundPaymentId}%`)
          .limit(1);

        if (checkError) {
          console.error(`[Paynow Check Status] Error checking existing payment history:`, checkError);
        }

        // Jeśli nie ma wpisu i mamy kwotę, dodaj nowy wpis
        if ((!existingPayment || existingPayment.length === 0) && paymentStatus.amount) {
          console.log(`[Paynow Check Status] No existing payment history found for payment ${foundPaymentId}, inserting new entry...`);
          console.log(`[Paynow Check Status] Insert data: booking_id=${booking.id}, amount_cents=${paymentStatus.amount}, payment_method=paynow`);
          
          // Użyj retry logic dla dodawania do payment_history
          let retries = 3;
          let insertSuccess = false;
          
          while (retries > 0 && !insertSuccess) {
            const { error: insertError, data: insertedPayment } = await adminClient
              .from("payment_history")
              .insert({
                booking_id: booking.id,
                amount_cents: paymentStatus.amount,
                payment_method: "paynow",
                notes: `Paynow payment ${foundPaymentId} - status: ${status}`,
              })
              .select();

            if (insertError) {
              console.error(`[Paynow Check Status] ❌ Failed to insert payment history (attempt ${4 - retries}/3):`, {
                error: insertError,
                errorCode: insertError.code,
                errorMessage: insertError.message,
                errorDetails: insertError.details,
                errorHint: insertError.hint,
                bookingId: booking.id,
                paymentId: foundPaymentId,
                amount: paymentStatus.amount,
              });
              
              retries--;
              if (retries > 0) {
                // Poczekaj chwilę przed ponowną próbą
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } else {
              insertSuccess = true;
              console.log(`[Paynow Check Status] ✓ Successfully inserted payment history entry for payment ${foundPaymentId}:`, insertedPayment);
            }
          }
          
          if (!insertSuccess) {
            console.error(`[Paynow Check Status] ⚠️ CRITICAL: Failed to insert payment history after 3 attempts. Payment ${foundPaymentId} may not be recorded in payment_history!`);
          }
        } else if (existingPayment && existingPayment.length > 0) {
          console.log(`[Paynow Check Status] Payment history entry already exists for payment ${foundPaymentId} (id: ${existingPayment[0].id}, amount: ${existingPayment[0].amount_cents})`);
        } else {
          console.log(`[Paynow Check Status] Skipping payment history insert - no amount provided (amount: ${paymentStatus.amount})`);
        }
      }

      // Dla potwierdzonych płatności ZAWSZE aktualizuj status, nawet jeśli już jest "paid"
      // To zapewnia, że status jest zawsze poprawny
      if (status === "CONFIRMED") {
        console.log(`[Paynow Check Status] CONFIRMED payment - forcing update to ensure status is correct`);
        console.log(`[Paynow Check Status] Current status: ${booking.payment_status}, Target status: ${newPaymentStatus}`);
        
        const adminClient = createAdminClient();
        const updateData: { payment_status: string; status?: string } = { payment_status: newPaymentStatus };
        updateData.status = "confirmed";
        console.log(`[Paynow Check Status] Also updating booking status to "confirmed"`);
        
        // Użyj retry logic dla aktualizacji statusu
        let updateRetries = 3;
        let updateSuccess = false;
        
        while (updateRetries > 0 && !updateSuccess) {
          const { error: updateError, data: updatedBooking } = await adminClient
            .from("bookings")
            .update(updateData)
            .eq("id", booking.id)
            .select()
            .single();

          if (updateError) {
            console.error(`[Paynow Check Status] Failed to update booking payment status (attempt ${4 - updateRetries}/3):`, {
              error: updateError,
              errorCode: updateError.code,
              errorMessage: updateError.message,
              errorDetails: updateError.details,
              bookingId: booking.id,
              bookingRef: booking.booking_ref,
              attemptedStatus: newPaymentStatus,
              updateData: updateData,
            });
            
            updateRetries--;
            if (updateRetries > 0) {
              // Poczekaj chwilę przed ponowną próbą
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } else {
            updateSuccess = true;
            console.log(`[Paynow Check Status] ✓ Successfully updated booking ${booking.id} payment status from ${booking.payment_status} to ${newPaymentStatus}`, {
              bookingId: booking.id,
              bookingRef: booking.booking_ref,
              oldStatus: booking.payment_status,
              newStatus: newPaymentStatus,
              updatedBooking: updatedBooking,
            });

            // Zweryfikuj, że aktualizacja się powiodła
            const { data: verifyBooking } = await adminClient
              .from("bookings")
              .select("id, payment_status, status")
              .eq("id", booking.id)
              .single();
            
            if (verifyBooking) {
              console.log(`[Paynow Check Status] Verification - booking ${booking.id} now has payment_status=${verifyBooking.payment_status}, status=${verifyBooking.status}`);
              
              // Jeśli weryfikacja pokazuje, że status nie został zaktualizowany, loguj to jako błąd
              if (verifyBooking.payment_status !== newPaymentStatus) {
                console.error(`[Paynow Check Status] ⚠️ VERIFICATION FAILED - Expected payment_status=${newPaymentStatus}, but got ${verifyBooking.payment_status}`);
              } else {
                console.log(`[Paynow Check Status] ✓ Verification successful - status correctly updated to ${newPaymentStatus}`);
              }
            } else {
              console.error(`[Paynow Check Status] ⚠️ Verification failed - could not fetch updated booking`);
            }
          }
        }
        
        if (!updateSuccess) {
          console.error(`[Paynow Check Status] ⚠️ CRITICAL: Failed to update booking payment status after 3 attempts. Payment ${foundPaymentId} may not be reflected in booking status!`);
          return NextResponse.json(
            { 
              error: "update_failed", 
              details: "Nie udało się zaktualizować statusu płatności po 3 próbach",
              payment_status: booking.payment_status,
              paynow_status: status,
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          payment_status: newPaymentStatus,
          paynow_status: status,
          message: booking.payment_status === newPaymentStatus 
            ? "Status płatności był już poprawny, ale został zweryfikowany i zaktualizowany"
            : "Status płatności został zaktualizowany na 'opłacona'",
        });
      } else if (shouldUpdate && newPaymentStatus !== booking.payment_status) {
        // Dla innych statusów aktualizuj tylko jeśli status się zmieni
        const adminClient = createAdminClient();
        const updateData: { payment_status: string; status?: string } = { payment_status: newPaymentStatus };
        
        const { error: updateError, data: updatedBooking } = await adminClient
          .from("bookings")
          .update(updateData)
          .eq("id", booking.id)
          .select()
          .single();

        if (updateError) {
          console.error("[Paynow Check Status] Failed to update booking payment status:", {
            error: updateError,
            errorCode: updateError.code,
            errorMessage: updateError.message,
            bookingId: booking.id,
            attemptedStatus: newPaymentStatus,
          });
          return NextResponse.json(
            { error: "update_failed", details: updateError.message },
            { status: 500 }
          );
        }

        console.log(`[Paynow Check Status] Successfully updated booking ${booking.id} payment status from ${booking.payment_status} to ${newPaymentStatus}`);

        return NextResponse.json({
          success: true,
          payment_status: newPaymentStatus,
          paynow_status: status,
          message: `Status płatności został zaktualizowany na '${newPaymentStatus}'`,
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

    // Jeśli nie mamy payment_id, zwróć aktualny status z bardziej szczegółowym komunikatem
    console.log(`[Paynow Check Status] No payment_id found for booking ${booking.booking_ref}. Cannot check Paynow status.`);
    return NextResponse.json({
      success: false,
      payment_status: booking.payment_status,
      message: `Nie znaleziono paymentId dla rezerwacji ${booking.booking_ref}. Płatność może nie być jeszcze utworzona w Paynow lub webhook nie został poprawnie przetworzony.`,
      debug: {
        booking_ref: booking.booking_ref,
        current_payment_status: booking.payment_status,
        payment_history_entries: paymentHistory?.length || 0,
      },
    });
  } catch (error) {
    console.error("Error checking payment status:", error);
    return NextResponse.json(
      { error: "unexpected_error" },
      { status: 500 }
    );
  }
}

