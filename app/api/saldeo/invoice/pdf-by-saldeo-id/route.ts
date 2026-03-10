import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInvoicePdfUrl, type SaldeoConfig } from "@/lib/saldeo/client";

async function checkAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
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
    const saldeoInvoiceId = request.nextUrl.searchParams.get("saldeo_id");

    if (!saldeoInvoiceId) {
      return NextResponse.json(
        { success: false, error: "Brak parametru saldeo_id" },
        { status: 400 }
      );
    }

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
        { success: false, error: "Brak konfiguracji Saldeo API" },
        { status: 500 }
      );
    }

    // Support advance invoice type via query parameter
    const isAdvance = request.nextUrl.searchParams.get("is_advance") === "true";

    const result = await getInvoicePdfUrl(config, saldeoInvoiceId, isAdvance);

    return NextResponse.json({
      success: result.success,
      pdfUrl: result.pdfUrl || null,
      invoiceNumber: result.invoiceNumber || null,
      error: result.error || null,
      rawResponse: result.rawResponse || null,
    });
  } catch (error) {
    console.error("Error fetching invoice PDF by Saldeo ID:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Nieznany blad",
      },
      { status: 500 }
    );
  }
}
