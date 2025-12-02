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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const tripId = searchParams.get("trip_id");

    let query = supabase
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
        policy_number,
        created_at,
        updated_at,
        trips:trips!inner(id, title, start_date, end_date)
        `
      )
      .order("submission_date", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (tripId) {
      query = query.eq("trip_id", tripId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching insurance submissions:", error);
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    // Przekształć dane - trips jest tablicą, ale powinien być pojedynczym obiektem
    const mappedData = (data || []).map((item: any) => ({
      ...item,
      trips: Array.isArray(item.trips) && item.trips.length > 0 ? item.trips[0] : null,
    }));

    return NextResponse.json(mappedData);
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { trip_id, booking_id, participants_count, participant_ids } = body;

    if (!trip_id || !participants_count || !Array.isArray(participant_ids) || participant_ids.length === 0) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Utwórz zgłoszenie
    const { data: submission, error: submissionError } = await supabase
      .from("insurance_submissions")
      .insert({
        trip_id,
        booking_id: booking_id || null,
        participants_count,
        status: "pending",
        submission_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (submissionError || !submission) {
      console.error("Error creating submission:", submissionError);
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }

    // Dodaj uczestników do zgłoszenia
    const submissionParticipants = participant_ids.map((participantId: string) => ({
      submission_id: submission.id,
      participant_id: participantId,
      hdi_required_data: {},
    }));

    const { error: participantsError } = await supabase
      .from("insurance_submission_participants")
      .insert(submissionParticipants);

    if (participantsError) {
      // Usuń zgłoszenie jeśli nie udało się dodać uczestników
      await supabase.from("insurance_submissions").delete().eq("id", submission.id);
      console.error("Error adding participants:", participantsError);
      return NextResponse.json({ error: "participants_failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: submission.id });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

