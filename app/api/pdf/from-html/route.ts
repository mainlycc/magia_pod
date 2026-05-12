import { NextRequest, NextResponse } from "next/server";
import { generatePdfFromHtml } from "@/lib/pdf-generator";
import { embedNotoSansIntoHtml } from "@/lib/pdf/embed-noto-fonts-into-html";

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

    const withFonts = embedNotoSansIntoHtml(html);
    console.log("[/api/pdf/from-html] embedNotoSansIntoHtml:", withFonts.embedded ? "ok" : "missing");
    const result = await generatePdfFromHtml(withFonts.html, filename);
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
