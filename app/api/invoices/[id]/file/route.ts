import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInvoicePdfBuffer } from "@/lib/invoices/get-invoice-pdf-buffer";

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, fakturownia_invoice_id, pdf_url, pdf_storage_path")
      .eq("id", id)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
    }

    const result = await getInvoicePdfBuffer(supabase, invoice);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/invoices/[id]/file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
