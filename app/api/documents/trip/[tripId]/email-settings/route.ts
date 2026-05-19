import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidDocumentType } from "@/lib/documents/constants";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return profile?.role === "admin";
}

async function checkCoordinator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "coordinator") return false;

  const { data: coordinator } = await supabase
    .from("trip_coordinators")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .single();

  return !!coordinator;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    const isCoordinator = await checkCoordinator(supabase, tripId);

    if (!isAdmin && !isCoordinator) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const documentType = body?.document_type as string | undefined;
    const attachOnReservation = body?.attach_on_reservation;

    if (!documentType || !isValidDocumentType(documentType)) {
      return NextResponse.json({ error: "invalid_document_type" }, { status: 400 });
    }

    if (typeof attachOnReservation !== "boolean") {
      return NextResponse.json({ error: "invalid_attach_on_reservation" }, { status: 400 });
    }

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }

    const adminClient = createAdminClient();
    const { data: saved, error: upsertError } = await adminClient
      .from("trip_document_email_settings")
      .upsert(
        {
          trip_id: tripId,
          document_type: documentType,
          attach_on_reservation: attachOnReservation,
        },
        { onConflict: "trip_id,document_type" },
      )
      .select("document_type, attach_on_reservation")
      .single();

    if (upsertError) {
      console.error("PATCH email-settings upsert error:", upsertError);
      return NextResponse.json({ error: "database_error" }, { status: 500 });
    }

    return NextResponse.json(saved);
  } catch (error) {
    console.error("PATCH /api/documents/trip/[tripId]/email-settings error", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
