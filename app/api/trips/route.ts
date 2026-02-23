import { NextResponse } from "next/server";
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

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
    const isAdmin = userId ? await checkAdmin(supabase) : false;

    let query = supabase.from("trips").select("*");

    // Jeśli użytkownik nie jest adminem, zwróć tylko aktywne wycieczki
    if (!isAdmin) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching trips:", error);
      return NextResponse.json({ error: "fetch_failed", details: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("Error in GET /api/trips:", err);
    return NextResponse.json({ error: "internal_error", details: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      slug: providedSlug, // Ignorujemy podany slug, generujemy automatycznie
      description,
      start_date,
      end_date,
      price_cents,
      seats_total,
      is_active,
      category,
      location,
      is_public,
      public_slug,
      registration_mode,
      require_pesel,
      company_participants_info,
      payment_schedule,
    } = body ?? {};
    if (!title) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

    const supabase = await createClient();
    
    // Sprawdź czy użytkownik jest adminem
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Generuj automatycznie numeryczny slug
    // Pobierz wszystkie slugi i znajdź najwyższy numeryczny
    const { data: existingTrips, error: fetchError } = await supabase
      .from("trips")
      .select("slug");

    if (fetchError) {
      console.error("Error fetching existing trips:", fetchError);
      return NextResponse.json({ error: "fetch_failed", details: fetchError.message }, { status: 500 });
    }

    // Znajdź najwyższy numeryczny slug
    let maxNumericSlug = 0;
    if (existingTrips) {
      for (const trip of existingTrips) {
        const slug = trip.slug;
        // Sprawdź czy slug jest czysto numeryczny
        if (slug && /^\d+$/.test(slug)) {
          const numericValue = parseInt(slug, 10);
          if (!isNaN(numericValue) && numericValue > maxNumericSlug) {
            maxNumericSlug = numericValue;
          }
        }
      }
    }

    // Wygeneruj nowy numeryczny slug (następny numer)
    const newSlug = String(maxNumericSlug + 1);

    const { data, error } = await supabase
      .from("trips")
      .insert({
        title,
        slug: newSlug,
        description: description ?? null,
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        price_cents: typeof price_cents === "number" ? price_cents : null,
        seats_total: typeof seats_total === "number" ? seats_total : 0,
        is_active: is_active ?? true,
        is_public: Boolean(is_public),
        public_slug: public_slug ?? null,
        category: category ?? null,
        location: location ?? null,
        registration_mode: registration_mode ?? "both",
        require_pesel: typeof require_pesel === "boolean" ? require_pesel : true,
        company_participants_info: company_participants_info ?? null,
        payment_schedule: payment_schedule && Array.isArray(payment_schedule) ? payment_schedule : null,
      })
      .select("id, slug")
      .single();
    
    if (error) {
      console.error("Error inserting trip:", error);
      return NextResponse.json({ error: "insert_failed", details: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ ok: true, id: data?.id, slug: data?.slug });
  } catch (err) {
    console.error("Error in POST /api/trips:", err);
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}


