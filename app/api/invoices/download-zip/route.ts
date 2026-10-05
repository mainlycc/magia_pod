import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { getInvoicePdfBuffer } from "@/lib/invoices/get-invoice-pdf-buffer";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function uniqueZipFilename(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let i = 2;
  let candidate = `${stem}-${i}${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${stem}-${i}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

/**
 * Buduje ZIP z PDF-ami faktur.
 * Body: { trip_id: string, ids?: string[] }
 * — bez ids: wszystkie faktury wycieczki
 * — z ids: tylko wskazane (należące do wycieczki)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const tripId =
      typeof body?.trip_id === "string" ? body.trip_id.trim() : "";
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === "string")
      : null;

    if (!tripId) {
      return NextResponse.json({ error: "trip_id_required" }, { status: 400 });
    }

    if (ids && ids.length === 0) {
      return NextResponse.json(
        { error: "brak_zaznaczonych_faktur" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        fakturownia_invoice_id,
        pdf_url,
        pdf_storage_path,
        bookings!inner (
          trip_id
        )
      `
      )
      .eq("bookings.trip_id", tripId)
      .order("created_at", { ascending: false });

    if (ids) {
      query = query.in("id", ids);
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error("download-zip: fetch invoices error:", error);
      return NextResponse.json(
        { error: "Failed to fetch invoices", details: error.message },
        { status: 500 }
      );
    }

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ error: "brak_faktur" }, { status: 404 });
    }

    const zip = new JSZip();
    const usedNames = new Set<string>();
    let ok = 0;
    const failures: { id: string; invoice_number: string; error: string }[] =
      [];

    for (const invoice of invoices) {
      const result = await getInvoicePdfBuffer(supabase, invoice);
      if ("error" in result) {
        failures.push({
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          error: result.error,
        });
        continue;
      }
      const filename = uniqueZipFilename(result.filename, usedNames);
      zip.file(filename, result.buffer);
      ok += 1;
    }

    if (ok === 0) {
      return NextResponse.json(
        {
          error: "nie_udalo_sie_pobrac_pdf",
          failures,
        },
        { status: 422 }
      );
    }

    if (failures.length > 0) {
      zip.file(
        "_bledy_pobierania.json",
        JSON.stringify({ failures }, null, 2)
      );
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const safeTrip = tripId.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 36);
    const filename = `faktury-${safeTrip}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Invoices-Ok": String(ok),
        "X-Invoices-Failed": String(failures.length),
      },
    });
  } catch (error) {
    console.error("POST /api/invoices/download-zip error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
