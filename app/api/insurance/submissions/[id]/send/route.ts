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

function decrypt(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  // W produkcji użyj biblioteki crypto lub vault
  return encrypted;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { id } = await context.params;

    // Pobierz zgłoszenie z uczestnikami
    const { data: submission, error: submissionError } = await supabase
      .from("insurance_submissions")
      .select(
        `
        id,
        trip_id,
        participants_count,
        trips:trips!inner(id, title, start_date, end_date)
        `
      )
      .eq("id", id)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
    }

    // Pobierz uczestników zgłoszenia
    const { data: submissionParticipants, error: participantsError } = await supabase
      .from("insurance_submission_participants")
      .select(
        `
        participants:participants!inner(
          id,
          first_name,
          last_name,
          pesel,
          email,
          phone,
          document_type,
          document_number,
          address
        )
        `
      )
      .eq("submission_id", id);

    if (participantsError || !submissionParticipants || submissionParticipants.length === 0) {
      return NextResponse.json({ error: "participants_not_found" }, { status: 404 });
    }

    // Pobierz konfigurację API (domyślnie test)
    const { data: config, error: configError } = await supabase
      .from("insurance_config")
      .select("*")
      .eq("is_active", true)
      .eq("environment", "test")
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: "config_not_found", message: "Brak skonfigurowanego API" },
        { status: 400 }
      );
    }

    if (!config.api_url) {
      return NextResponse.json(
        { error: "api_url_not_set", message: "Brak URL API w konfiguracji" },
        { status: 400 }
      );
    }

    // Przygotuj uczestników do wysłania
    const participants = submissionParticipants.map((sp: any) => {
      const p = sp.participants;
      return {
        first_name: p.first_name,
        last_name: p.last_name,
        pesel: p.pesel || null,
        email: p.email || null,
        phone: p.phone || null,
        document_type: p.document_type || null,
        document_number: p.document_number || null,
        address: p.address || null,
      };
    });

    // Przygotuj payload do wysłania do API HDI
    const trips = Array.isArray(submission.trips) && submission.trips.length > 0 
      ? submission.trips[0] 
      : null;

    const payload = {
      trip: {
        id: trips?.id,
        title: trips?.title,
        start_date: trips?.start_date,
        end_date: trips?.end_date,
      },
      participants_count: submission.participants_count,
      participants,
      policy_parameters: config.policy_parameters || {},
    };

    // Zapisz payload przed wysłaniem
    await supabase
      .from("insurance_submissions")
      .update({
        api_payload: payload,
        status: "sent",
      })
      .eq("id", id);

    // Wywołaj API HDI
    const apiKey = decrypt(config.api_key);
    const apiSecret = decrypt(config.api_secret);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Jeśli API wymaga innej autoryzacji, można dodać tutaj
    // Na przykład: headers["X-API-Key"] = apiKey;

    let apiResponse: any;
    let apiError: any;

    try {
      const response = await fetch(config.api_url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (response.ok) {
        apiResponse = responseData;
        // Aktualizuj status na "accepted" jeśli odpowiedź wskazuje na sukces
        // Można dostosować logikę w zależności od odpowiedzi API
        const updateData: any = {
          api_response: responseData,
          status: "accepted",
        };

        // Jeśli odpowiedź zawiera numer polisy
        if (responseData.policy_number) {
          updateData.policy_number = responseData.policy_number;
        }

        await supabase
          .from("insurance_submissions")
          .update(updateData)
          .eq("id", id);

        return NextResponse.json({
          success: true,
          message: "Zgłoszenie zostało wysłane pomyślnie",
          response: responseData,
        });
      } else {
        // Błąd z API
        apiError = {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
        };

        await supabase
          .from("insurance_submissions")
          .update({
            api_response: responseData,
            status: "error",
            error_message: responseData.message || responseData.error || `HTTP ${response.status}: ${response.statusText}`,
          })
          .eq("id", id);

        return NextResponse.json(
          {
            success: false,
            error: "api_error",
            message: responseData.message || responseData.error || "Błąd podczas wysyłania do API",
            response: responseData,
          },
          { status: 400 }
        );
      }
    } catch (fetchError: any) {
      // Błąd sieciowy lub inny błąd
      apiError = {
        error: fetchError.message,
        type: fetchError.name,
      };

      await supabase
        .from("insurance_submissions")
        .update({
          status: "error",
          error_message: `Błąd połączenia: ${fetchError.message}`,
          api_response: null,
        })
        .eq("id", id);

      return NextResponse.json(
        {
          success: false,
          error: "network_error",
          message: `Błąd połączenia z API: ${fetchError.message}`,
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "unexpected", message: err.message || "Nieoczekiwany błąd" },
      { status: 500 }
    );
  }
}

