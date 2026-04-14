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

    if (!config.apiToken || !config.subdomain) {
      return NextResponse.json(
        { error: "fakturownia_config_missing", message: "Brak konfiguracji Fakturownia (FAKTUROWNIA_API_TOKEN, FAKTUROWNIA_SUBDOMAIN)" },
        { status: 500 }
      );
    }

    const result = await fetchClients(config);

    return NextResponse.json({
      success: result.success,
      clients: result.clients,
      error: result.error || null,
    });
  } catch (error) {
    console.error("Error fetching Fakturownia clients:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
