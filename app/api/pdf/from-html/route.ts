import { NextRequest, NextResponse } from "next/server";
import { generatePdfFromHtml } from "@/lib/pdf-generator";

export const runtime = "nodejs";
export const maxDuration = 30;

// Re-eksportuj funkcję dla kompatybilności
export { generatePdfFromHtml };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { html, filename = "umowa.pdf" } = body as { html: string; filename?: string };

    if (!html) {
      return NextResponse.json({ error: "HTML is required" }, { status: 400 });
    }

    const result = await generatePdfFromHtml(html, filename);
    return NextResponse.json(result);
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      {
        error: "PDF generation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
