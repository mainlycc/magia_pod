import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchContractors, type SaldeoConfig } from "@/lib/saldeo/client";

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

    const config: SaldeoConfig = {
      username: process.env.SALDEO_USERNAME || "",
      apiToken: process.env.SALDEO_API_TOKEN || "",
      companyProgramId: process.env.SALDEO_COMPANY_PROGRAM_ID || "",
      apiUrl: process.env.SALDEO_API_URL || "https://saldeo.brainshare.pl",
    };

    if (!config.username || !config.apiToken || !config.companyProgramId) {
      return NextResponse.json(
        { error: "saldeo_config_missing", message: "Brak konfiguracji Saldeo" },
        { status: 500 }
      );
    }

    const result = await fetchContractors(config);

    return NextResponse.json({
      success: result.success,
      contractors: result.contractors,
      error: result.error || null,
    });
  } catch (error) {
    console.error("Error fetching contractors:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
