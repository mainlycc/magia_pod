import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("title,slug,description,start_date,end_date,price_cents,seats_total,is_active")
    .eq("id", id)
    .single();
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Generuj automatycznie numeryczny slug (tak jak przy tworzeniu nowej wycieczki)
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
    for (const existingTrip of existingTrips) {
      const slug = existingTrip.slug;
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

  const { error } = await supabase.from("trips").insert({
    title: `${trip.title} (kopiuj)`,
    slug: newSlug,
    description: trip.description,
    start_date: trip.start_date,
    end_date: trip.end_date,
    price_cents: trip.price_cents,
    seats_total: trip.seats_total,
    is_active: false,
  });
  if (error) return NextResponse.json({ error: "duplicate_failed" }, { status: 500 });
  return NextResponse.redirect(new URL(`/admin/trips`, process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"));
}


