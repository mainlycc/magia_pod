import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { participantIds, subject, body } = await request.json();

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json({ error: "missing_participant_ids" }, { status: 400 });
    }

    if (!subject || !body) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const supabase = await createClient();

    // Sprawdź czy użytkownik jest adminem
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Pobierz uczestników z emailami
    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select("id, email, first_name, last_name, booking_id")
      .in("id", participantIds);

    if (participantsError || !participants) {
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    // Jeśli uczestnik nie ma emaila, pobierz contact_email z booking
    const bookingIds = Array.from(
      new Set(
        participants
          .filter((p) => !p.email && p.booking_id)
          .map((p) => p.booking_id)
      )
    );

    let bookingsMap = new Map<string, string>();
    if (bookingIds.length > 0) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, contact_email")
        .in("id", bookingIds);

      if (bookings) {
        bookings.forEach((b) => {
          if (b.contact_email) {
            bookingsMap.set(b.id, b.contact_email);
          }
        });
      }
    }

    // Zbierz wszystkie unikalne emaile
    const emails = Array.from(
      new Set(
        participants
          .map((p) => {
            // Najpierw użyj email z uczestnika, jeśli nie ma - użyj contact_email z booking
            if (p.email) {
              return p.email;
            }
            if (p.booking_id) {
              return bookingsMap.get(p.booking_id) || null;
            }
            return null;
          })
          .filter((e): e is string => Boolean(e))
      )
    );

    if (emails.length === 0) {
      return NextResponse.json({ error: "no_emails" }, { status: 400 });
    }

    // Wyślij emaile do wszystkich uczestników
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    
    await Promise.all(
      emails.map((to) =>
        fetch(`${baseUrl}/api/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, text: body }),
        })
      )
    );

    return NextResponse.json({ ok: true, sent: emails.length });
  } catch (error) {
    console.error("Error sending messages:", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

