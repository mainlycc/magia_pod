import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PARTICIPANT_REPORT_TYPES,
  buildParticipantsReportPdf,
  buildReportTable,
  fetchParticipantsForReport,
  fetchTripReportData,
  participantsReportFilename,
} from "@/lib/reports/participants-report";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return profile?.role === "admin";
}

const bodySchema = z.object({
  reportType: z.enum(PARTICIPANT_REPORT_TYPES),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: tripId } = await context.params;

    const supabase = await createClient();
    if (!(await checkAdmin(supabase))) {
      return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
    }

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await request.json());
    } catch (err) {
      const msg =
        err instanceof z.ZodError ? err.issues.map((i) => i.message).join(" ") : "Niepoprawny JSON";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const admin = createAdminClient();

    const trip = await fetchTripReportData(admin, tripId);
    if (!trip) {
      return NextResponse.json({ error: "Nie znaleziono wycieczki" }, { status: 404 });
    }

    const participants = await fetchParticipantsForReport(admin, tripId);
    const table = buildReportTable(body.reportType, participants, trip);
    const tripTitle = trip.title ?? "Wycieczka";

    const buffer = buildParticipantsReportPdf({
      reportType: body.reportType,
      table,
      tripTitle,
    });

    const fname = participantsReportFilename(body.reportType, tripTitle);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fname}"`,
      },
    });
  } catch (e) {
    console.error("POST /api/trips/[id]/reports/participants", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd generowania raportu" },
      { status: 500 },
    );
  }
}
