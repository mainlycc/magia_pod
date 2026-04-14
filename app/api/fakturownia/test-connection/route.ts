import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchClients, type FakturowniaConfig } from "@/lib/fakturownia/client";

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

export async function GET() {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const config: FakturowniaConfig = {
      apiToken: process.env.FAKTUROWNIA_API_TOKEN || "",
      subdomain: process.env.FAKTUROWNIA_SUBDOMAIN || "",
    };

    const missingConfig: string[] = [];
    if (!config.apiToken) missingConfig.push("FAKTUROWNIA_API_TOKEN");
    if (!config.subdomain) missingConfig.push("FAKTUROWNIA_SUBDOMAIN");

    if (missingConfig.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Brak konfiguracji",
        missing: missingConfig,
        message: `Brakujące zmienne środowiskowe: ${missingConfig.join(", ")}`,
      });
    }

    const baseUrl = `https://${config.subdomain}.fakturownia.pl`;

    // Test 1: Podstawowy test połączenia sieciowego
    let networkTest = { success: false, error: "" };
    try {
      const testResponse = await fetch(baseUrl, { method: "HEAD" });
      networkTest = { success: testResponse.ok || testResponse.status < 500, error: "" };
    } catch (err) {
      networkTest = {
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }

    // Test 2: Test autoryzacji przez pobranie listy klientów
    let apiTest = { success: false, clientsCount: 0, error: "" };
    try {
      const result = await fetchClients(config);
      apiTest = {
        success: result.success,
        clientsCount: result.clients.length,
        error: result.error || "",
      };
    } catch (err) {
      apiTest = {
        success: false,
        clientsCount: 0,
        error: err instanceof Error ? err.message : "API test failed",
      };
    }

    return NextResponse.json({
      success: networkTest.success && apiTest.success,
      config: {
        subdomain: config.subdomain,
        apiUrl: baseUrl,
        apiTokenLength: config.apiToken.length,
        apiTokenFirst4: config.apiToken.substring(0, 4) + "...",
      },
      tests: {
        network: networkTest,
        api: apiTest,
      },
      recommendations: [
        !networkTest.success
          ? "Nie można połączyć się z Fakturownia. Sprawdź subdomenę i połączenie."
          : "Połączenie sieciowe działa",
        !apiTest.success
          ? "Błąd autoryzacji. Sprawdź FAKTUROWNIA_API_TOKEN i FAKTUROWNIA_SUBDOMAIN."
          : `Autoryzacja działa. Znaleziono ${apiTest.clientsCount} klientów.`,
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
