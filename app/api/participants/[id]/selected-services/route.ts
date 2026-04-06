import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
      .select("id")
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

    return NextResponse.json({ success: true, selected_services: normalized });
  } catch (err) {
    console.error("PATCH selected-services unexpected", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
