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

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { data: trip, error } = await supabase
      .from("trips")
      .select("program_atrakcje, dodatkowe_swiadczenia, gallery_urls, intro_text, section_poznaj_title, section_poznaj_description, trip_info_text, baggage_text, weather_text, show_trip_info_card, show_baggage_card, show_weather_card, show_seats_left, included_in_price_text, additional_costs_text, additional_service_text, reservation_number, duration_text, additional_fields, public_middle_sections, public_right_sections, public_hidden_middle_sections, public_hidden_right_sections, public_hidden_additional_sections")
      .eq("id", id)
      .single();

    if (error || !trip) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      program_atrakcje: trip.program_atrakcje || "",
      dodatkowe_swiadczenia: trip.dodatkowe_swiadczenia || "",
      gallery_urls: trip.gallery_urls || [],
      intro_text: trip.intro_text || "",
      section_poznaj_title: trip.section_poznaj_title || "",
      section_poznaj_description: trip.section_poznaj_description || "",
      trip_info_text: trip.trip_info_text || "",
      baggage_text: trip.baggage_text || "",
      weather_text: trip.weather_text || "",
      show_trip_info_card: trip.show_trip_info_card ?? true,
      show_baggage_card: trip.show_baggage_card ?? true,
      show_weather_card: trip.show_weather_card ?? true,
      show_seats_left: trip.show_seats_left ?? false,
      included_in_price_text: trip.included_in_price_text || "",
      additional_costs_text: trip.additional_costs_text || "",
      additional_service_text: trip.additional_service_text || "",
      reservation_number: trip.reservation_number || "",
      duration_text: trip.duration_text || "",
      additional_fields: trip.additional_fields || [],
      public_middle_sections: trip.public_middle_sections || null,
      public_right_sections: trip.public_right_sections || null,
      public_hidden_middle_sections: trip.public_hidden_middle_sections || null,
      public_hidden_right_sections: trip.public_hidden_right_sections || null,
      public_hidden_additional_sections: trip.public_hidden_additional_sections || null,
    });
  } catch {
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { 
      program_atrakcje, 
      dodatkowe_swiadczenia, 
      gallery_urls,
      intro_text,
      section_poznaj_title,
      section_poznaj_description,
      trip_info_text,
      baggage_text,
      weather_text,
      show_trip_info_card,
      show_baggage_card,
      show_weather_card,
      show_seats_left,
      included_in_price_text,
      additional_costs_text,
      additional_service_text,
      reservation_number,
      duration_text,
      additional_fields,
      public_middle_sections,
      public_right_sections,
      public_hidden_middle_sections,
      public_hidden_right_sections,
      public_hidden_additional_sections,
    } = body as {
      program_atrakcje?: string;
      dodatkowe_swiadczenia?: string;
      gallery_urls?: string[];
      intro_text?: string;
      section_poznaj_title?: string;
      section_poznaj_description?: string;
      trip_info_text?: string;
      baggage_text?: string;
      weather_text?: string;
      show_trip_info_card?: boolean;
      show_baggage_card?: boolean;
      show_weather_card?: boolean;
      show_seats_left?: boolean;
      included_in_price_text?: string;
      additional_costs_text?: string;
      additional_service_text?: string;
      reservation_number?: string;
      duration_text?: string;
      additional_fields?: Array<{ 
        id: string;
        sectionTitle: string;
        fields: Array<{ title: string; value: string }>;
      }>;
      public_middle_sections?: string[] | null;
      public_right_sections?: string[] | null;
      public_hidden_middle_sections?: string[] | null;
      public_hidden_right_sections?: string[] | null;
      public_hidden_additional_sections?: string[] | null;
    };

    const updateData: {
      program_atrakcje?: string | null;
      dodatkowe_swiadczenia?: string | null;
      gallery_urls?: string[];
      intro_text?: string | null;
      section_poznaj_title?: string | null;
      section_poznaj_description?: string | null;
      trip_info_text?: string | null;
      baggage_text?: string | null;
      weather_text?: string | null;
      show_trip_info_card?: boolean;
      show_baggage_card?: boolean;
      show_weather_card?: boolean;
      show_seats_left?: boolean;
      included_in_price_text?: string | null;
      additional_costs_text?: string | null;
      additional_service_text?: string | null;
      reservation_number?: string | null;
      duration_text?: string | null;
      additional_fields?: Array<{ 
        id: string;
        sectionTitle: string;
        fields: Array<{ title: string; value: string }>;
      }> | null;
      public_middle_sections?: string[] | null;
      public_right_sections?: string[] | null;
      public_hidden_middle_sections?: string[] | null;
      public_hidden_right_sections?: string[] | null;
      public_hidden_additional_sections?: string[] | null;
    } = {};

    if ("program_atrakcje" in body) {
      updateData.program_atrakcje = program_atrakcje ?? null;
    }
    if ("dodatkowe_swiadczenia" in body) {
      updateData.dodatkowe_swiadczenia = dodatkowe_swiadczenia ?? null;
    }
    if ("gallery_urls" in body) {
      if (Array.isArray(gallery_urls)) {
        updateData.gallery_urls = gallery_urls;
      } else if (gallery_urls === null || gallery_urls === undefined) {
        updateData.gallery_urls = [];
      }
    }
    if ("intro_text" in body) {
      updateData.intro_text = intro_text ?? null;
    }
    if ("section_poznaj_title" in body) {
      updateData.section_poznaj_title = section_poznaj_title ?? null;
    }
    if ("section_poznaj_description" in body) {
      updateData.section_poznaj_description = section_poznaj_description ?? null;
    }
    if ("trip_info_text" in body) {
      updateData.trip_info_text = trip_info_text ?? null;
    }
    if ("baggage_text" in body) {
      updateData.baggage_text = baggage_text ?? null;
    }
    if ("weather_text" in body) {
      updateData.weather_text = weather_text ?? null;
    }
    if ("show_trip_info_card" in body) {
      updateData.show_trip_info_card = show_trip_info_card ?? true;
    }
    if ("show_baggage_card" in body) {
      updateData.show_baggage_card = show_baggage_card ?? true;
    }
    if ("show_weather_card" in body) {
      updateData.show_weather_card = show_weather_card ?? true;
    }
    if ("show_seats_left" in body) {
      updateData.show_seats_left = show_seats_left ?? false;
    }
    if ("included_in_price_text" in body) {
      updateData.included_in_price_text = included_in_price_text ?? null;
    }
    if ("additional_costs_text" in body) {
      updateData.additional_costs_text = additional_costs_text ?? null;
    }
    if ("additional_service_text" in body) {
      updateData.additional_service_text = additional_service_text ?? null;
    }
    if ("reservation_number" in body) {
      updateData.reservation_number = reservation_number ?? null;
    }
    if ("duration_text" in body) {
      updateData.duration_text = duration_text ?? null;
    }
    if ("additional_fields" in body) {
      if (Array.isArray(additional_fields)) {
        updateData.additional_fields = additional_fields;
      } else if (additional_fields === null || additional_fields === undefined) {
        updateData.additional_fields = [];
      }
    }
    if ("public_middle_sections" in body) {
      updateData.public_middle_sections = public_middle_sections ?? null;
    }
    if ("public_right_sections" in body) {
      updateData.public_right_sections = public_right_sections ?? null;
    }
    if ("public_hidden_middle_sections" in body) {
      updateData.public_hidden_middle_sections = public_hidden_middle_sections ?? null;
    }
    if ("public_hidden_right_sections" in body) {
      updateData.public_hidden_right_sections = public_hidden_right_sections ?? null;
    }
    if ("public_hidden_additional_sections" in body) {
      updateData.public_hidden_additional_sections = public_hidden_additional_sections ?? null;
    }

    // Jeśli nie ma żadnych danych do aktualizacji, zwróć sukces
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase.from("trips").update(updateData).eq("id", id);

    if (error) {
      console.error("Error updating trip content:", error);
      
      // Jeśli błąd dotyczy nieistniejącej kolumny (PGRST204), spróbuj zaktualizować bez niej
      if (error.code === 'PGRST204' && error.message.includes('column')) {
        const columnMatch = error.message.match(/'([^']+)'/);
        const missingColumn = columnMatch?.[1];
        
        if (missingColumn && missingColumn in updateData) {
          console.warn(`Column '${missingColumn}' does not exist in database schema cache. Removing from update.`);
          const retryUpdateData = { ...updateData };
          delete retryUpdateData[missingColumn as keyof typeof retryUpdateData];
          
          // Spróbuj ponownie bez problematycznej kolumny
          if (Object.keys(retryUpdateData).length > 0) {
            const { error: retryError } = await supabase.from("trips").update(retryUpdateData).eq("id", id);
            if (retryError) {
              return NextResponse.json({ 
                error: "update_failed", 
                details: retryError.message,
                missing_column: missingColumn,
                message: `Column '${missingColumn}' does not exist in database. Please run migrations: supabase/013_trips_content_fields.sql and supabase/014_trips_content_texts.sql`
              }, { status: 500 });
            }
            return NextResponse.json({ 
              success: true, 
              warning: `Column '${missingColumn}' was skipped because it doesn't exist in the database. Please run migrations to add it.`
            });
          } else {
            return NextResponse.json({ 
              error: "update_failed", 
              details: `All columns are missing. Column '${missingColumn}' does not exist.`,
              missing_column: missingColumn,
              message: "Please run migrations: supabase/013_trips_content_fields.sql and supabase/014_trips_content_texts.sql"
            }, { status: 500 });
          }
        }
      }
      
      return NextResponse.json({ error: "update_failed", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in PATCH /api/trips/[id]/content:", err);
    return NextResponse.json({ error: "unexpected", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

