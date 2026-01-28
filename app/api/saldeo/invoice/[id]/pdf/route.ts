import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInvoicePdfUrl, type SaldeoConfig } from "@/lib/saldeo/client";

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;

    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Pobierz fakturę z bazy danych
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, saldeo_invoice_id, pdf_url")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
    }

    // Jeśli już mamy URL do PDF w bazie, zwróć go
    if (invoice.pdf_url) {
      return NextResponse.json({
        success: true,
        pdfUrl: invoice.pdf_url,
      });
    }

    // Jeśli nie ma saldeo_invoice_id, nie możemy pobrać PDF
    if (!invoice.saldeo_invoice_id) {
      return NextResponse.json({
        success: false,
        error: "Faktura nie została jeszcze wysłana do Saldeo",
      });
    }

    // Pobierz konfigurację Saldeo z env
    const config: SaldeoConfig = {
      username: process.env.SALDEO_USERNAME || "",
      apiToken: process.env.SALDEO_API_TOKEN || "",
      companyProgramId: process.env.SALDEO_COMPANY_PROGRAM_ID || "",
      apiUrl: process.env.SALDEO_API_URL || "https://api.saldeosmart.pl",
    };

    // Sprawdź czy konfiguracja jest kompletna
    if (!config.username || !config.apiToken || !config.companyProgramId) {
      return NextResponse.json({
        success: false,
        error: "Brak konfiguracji Saldeo API",
      }, { status: 500 });
    }

    // Pobierz URL do PDF z Saldeo
    const result = await getInvoicePdfUrl(config, invoice.saldeo_invoice_id);

    if (result.success && result.pdfUrl) {
      // Zapisz URL w bazie danych dla przyszłości
      await supabase
        .from("invoices")
        .update({ pdf_url: result.pdfUrl })
        .eq("id", invoiceId);

      return NextResponse.json({
        success: true,
        pdfUrl: result.pdfUrl,
        invoiceNumber: result.invoiceNumber,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || "Nie udało się pobrać URL do PDF",
        rawResponse: result.rawResponse,
      });
    }
  } catch (error) {
    console.error("Error fetching invoice PDF URL:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Nieznany błąd",
      },
      { status: 500 }
    );
  }
}
