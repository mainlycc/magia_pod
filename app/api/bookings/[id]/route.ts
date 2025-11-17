import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_STATUS_VALUES } from "@/app/admin/trips/[id]/bookings/payment-status";

const updateSchema = z.object({
  payment_status: z.enum(PAYMENT_STATUS_VALUES),
});

type UpdatePayload = z.infer<typeof updateSchema>;

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

  const { data, error } = await supabase
    .from("bookings")
    .update({
      payment_status: payload.payment_status,
    })
    .eq("id", id)
    .select("id, payment_status")
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

  return NextResponse.json({ payment_status: data.payment_status });
}

