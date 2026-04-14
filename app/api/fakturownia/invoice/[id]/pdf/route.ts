import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildInvoicePdfUrl, type FakturowniaConfig } from "@/lib/fakturownia/client";

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

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, fakturownia_invoice_id, pdf_url, invoice_type")
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

    // Jeśli nie ma fakturownia_invoice_id, nie możemy pobrać PDF
    if (!invoice.fakturownia_invoice_id) {
      return NextResponse.json({
        success: false,
        error: "Faktura nie została jeszcze wysłana do Fakturownia",
      });
    }

    const config: FakturowniaConfig = {
      apiToken: process.env.FAKTUROWNIA_API_TOKEN || "",
      subdomain: process.env.FAKTUROWNIA_SUBDOMAIN || "",
    };

    if (!config.apiToken || !config.subdomain) {
      return NextResponse.json({
        success: false,
        error: "Brak konfiguracji Fakturownia API",
      }, { status: 500 });
    }

    // Zbuduj bezpośredni URL do PDF
    const pdfUrl = buildInvoicePdfUrl(config, invoice.fakturownia_invoice_id);

    // Zapisz URL w bazie danych
    await supabase
      .from("invoices")
      .update({ pdf_url: pdfUrl })
      .eq("id", invoiceId);

    return NextResponse.json({
      success: true,
      pdfUrl,
    });
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
