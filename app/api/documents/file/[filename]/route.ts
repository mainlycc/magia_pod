import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await context.params;

    // Walidacja nazwy pliku - tylko PDF
    if (!filename || !filename.endsWith(".pdf")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Pobierz plik z Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from("documents")
      .download(filename);

    if (error || !data) {
      console.error("Failed to download document:", error);
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Konwertuj Blob na ArrayBuffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Zwróć PDF jako response
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/documents/file/[filename] error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

