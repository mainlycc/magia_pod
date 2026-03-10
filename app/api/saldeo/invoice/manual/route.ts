import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createSaldeoInvoice,
  type SaldeoConfig,
  type SaldeoInvoiceData,
  type SaldeoInvoiceItem,
} from "@/lib/saldeo/client";

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

    // Walidacja wymaganych pol
    const {
      NUMBER,
      issueDate,
      saleDate,
      purchaserContractorId,
      currencyIso4217,
      paymentType,
      dueDate,
      calculatedFromGross,
      issuePerson,
      items,
    } = body;

    if (!NUMBER || !issueDate || !saleDate || !purchaserContractorId || !currencyIso4217 || !paymentType) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Brak wymaganych pol: NUMBER, issueDate, saleDate, purchaserContractorId, currencyIso4217, paymentType",
        },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "validation_error", message: "Wymagana co najmniej jedna pozycja na fakturze (items)" },
        { status: 400 }
      );
    }

    // Walidacja pozycji
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name || !item.amount || !item.unit || item.unitValue === undefined) {
        return NextResponse.json(
          {
            error: "validation_error",
            message: "Pozycja " + (i + 1) + " - wymagane pola: name, amount, unit, unitValue",
          },
          { status: 400 }
        );
      }
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

    const invoiceItems: SaldeoInvoiceItem[] = items.map((item: any) => ({
      name: String(item.name),
      amount: Number(item.amount),
      unit: String(item.unit),
      unitValue: Number(item.unitValue),
      rate: item.rate ? String(item.rate) : undefined,
    }));

    const invoiceData: SaldeoInvoiceData = {
      NUMBER: String(NUMBER),
      issueDate: String(issueDate),
      saleDate: String(saleDate),
      purchaserContractorId: Number(purchaserContractorId),
      currencyIso4217: String(currencyIso4217),
      paymentType: String(paymentType),
      dueDate: dueDate ? String(dueDate) : undefined,
      accordingToAgreement: !dueDate,
      calculatedFromGross: Boolean(calculatedFromGross),
      issuePerson: issuePerson ? String(issuePerson) : undefined,
      items: invoiceItems,
    };

    console.log("[Invoice Manual] Sending to Saldeo:", JSON.stringify(invoiceData, null, 2));

    const result = await createSaldeoInvoice(config, invoiceData);

    console.log("[Invoice Manual] Saldeo response:", {
      success: result.success,
      invoiceId: result.invoiceId,
      error: result.error,
      rawLen: result.rawResponse?.length,
      rawPreview: result.rawResponse?.substring(0, 500),
    });

    return NextResponse.json({
      success: result.success,
      invoiceId: result.invoiceId || null,
      error: result.error || null,
      rawResponse: result.rawResponse || null,
    });
  } catch (error) {
    console.error("Error in POST /api/saldeo/invoice/manual:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
