import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Helper do sprawdzenia czy użytkownik to admin
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { id } = await context.params;

    // Pobierz zgłoszenie z podstawowymi informacjami
    const { data: submission, error: submissionError } = await supabase
      .from("insurance_submissions")
      .select(
        `
        id,
        trip_id,
        booking_id,
        participants_count,
        submission_date,
        status,
        error_message,
        api_payload,
        api_response,
        policy_number,
        created_at,
        updated_at,
        trips:trips!inner(id, title, start_date, end_date)
        `
      )
      .eq("id", id)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Pobierz uczestników zgłoszenia
    const { data: submissionParticipants, error: participantsError } = await supabase
      .from("insurance_submission_participants")
      .select(
        `
        id,
        hdi_required_data,
        participants:participants!inner(
          id,
          first_name,
          last_name,
          pesel,
          email,
          phone,
          document_type,
          document_number
        )
        `
      )
      .eq("submission_id", id);

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
    }

    // Przekształć dane
    const trips = Array.isArray(submission.trips) && submission.trips.length > 0 
      ? submission.trips[0] 
      : null;

    const participants = (submissionParticipants || []).map((sp: any) => ({
      id: sp.participants?.id,
      first_name: sp.participants?.first_name || "",
      last_name: sp.participants?.last_name || "",
      pesel: sp.participants?.pesel || null,
      email: sp.participants?.email || null,
      phone: sp.participants?.phone || null,
      document_type: sp.participants?.document_type || null,
      document_number: sp.participants?.document_number || null,
      hdi_required_data: sp.hdi_required_data || {},
    }));

    const result = {
      ...submission,
      trips,
      participants,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { status, error_message, policy_number } = body;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (error_message !== undefined) updateData.error_message = error_message;
    if (policy_number !== undefined) updateData.policy_number = policy_number;

    const { data, error } = await supabase
      .from("insurance_submissions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating submission:", error);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

