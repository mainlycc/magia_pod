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

// Prosta funkcja szyfrowania (dla produkcji należy użyć bardziej zaawansowanego rozwiązania)
function encrypt(text: string | null | undefined): string | null {
  if (!text) return null;
  // W produkcji użyj biblioteki crypto lub vault
  // Na razie zwracamy tekst (można później dodać szyfrowanie)
  return text;
}

function decrypt(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  // W produkcji użyj biblioteki crypto lub vault
  return encrypted;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get("environment") || "test";

    const { data, error } = await supabase
      .from("insurance_config")
      .select("*")
      .eq("environment", environment)
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error fetching config:", error);
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Odszyfruj klucze API przed zwróceniem
    const decryptedData = {
      ...data,
      api_key: decrypt(data.api_key),
      api_secret: decrypt(data.api_secret),
    };

    return NextResponse.json(decryptedData);
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const {
      environment,
      api_key,
      api_secret,
      api_url,
      policy_parameters,
      is_active,
    } = body;

    if (!environment) {
      return NextResponse.json({ error: "missing_environment" }, { status: 400 });
    }

    // Sprawdź czy istnieje aktywna konfiguracja dla tego środowiska
    const { data: existingConfig } = await supabase
      .from("insurance_config")
      .select("id")
      .eq("environment", environment)
      .eq("is_active", true)
      .single();

    const configData: any = {
      environment,
      api_url: api_url || null,
      policy_parameters: policy_parameters || {},
      is_active: is_active !== undefined ? is_active : true,
    };

    // Zaszyfruj klucze API tylko jeśli zostały podane
    if (api_key !== undefined) {
      configData.api_key = encrypt(api_key);
    }
    if (api_secret !== undefined) {
      configData.api_secret = encrypt(api_secret);
    }

    let result;

    if (existingConfig) {
      // Aktualizuj istniejącą konfigurację
      const { data, error } = await supabase
        .from("insurance_config")
        .update(configData)
        .eq("id", existingConfig.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating config:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
      }

      result = data;
    } else {
      // Utwórz nową konfigurację
      const { data, error } = await supabase
        .from("insurance_config")
        .insert(configData)
        .select()
        .single();

      if (error) {
        console.error("Error creating config:", error);
        return NextResponse.json({ error: "create_failed" }, { status: 500 });
      }

      result = data;
    }

    // Zwróć odszyfrowane dane
    const decryptedResult = {
      ...result,
      api_key: decrypt(result.api_key),
      api_secret: decrypt(result.api_secret),
    };

    return NextResponse.json(decryptedResult);
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

