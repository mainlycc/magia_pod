import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

function buildCandidateFilenames(raw: string): string[] {
  const out: string[] = [];

  const push = (v: string) => {
    const s = v.trim();
    if (!s) return;
    if (!s.toLowerCase().endsWith(".pdf")) return;
    if (!out.includes(s)) out.push(s);
  };

  push(raw);

  // Jeśli ktoś przekaże zakodowaną wartość (np. %23100126%2F002.pdf)
  try {
    push(decodeURIComponent(raw));
  } catch {
    // ignore
  }

  const normalized = raw.trim();
  const withoutHashes = normalized.replace(/^#+/, "");
  push(withoutHashes);

  // Legacy: "#100126/002.pdf" lub "100126/002.pdf" -> "100126-002.pdf"
  const legacyMatch = withoutHashes.match(/^(\d{1,})\/(\d{1,})\.pdf$/);
  if (legacyMatch) {
    const reservation = legacyMatch[1].padStart(6, "0");
    const seq = legacyMatch[2].padStart(3, "0");
    push(`${reservation}-${seq}.pdf`);
    push(`${reservation}/${seq}.pdf`);
    push(`${reservation}_${seq}.pdf`);
  }

  // Ogólnie: usuń '#' i zamień '/' na '-' jako fallback.
  push(withoutHashes.replaceAll("/", "-"));

  return out;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename: rawFilename } = await context.params;

    // Walidacja nazwy pliku - tylko PDF
    if (!rawFilename || !rawFilename.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const candidates = buildCandidateFilenames(rawFilename);
    let data: Blob | null = null;
    let lastError: unknown = null;
    let resolvedFilename: string | null = null;

    for (const f of candidates) {
      const res = await supabaseAdmin.storage.from("agreements").download(f);
      if (res.data) {
        data = res.data;
        resolvedFilename = f;
        break;
      }
      lastError = res.error ?? lastError;
    }

    if (!data) {
      console.error("Failed to download agreement:", lastError, { candidates });
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    // Konwertuj Blob na ArrayBuffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Zwróć PDF jako response
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${resolvedFilename ?? rawFilename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/agreements/[filename] error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

