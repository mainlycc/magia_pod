import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ensureAgreementForBooking,
  resolvePdfBaseUrl,
} from "@/lib/agreements/ensure-agreement";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> | { token: string } },
) {
  try {
    const params = await (context.params instanceof Promise
      ? context.params
      : Promise.resolve(context.params));
    const { token } = params;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(token);

    let bookingId: string | null = null;

    if (isUuid) {
      const result = await supabase.rpc("get_booking_by_token", {
        booking_token: token,
      });
      const row = Array.isArray(result.data) ? result.data[0] : null;
      bookingId = row?.id ?? null;
    } else {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminSupabase = createAdminClient();
      const { data: booking } = await adminSupabase
        .from("bookings")
        .select("id")
        .eq("booking_ref", token)
        .single();
      bookingId = booking?.id ?? null;
    }

    if (!bookingId) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const { origin } = new URL(request.url);
    const baseUrl = resolvePdfBaseUrl(origin);
    const result = await ensureAgreementForBooking(bookingId, { baseUrl });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      booking_id: bookingId,
      agreement_seq: result.agreement_seq,
      filename: result.filename,
      created: result.created,
    });
  } catch (error) {
    console.error("POST /api/bookings/by-token/[token]/ensure-agreement error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
