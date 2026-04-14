import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get("trip_id");

    let query = supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        amount_cents,
        status,
        created_at,
        updated_at,
        booking_id,
        fakturownia_invoice_id,
        invoice_provider_error,
        bookings (
          id,
          booking_ref,
          contact_email,
          trip_id,
          trips (
            id,
            title,
            price_cents
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (tripId) {
      query = query.eq("bookings.trip_id", tripId);
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error("Error fetching invoices:", error);
      return NextResponse.json(
        { error: "Failed to fetch invoices", details: error.message },
        { status: 500 }
      );
    }

    // When filtering by trip_id via join, invoices with non-matching bookings
    // still appear but with null bookings — filter them out client-side
    const filtered = tripId
      ? (invoices || []).filter(
          (inv) => inv.bookings !== null
        )
      : invoices || [];

    const invoicesWithParticipants = await Promise.all(
      filtered.map(async (invoice) => {
        if (!invoice.booking_id) {
          return { ...invoice, participants_count: 0 };
        }
        const { count } = await supabase
          .from("participants")
          .select("*", { count: "exact", head: true })
          .eq("booking_id", invoice.booking_id);
        return { ...invoice, participants_count: count || 0 };
      })
    );

    return NextResponse.json(invoicesWithParticipants);
  } catch (error) {
    console.error("GET /api/invoices error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
