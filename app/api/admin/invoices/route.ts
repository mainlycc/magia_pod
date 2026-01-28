import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Pobierz faktury z powiązanymi danymi rezerwacji i wycieczek
    const { data: invoices, error } = await supabase
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
        saldeo_invoice_id,
        saldeo_error,
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

    if (error) {
      console.error("Error fetching invoices:", error);
      return NextResponse.json(
        { error: "Failed to fetch invoices", details: error.message },
        { status: 500 }
      );
    }

    // Dla każdej faktury policz liczbę uczestników
    const invoicesWithParticipants = await Promise.all(
      (invoices || []).map(async (invoice) => {
        if (!invoice.booking_id) {
          return { ...invoice, participants_count: 0 };
        }

        const { count } = await supabase
          .from("participants")
          .select("*", { count: "exact", head: true })
          .eq("booking_id", invoice.booking_id);

        return {
          ...invoice,
          participants_count: count || 0,
        };
      })
    );

    return NextResponse.json(invoicesWithParticipants);
  } catch (error) {
    console.error("GET /api/admin/invoices error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
