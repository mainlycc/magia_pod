import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTrip } from "@/lib/trips/can-manage-trip";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const allowed = await canManageTrip(supabase, id);
    if (!allowed) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Po autoryzacji: odczyt przez service role — RLS dla zwykłego usera pozwala tylko na
    // publiczne+aktywne wycieczki; koordynator musi widzieć także szkice / niepubliczne.
    const admin = createAdminClient();
    // `*` — działa nawet gdy część kolumn (np. reservation_success_*) nie została jeszcze dodana migracją 052;
    // jawna lista kolumn powodowała PGRST204 przy braku którejkolwiek w schemacie.
    const { data: trip, error } = await admin.from("trips").select("*").eq("id", id).single();

    if (error || !trip) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const row = trip as Record<string, unknown>;

    return NextResponse.json({
      program_atrakcje: row.program_atrakcje || "",
      dodatkowe_swiadczenia: row.dodatkowe_swiadczenia || "",
      gallery_urls: row.gallery_urls || [],
      intro_text: row.intro_text || "",
      section_poznaj_title: row.section_poznaj_title || "",
      section_poznaj_description: row.section_poznaj_description || "",
      reservation_info_text: row.reservation_info_text || "",
      reservation_success_message: row.reservation_success_message || "",
      trip_info_text: row.trip_info_text || "",
      baggage_text: row.baggage_text || "",
      weather_text: row.weather_text || "",
      show_trip_info_card: row.show_trip_info_card ?? true,
      show_baggage_card: row.show_baggage_card ?? true,
      show_weather_card: row.show_weather_card ?? true,
      show_seats_left: row.show_seats_left ?? false,
      included_in_price_text: row.included_in_price_text || "",
      additional_costs_text: row.additional_costs_text || "",
      additional_service_text: row.additional_service_text || "",
      reservation_number: row.reservation_number || "",
      duration_text: row.duration_text || "",
      agreement_room_type: row.agreement_room_type || "",
      agreement_meals_info: row.agreement_meals_info || "",
      agreement_transfer_info: row.agreement_transfer_info || "",
      additional_fields: row.additional_fields || [],
      public_middle_sections: row.public_middle_sections || null,
      public_right_sections: row.public_right_sections || null,
      public_hidden_middle_sections: row.public_hidden_middle_sections || null,
      public_hidden_right_sections: row.public_hidden_right_sections || null,
      public_hidden_additional_sections: row.public_hidden_additional_sections || null,
    });
  } catch {
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const allowed = await canManageTrip(supabase, id);
    if (!allowed) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const admin = createAdminClient();

    const body = await request.json();
    const { 
      program_atrakcje, 
      dodatkowe_swiadczenia, 
      gallery_urls,
      intro_text,
      section_poznaj_title,
      section_poznaj_description,
      reservation_info_text,
      reservation_success_message,
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
      agreement_room_type,
      agreement_meals_info,
      agreement_transfer_info,
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
      reservation_info_text?: string;
      reservation_success_message?: string;
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
      agreement_room_type?: string;
      agreement_meals_info?: string;
      agreement_transfer_info?: string;
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
      reservation_info_text?: string | null;
      reservation_success_message?: string | null;
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
      agreement_room_type?: string | null;
      agreement_meals_info?: string | null;
      agreement_transfer_info?: string | null;
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
    if ("reservation_info_text" in body) {
      updateData.reservation_info_text = reservation_info_text ?? null;
    }
    if ("reservation_success_message" in body) {
      updateData.reservation_success_message = reservation_success_message ?? null;
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
    if ("agreement_room_type" in body) {
      updateData.agreement_room_type = agreement_room_type ?? null;
    }
    if ("agreement_meals_info" in body) {
      updateData.agreement_meals_info = agreement_meals_info ?? null;
    }
    if ("agreement_transfer_info" in body) {
      updateData.agreement_transfer_info = agreement_transfer_info ?? null;
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

    // Pętla: przy braku kolumn w DB PostgREST zwraca PGRST204 dla każdej z osobna —
    // jeden retry nie wystarcza (np. brak reservation_success_message).
    let payload: Record<string, unknown> = { ...updateData };
    const skippedColumns: string[] = [];
    let attempts = 0;
    const maxSchemaRetries = 48;

    for (;;) {
      if (++attempts > maxSchemaRetries) {
        return NextResponse.json(
          { error: "update_failed", details: "Zbyt wiele brakujących kolumn w schemacie — sprawdź migracje SQL." },
          { status: 500 },
        );
      }
      if (Object.keys(payload).length === 0) {
        return NextResponse.json({
          success: true,
          warning:
            skippedColumns.length > 0
              ? `W bazie brakuje kolumn: ${skippedColumns.join(", ")}. Wykonaj migrację SQL: supabase/052_trips_reservation_success_message.sql (Supabase → SQL Editor). Pozostałe pola zapisano.`
              : undefined,
          skipped_columns: skippedColumns.length > 0 ? skippedColumns : undefined,
        });
      }

      const { error } = await admin.from("trips").update(payload as never).eq("id", id);

      if (!error) {
        return NextResponse.json({
          success: true,
          ...(skippedColumns.length > 0 && {
            warning: `Część pól nie została zapisana — brak kolumn w bazie: ${skippedColumns.join(", ")}. Uruchom migrację supabase/052_trips_reservation_success_message.sql.`,
            skipped_columns: skippedColumns,
          }),
        });
      }

      if (error.code === "PGRST204" && error.message.includes("column")) {
        const columnMatch = error.message.match(/'([^']+)'/);
        const missingColumn = columnMatch?.[1];
        if (missingColumn && missingColumn in payload) {
          console.warn(
            `[PATCH trip content] Kolumna '${missingColumn}' nie istnieje w cache schematu — pomijam.`,
          );
          delete payload[missingColumn];
          skippedColumns.push(missingColumn);
          continue;
        }
      }

      console.error("Error updating trip content:", error);
      return NextResponse.json({ error: "update_failed", details: error.message }, { status: 500 });
    }
  } catch (err) {
    console.error("Error in PATCH /api/trips/[id]/content:", err);
    return NextResponse.json({ error: "unexpected", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

