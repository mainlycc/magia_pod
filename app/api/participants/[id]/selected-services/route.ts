import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { syncParticipantInsurancesForBooking } from "@/lib/insurance-local/sync-participant-insurances";
import { syncFakturowniaOrderForBooking } from "@/lib/invoices/invoice-service";
import { recalculateBookingPaymentsFromHistory } from "@/lib/bookings/recalculate-booking-payments";

const dietEntrySchema = z.object({
  service_id: z.string().min(1),
  variant_id: z.string().optional(),
  price_cents: z.number().int().nullable().optional(),
});

const insuranceEntrySchema = z.object({
  service_id: z.string().min(1),
  variant_id: z.string().optional(),
  price_cents: z.number().int().nullable().optional(),
});

const attractionEntrySchema = z.object({
  service_id: z.string().min(1),
  price_cents: z.number().int().nullable().optional(),
  currency: z.string().optional(),
  include_in_contract: z.boolean().optional(),
});

const selectedServicesSchema = z
  .object({
    diets: z.array(dietEntrySchema).optional(),
    insurances: z.array(insuranceEntrySchema).optional(),
    attractions: z.array(attractionEntrySchema).optional(),
  })
  .strict();

const patchBodySchema = z.object({
  selected_services: selectedServicesSchema,
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: participantId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let body: z.infer<typeof patchBodySchema>;
    try {
      const json = await request.json();
      body = patchBodySchema.parse(json);
    } catch (e) {
      console.error("PATCH selected-services invalid body", e);
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const { data: participant, error: fetchError } = await supabase
      .from("participants")
      .select("id, booking_id")
      .eq("id", participantId)
      .single();

    if (fetchError || !participant) {
      return NextResponse.json({ error: "participant_not_found" }, { status: 404 });
    }

    const payload = body.selected_services;
    const normalized: Record<string, unknown> = {};
    if (payload.diets?.length) normalized.diets = payload.diets;
    if (payload.insurances?.length) normalized.insurances = payload.insurances;
    if (payload.attractions?.length) normalized.attractions = payload.attractions;

    const { error: updateError } = await supabase
      .from("participants")
      .update({ selected_services: normalized })
      .eq("id", participantId);

    if (updateError) {
      console.error("selected_services update failed", updateError);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    let fakturowniaOrderSync: Awaited<ReturnType<typeof syncFakturowniaOrderForBooking>> | null =
      null;
    let paymentRecalc:
      | Awaited<ReturnType<typeof recalculateBookingPaymentsFromHistory>>
      | null = null;

    if (participant.booking_id) {
      try {
        await syncParticipantInsurancesForBooking(participant.booking_id);
      } catch (syncErr) {
        console.error("participant_insurances sync failed after selected-services update:", syncErr);
      }

      try {
        paymentRecalc = await recalculateBookingPaymentsFromHistory(
          supabase,
          participant.booking_id,
        );
        if (!paymentRecalc.ok) {
          console.error(
            "payment status recalc failed after selected-services update:",
            paymentRecalc.error,
          );
        }
      } catch (recalcErr) {
        console.error(
          "payment status recalc threw after selected-services update:",
          recalcErr,
        );
        paymentRecalc = {
          ok: false,
          error: recalcErr instanceof Error ? recalcErr.message : "recalc_threw",
        };
      }

      try {
        fakturowniaOrderSync = await syncFakturowniaOrderForBooking(participant.booking_id);
        if (fakturowniaOrderSync.error) {
          console.error(
            "fakturownia order sync failed after selected-services update:",
            fakturowniaOrderSync.error
          );
        }
      } catch (orderSyncErr) {
        console.error(
          "fakturownia order sync threw after selected-services update:",
          orderSyncErr
        );
        fakturowniaOrderSync = {
          synced: false,
          error: orderSyncErr instanceof Error ? orderSyncErr.message : "sync_threw",
        };
      }
    }

    return NextResponse.json({
      success: true,
      selected_services: normalized,
      payment_recalc: paymentRecalc,
      fakturownia_order_sync: fakturowniaOrderSync,
    });
  } catch (err) {
    console.error("PATCH selected-services unexpected", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
