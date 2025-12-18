import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ParticipantsResponse = {
  bookings: Array<{ id: string; booking_ref: string | null; payment_status: string | null }>;
  participants: Array<{
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    booking_id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: tripId } = await context.params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Uwierzytelnienie koordynatora
    const { data: claims } = await supabase.auth.getClaims();
    const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Sprawdzenie dostępu do wycieczki
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("allowed_trip_ids")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Profiles fetch error", profileError);
      return NextResponse.json({ error: "profile_fetch_failed" }, { status: 500 });
    }

    const allowedTrips = (profile?.allowed_trip_ids as string[] | null) ?? [];
    const canAccessTrip = Array.isArray(allowedTrips) && allowedTrips.includes(tripId);
    if (!canAccessTrip) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Pobierz rezerwacje i uczestników z pominięciem RLS (service role)
    const { data: bookings, error: bookingsError } = await adminSupabase
      .from("bookings")
      .select("id, booking_ref, payment_status")
      .eq("trip_id", tripId);

    if (bookingsError) {
      console.error("Bookings fetch error", bookingsError);
      return NextResponse.json({ error: "bookings_fetch_failed" }, { status: 500 });
    }

    const bookingIds = (bookings ?? []).map((b) => b.id);
    let participants: ParticipantsResponse["participants"] = [];
    if (bookingIds.length) {
      const { data: participantsData, error: participantsError } = await adminSupabase
        .from("participants")
        .select("first_name,last_name,email,phone,booking_id")
        .in("booking_id", bookingIds);

      if (participantsError) {
        console.error("Participants fetch error", participantsError);
        return NextResponse.json({ error: "participants_fetch_failed" }, { status: 500 });
      }

      participants = participantsData ?? [];
    }

    const payload: ParticipantsResponse = {
      bookings: bookings ?? [],
      participants,
    };

    return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unexpected error in coord participants API", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}


