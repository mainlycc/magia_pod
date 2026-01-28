import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateRequestSignature, compressAndEncodeXML } from "@/lib/saldeo/client";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin";
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Pobierz konfigurację z env
    const config = {
      username: process.env.SALDEO_USERNAME || "",
      apiToken: process.env.SALDEO_API_TOKEN || "",
      companyProgramId: process.env.SALDEO_COMPANY_PROGRAM_ID || "",
      apiUrl: process.env.SALDEO_API_URL || "",
    };

    // Sprawdź czy wszystkie dane są wypełnione
    const missingConfig = [];
    if (!config.username) missingConfig.push("SALDEO_USERNAME");
    if (!config.apiToken) missingConfig.push("SALDEO_API_TOKEN");
    if (!config.companyProgramId) missingConfig.push("SALDEO_COMPANY_PROGRAM_ID");
    if (!config.apiUrl) missingConfig.push("SALDEO_API_URL");

    if (missingConfig.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Brak konfiguracji",
        missing: missingConfig,
        message: `Brakujące zmienne środowiskowe: ${missingConfig.join(", ")}`,
      });
    }

    // Test 1: Podstawowy test połączenia
    let networkTest = { success: false, error: "" };
    try {
      const testResponse = await fetch(config.apiUrl, { method: "HEAD" });
      networkTest = { success: true, error: "" };
    } catch (err) {
      networkTest = {
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }

    // Test 2: Test prostego zapytania API (company.list)
    let apiTest = { success: false, response: "", error: "" };
    try {
      // Przygotuj minimalne XML dla testu
      const xml = `<?xml version="1.0" encoding="UTF-8"?><REQUEST></REQUEST>`;
      const command = await compressAndEncodeXML(xml);

      const reqId = `test-${Date.now()}`;
      const reqSig = generateRequestSignature(
        reqId,
        config.username,
        config.companyProgramId,
        command,
        config.apiToken
      );

      const body = new URLSearchParams({
        username: config.username,
        req_id: reqId,
        req_sig: reqSig,
        company_program_id: config.companyProgramId,
      });

      const response = await fetch(`${config.apiUrl}/api/xml/1.0/company/list`, {
        method: "GET",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const responseText = await response.text();

      apiTest = {
        success: response.ok,
        response: responseText.substring(0, 500), // Pierwsze 500 znaków
        error: response.ok ? "" : `HTTP ${response.status}`,
      };
    } catch (err) {
      apiTest = {
        success: false,
        response: "",
        error: err instanceof Error ? err.message : "API test failed",
      };
    }

    // Zwróć wyniki diagnostyki
    return NextResponse.json({
      success: networkTest.success && apiTest.success,
      config: {
        username: config.username,
        apiUrl: config.apiUrl,
        companyProgramId: config.companyProgramId,
        apiTokenLength: config.apiToken.length,
        apiTokenFirst4: config.apiToken.substring(0, 4) + "...",
      },
      tests: {
        network: networkTest,
        api: apiTest,
      },
      recommendations: [
        !networkTest.success
          ? "❌ Nie można połączyć się z API. Sprawdź URL i połączenie internetowe."
          : "✅ Połączenie sieciowe działa",
        apiTest.response.includes("User does not exist")
          ? "❌ Błąd autoryzacji. Sprawdź username, token i company_program_id."
          : apiTest.response.includes("ERROR")
          ? "⚠️ API zwraca błąd. Zobacz szczegóły w 'tests.api.response'"
          : apiTest.success
          ? "✅ API odpowiada poprawnie"
          : "❌ API nie odpowiada",
        config.apiUrl.includes("test")
          ? "ℹ️ Używasz środowiska TESTOWEGO"
          : "ℹ️ Używasz środowiska PRODUKCYJNEGO",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
