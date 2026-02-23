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
  try {
    const { id } = await context.params;
    console.log("GET /api/trips/[id] - Requested ID:", id);
    
    const supabase = await createClient();
    
    // Sprawdź czy użytkownik jest zalogowany
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log("User:", user?.id, "Auth error:", authError);
    
    // Sprawdź czy użytkownik jest adminem - jeśli tak, może zobaczyć wszystkie wycieczki
    const isAdmin = await checkAdmin(supabase);
    console.log("Is admin:", isAdmin);
    
    let query = supabase
      .from("trips")
      .select(
        "id,title,slug,description,start_date,end_date,price_cents,seats_total,seats_reserved,is_active,category,location,is_public,public_slug,registration_mode,require_pesel,form_show_additional_services,company_participants_info,form_additional_attractions,form_diets,form_extra_insurances,form_required_participant_fields,payment_split_enabled,payment_split_first_percent,payment_split_second_percent,payment_reminder_enabled,payment_reminder_days_before,payment_schedule",
      )
      .eq("id", id);
    
    // Jeśli nie jest adminem, filtruj tylko aktywne wycieczki (zgodnie z RLS)
    if (!isAdmin) {
      query = query.eq("is_active", true);
    }
    
    const { data, error } = await query.single();
    
    console.log("Query result - data:", data, "error:", error);
    
    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: "not_found", details: error.message }, { status: 404 });
    }
    
    if (!data) {
      console.error("No data returned for trip ID:", id);
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in GET /api/trips/[id]:", err);
    return NextResponse.json({ error: "internal_error", details: String(err) }, { status: 500 });
  }
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
      registration_mode: string | null;
      require_pesel: boolean | null;
      form_show_additional_services: boolean | null;
      company_participants_info: string | null;
      form_additional_attractions: unknown;
      form_diets: unknown;
      form_extra_insurances: unknown;
      form_required_participant_fields: unknown;
      payment_split_enabled: boolean;
      payment_split_first_percent: number | null;
      payment_split_second_percent: number | null;
      payment_reminder_enabled: boolean;
      payment_reminder_days_before: number | null;
      payment_schedule: unknown;
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
    if ("registration_mode" in body)
      payload.registration_mode = body.registration_mode ?? "both";
    if ("require_pesel" in body)
      payload.require_pesel = body.require_pesel;
    if ("form_show_additional_services" in body)
      payload.form_show_additional_services = body.form_show_additional_services === true ? true : (body.form_show_additional_services === false ? false : null);
    if ("company_participants_info" in body)
      payload.company_participants_info = body.company_participants_info ?? null;
    if ("form_additional_attractions" in body)
      payload.form_additional_attractions = body.form_additional_attractions ?? null;
    if ("form_diets" in body)
      payload.form_diets = body.form_diets ?? null;
    if ("form_extra_insurances" in body)
      payload.form_extra_insurances = body.form_extra_insurances ?? null;
    if ("form_required_participant_fields" in body)
      payload.form_required_participant_fields = body.form_required_participant_fields ?? null;
    if ("payment_split_enabled" in body)
      payload.payment_split_enabled = Boolean(body.payment_split_enabled);
    if ("payment_split_first_percent" in body)
      payload.payment_split_first_percent = body.payment_split_first_percent ?? null;
    if ("payment_split_second_percent" in body)
      payload.payment_split_second_percent = body.payment_split_second_percent ?? null;
    if ("payment_reminder_enabled" in body)
      payload.payment_reminder_enabled = Boolean(body.payment_reminder_enabled);
    if ("payment_reminder_days_before" in body)
      payload.payment_reminder_days_before = body.payment_reminder_days_before ?? null;
    if ("payment_schedule" in body)
      payload.payment_schedule = body.payment_schedule ?? null;

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

    // Usuń wycieczkę (rezerwacje i powiązane dane zostaną usunięte automatycznie przez CASCADE)
    const { error: deleteError } = await adminSupabase
      .from("trips")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting trip:", deleteError);
      return NextResponse.json({ error: "delete_failed", details: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/trips/[id]:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}


