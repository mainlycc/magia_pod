import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  aggregateSummary,
  buildPdfBuffer,
  buildXlsxBuffer,
  fetchCancellationRows,
  fetchSignedAgreementRows,
  type TfgReportType,
  reportFilename,
  resolvePeriodBounds,
} from "@/lib/reports/tfg-agreement-report";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();

  return profile?.role === "admin";
}

const reportTypeSchema = z.enum([
  "tfg_signed_detail",
  "tfg_signed_summary",
  "tfg_cancellations_detail",
  "tfg_cancellations_summary",
]);

const bodySchema = z
  .object({
    reportType: reportTypeSchema,
    period: z.enum(["month", "range"]),
    year: z.number().int().min(2000).max(2100).optional(),
    month: z.number().int().min(1).max(12).optional(),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    format: z.enum(["xlsx", "pdf"]),
  })
  .superRefine((data, ctx) => {
    if (data.period === "month") {
      if (data.year === undefined || data.month === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Dla okresu „miesiąc” wymagane są pola year i month.",
        });
      }
    } else {
      if (!data.dateFrom || !data.dateTo) {
        ctx.addIssue({
          code: "custom",
          message: "Dla zakresu dat wymagane są dateFrom i dateTo (RRRR-MM-DD).",
        });
      } else if (data.dateFrom > data.dateTo) {
        ctx.addIssue({
          code: "custom",
          message: "Data „od” nie może być późniejsza niż data „do”.",
        });
      }
    }
  });

const TITLES: Record<TfgReportType, string> = {
  tfg_signed_detail: "Składki TFG – wykaz zawartych umów (szczegółowy)",
  tfg_signed_summary: "Składki TFG – podsumowanie zawartych umów",
  tfg_cancellations_detail: "Składki TFG – rezygnacje (szczegółowy)",
  tfg_cancellations_summary: "Składki TFG – rezygnacje (podsumowanie)",
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!(await checkAdmin(supabase))) {
      return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
    }

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await request.json());
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues.map((i) => i.message).join(" ") : "Niepoprawny JSON";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { startIso, endIso } = resolvePeriodBounds(body.period, {
      year: body.year,
      month: body.month,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
    });

    const periodLabel =
      body.period === "month"
        ? `${body.year}-${String(body.month).padStart(2, "0")}`
        : `${body.dateFrom}_${body.dateTo}`;

    const admin = createAdminClient();

    let detailRows: string[][] = [];
    let summaryInputs: { category: string; participants: number; valuePln: number }[] = [];

    switch (body.reportType) {
      case "tfg_signed_detail": {
        const r = await fetchSignedAgreementRows(admin, startIso, endIso);
        detailRows = r.detail;
        break;
      }
      case "tfg_signed_summary": {
        const r = await fetchSignedAgreementRows(admin, startIso, endIso);
        summaryInputs = r.summaryInputs;
        break;
      }
      case "tfg_cancellations_detail": {
        const r = await fetchCancellationRows(admin, startIso, endIso);
        detailRows = r.detail;
        break;
      }
      case "tfg_cancellations_summary": {
        const r = await fetchCancellationRows(admin, startIso, endIso);
        summaryInputs = r.summaryInputs;
        break;
      }
      default:
        break;
    }

    const isSummary =
      body.reportType === "tfg_signed_summary" || body.reportType === "tfg_cancellations_summary";
    const summaryRows = isSummary ? aggregateSummary(summaryInputs) : [];

    const reportTitle = `${TITLES[body.reportType]} (${periodLabel})`;

    let buffer: Buffer;
    if (body.format === "xlsx") {
      buffer = await buildXlsxBuffer({
        reportType: body.reportType,
        detailRows,
        summaryRows,
      });
    } else {
      buffer = buildPdfBuffer({
        reportTitle,
        detailRows,
        summaryRows,
        isSummaryOnly: isSummary,
      });
    }

    const fname = reportFilename(body.reportType, body.format, periodLabel);
    const contentType =
      body.format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fname}"`,
      },
    });
  } catch (e) {
    console.error("POST /api/admin/reports/tfg-agreements", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd generowania raportu" },
      { status: 500 },
    );
  }
}
