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
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await createClient();

    let force = false;
    let selectedServicesByParticipantId: Record<string, unknown> | undefined;
    try {
      const body = (await request.json()) as {
        force?: unknown;
        selected_services_by_participant_id?: unknown;
      } | null;
      force = body?.force === true;
      const raw = body?.selected_services_by_participant_id;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        selectedServicesByParticipantId = raw as Record<string, unknown>;
      }
    } catch {
      // Brak body (np. POST bez JSON) — zachowaj semantykę ensure
    }

    const { origin } = new URL(request.url);
    const baseUrl = resolvePdfBaseUrl(origin);
    const result = await ensureAgreementForBooking(id, {
      baseUrl,
      force,
      selectedServicesByParticipantId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Agreement generated successfully",
      filename: result.filename,
      agreement_seq: result.agreement_seq,
      created: result.created,
      regenerated: force,
    });
  } catch (error) {
    console.error("POST /api/bookings/[id]/agreement error", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: "Unexpected error", details: errorMessage },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
