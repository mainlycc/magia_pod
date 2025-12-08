import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id,title,slug,description,start_date,end_date,price_cents,seats_total,seats_reserved,is_active,category,location,is_public,public_slug",
    )
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const payload: Partial<{
      title: string;
      description: string;
      start_date: string;
      end_date: string;
      price_cents: number;
      seats_total: number;
      category: string;
      location: string;
      is_public: boolean;
      public_slug: string | null;
    }> = {};
    if ("title" in body) payload.title = body.title;
    if ("description" in body) payload.description = body.description ?? null;
    if ("start_date" in body) payload.start_date = body.start_date ?? null;
    if ("end_date" in body) payload.end_date = body.end_date ?? null;
    if ("price_cents" in body) payload.price_cents = body.price_cents;
    if ("seats_total" in body) payload.seats_total = body.seats_total;
    if ("category" in body) payload.category = body.category ?? null;
    if ("location" in body) payload.location = body.location ?? null;
    if ("is_public" in body) payload.is_public = Boolean(body.is_public);
    if ("public_slug" in body) payload.public_slug = body.public_slug ?? null;

    const supabase = await createClient();
    
    // Sprawdź czy użytkownik jest adminem
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { error } = await supabase.from("trips").update(payload).eq("id", id);
    if (error) {
      console.error("Error updating trip:", error);
      return NextResponse.json({ error: "update_failed", details: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error in PATCH /api/trips/[id]:", err);
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Sprawdź czy użytkownik jest adminem
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Sprawdź czy wycieczka ma rezerwacje
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id")
      .eq("trip_id", id)
      .limit(1);

    if (bookingsError) {
      console.error("Error checking bookings:", bookingsError);
      return NextResponse.json({ error: "check_failed" }, { status: 500 });
    }

    if (bookings && bookings.length > 0) {
      return NextResponse.json(
        { error: "cannot_delete", message: "Nie można usunąć wycieczki z istniejącymi rezerwacjami" },
        { status: 409 }
      );
    }

    // Usuń wycieczkę
    const { error: deleteError } = await adminSupabase
      .from("trips")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting trip:", deleteError);
      if (deleteError.code === "23503") {
        // Foreign key constraint violation
        return NextResponse.json(
          { error: "cannot_delete", message: "Nie można usunąć wycieczki z powiązanymi danymi" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/trips/[id]:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}


