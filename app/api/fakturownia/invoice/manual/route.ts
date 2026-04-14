import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createInvoice,
  type FakturowniaConfig,
  type FakturowniaInvoiceData,
  type FakturowniaInvoiceItem,
} from "@/lib/fakturownia/client";

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json();

    const {
      kind,
      number,
      issue_date,
      sell_date,
      payment_to,
      payment_type,
      currency,
      use_gross,
      buyer_name,
      buyer_tax_no,
      buyer_street,
      buyer_city,
      buyer_post_code,
      buyer_email,
      margin_procedure,
      margin_kind,
      positions,
      description,
    } = body;

    // Walidacja wymaganych pól
    if (!number || !issue_date || !sell_date || !buyer_name || !payment_type || !currency) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Brak wymaganych pól: number, issue_date, sell_date, buyer_name, payment_type, currency",
        },
        { status: 400 }
      );
    }

    if (!positions || !Array.isArray(positions) || positions.length === 0) {
      return NextResponse.json(
        { error: "validation_error", message: "Wymagana co najmniej jedna pozycja (positions)" },
        { status: 400 }
      );
    }

    for (let i = 0; i < positions.length; i++) {
      const item = positions[i];
      if (!item.name || item.quantity === undefined || !item.unit || item.unit_price === undefined) {
        return NextResponse.json(
          {
            error: "validation_error",
            message: `Pozycja ${i + 1} - wymagane pola: name, quantity, unit, unit_price`,
          },
          { status: 400 }
        );
      }
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

    const invoiceItems: FakturowniaInvoiceItem[] = positions.map((item: any) => ({
      name: String(item.name),
      quantity: Number(item.quantity),
      unit: String(item.unit),
      unit_price: Number(item.unit_price),
      tax: item.tax ? String(item.tax) : "np",
    }));

    const invoiceData: FakturowniaInvoiceData = {
      kind: kind || "advance",
      number: String(number),
      issue_date: String(issue_date),
      sell_date: String(sell_date),
      payment_to: payment_to ? String(payment_to) : undefined,
      payment_type: String(payment_type),
      currency: String(currency),
      use_gross: Boolean(use_gross),
      buyer_name: String(buyer_name),
      buyer_tax_no: buyer_tax_no ? String(buyer_tax_no) : undefined,
      buyer_street: buyer_street ? String(buyer_street) : undefined,
      buyer_city: buyer_city ? String(buyer_city) : undefined,
      buyer_post_code: buyer_post_code ? String(buyer_post_code) : undefined,
      buyer_email: buyer_email ? String(buyer_email) : undefined,
      margin_procedure: Boolean(margin_procedure),
      margin_kind: margin_kind ? String(margin_kind) : undefined,
      positions: invoiceItems,
      description: description ? String(description) : undefined,
    };

    console.log("[Invoice Manual] Sending to Fakturownia:", {
      kind: invoiceData.kind,
      number: invoiceData.number,
      buyer: invoiceData.buyer_name,
      positions: invoiceItems.length,
    });

    const result = await createInvoice(config, invoiceData);

    console.log("[Invoice Manual] Fakturownia response:", {
      success: result.success,
      invoiceId: result.invoiceId,
      invoiceNumber: result.invoiceNumber,
      error: result.error,
    });

    return NextResponse.json({
      success: result.success,
      invoiceId: result.invoiceId || null,
      invoiceNumber: result.invoiceNumber || null,
      pdfUrl: result.pdfUrl || null,
      viewUrl: result.viewUrl || null,
      error: result.error || null,
    });
  } catch (error) {
    console.error("Error in POST /api/fakturownia/invoice/manual:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
