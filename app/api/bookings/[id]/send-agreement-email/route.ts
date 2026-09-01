import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  generateAgreementUpdatedEmailHtml,
  generateAgreementUpdatedEmailText,
} from "@/lib/email/templates/agreement-updated";
import {
  buildAgreementUpdatedEmailSubject,
  formatUpdatedAgreementPdfFilename,
} from "@/lib/email/agreement-updated-data";
import { resolveContactNames } from "@/lib/email/booking-confirmation-data";
import { resolvePublicAgreementNumberForBooking } from "@/lib/email/payment-reminder-data";

export const runtime = "nodejs";
export const maxDuration = 30;

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

async function checkCoordinator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, allowed_trip_ids")
    .eq("id", userId)
    .single();

  if (profile?.role !== "coordinator") return false;
  if (!profile.allowed_trip_ids) return false;

  return profile.allowed_trip_ids.includes(tripId);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: bookingId } = await context.params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      const { data: bookingRow } = await supabase.from("bookings").select("trip_id").eq("id", bookingId).single();

      if (!bookingRow) {
        return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
      }

      const isCoordinator = await checkCoordinator(supabase, bookingRow.trip_id);
      if (!isCoordinator) {
        return NextResponse.json({ error: "unauthorized" }, { status: 403 });
      }
    }

    let preferredPdfUrl: string | null = null;
    try {
      const body = (await request.json()) as { pdf_url?: unknown } | null;
      if (typeof body?.pdf_url === "string" && body.pdf_url.trim()) {
        preferredPdfUrl = body.pdf_url.trim();
      }
    } catch {
      // POST bez JSON — wybierzemy PDF z bazy
    }

    const { data: booking, error: bookingError } = await adminClient
      .from("bookings")
      .select(
        `
        id,
        booking_ref,
        contact_email,
        contact_first_name,
        contact_last_name,
        access_token,
        agreement_pdf_url,
        trips:trips!inner(id, title)
      `,
      )
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
    }

    const email = (booking.contact_email ?? "").trim();
    if (!email) {
      return NextResponse.json({ error: "Brak adresu e-mail klienta w rezerwacji" }, { status: 400 });
    }

    const trip = Array.isArray(booking.trips) ? booking.trips[0] : booking.trips;
    const tripTitle = (trip as { title?: string } | null)?.title ?? "Wycieczka";

    // Ta sama kolejność co ensureAgreement / persistAgreementSeq — unikamy wysyłki starego wiersza.
    const { data: agreement, error: agrErr } = await adminClient
      .from("agreements")
      .select("id, pdf_url, status, generated_at, updated_at")
      .eq("booking_id", bookingId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("generated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (agrErr) {
      console.error("send-agreement-email: agreements query", agrErr);
      return NextResponse.json({ error: "Nie udało się odczytać umowy" }, { status: 500 });
    }

    const bookingPdfUrl =
      typeof booking.agreement_pdf_url === "string" ? booking.agreement_pdf_url.trim() : "";
    const pdfUrl =
      preferredPdfUrl ||
      agreement?.pdf_url?.trim() ||
      bookingPdfUrl ||
      null;
    if (!pdfUrl) {
      return NextResponse.json(
        { error: "Brak wygenerowanego pliku umowy — najpierw wygeneruj umowę w panelu." },
        { status: 400 },
      );
    }

    const { data: fileBlob, error: dlErr } = await adminClient.storage.from("agreements").download(pdfUrl);

    if (dlErr || !fileBlob) {
      console.error("send-agreement-email: storage download", dlErr);
      return NextResponse.json({ error: "Nie udało się pobrać pliku PDF z magazynu" }, { status: 500 });
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    // Bezpiecznik: jeśli PDF jest podejrzanie mały, to zwykle oznacza błąd generowania (np. fallback/HTML/empty).
    // Lepiej przerwać wysyłkę niż wysłać klientowi "rozjechany" dokument.
    if (arrayBuffer.byteLength < 5_000) {
      console.error("send-agreement-email: suspiciously small PDF", {
        pdfUrl,
        bytes: arrayBuffer.byteLength,
      });
      return NextResponse.json(
        { error: "Plik PDF wygląda na uszkodzony (zbyt mały). Wygeneruj umowę ponownie i spróbuj jeszcze raz." },
        { status: 500 },
      );
    }
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const publicAgreementNumber = await resolvePublicAgreementNumberForBooking(adminClient, bookingId);
    const { firstName } = resolveContactNames({
      contact_first_name: booking.contact_first_name ?? undefined,
      contact_last_name: booking.contact_last_name ?? undefined,
      participants: [],
    });

    const attachmentFilename = formatUpdatedAgreementPdfFilename(publicAgreementNumber);

    const emailParams = {
      agreementNumber: publicAgreementNumber,
      contactFirstName: firstName,
      tripTitle,
      attachmentFilename,
    };

    const html = generateAgreementUpdatedEmailHtml(emailParams);
    const text = generateAgreementUpdatedEmailText(emailParams);

    const subject = buildAgreementUpdatedEmailSubject({
      agreementNumber: publicAgreementNumber,
      tripTitle,
    });

    const sendResult = await sendTransactionalEmail({
      to: email,
      subject,
      html,
      text,
      attachment: { filename: attachmentFilename, base64 },
      logContext: "agreement-updated",
    });

    if (!sendResult.ok) {
      return NextResponse.json({ error: sendResult.error }, { status: 500 });
    }

    const sentAt = new Date().toISOString();
    if (agreement?.id) {
      const { error: updErr } = await adminClient
        .from("agreements")
        .update({
          sent_at: sentAt,
          status: "sent",
          updated_at: sentAt,
        })
        .eq("id", agreement.id);

      if (updErr) {
        console.error("send-agreement-email: failed to set sent_at", updErr);
        return NextResponse.json(
          { error: "E-mail wysłany, ale nie zapisano daty wysyłki w bazie", details: updErr.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ ok: true, sent_at: sentAt, pdf_url: pdfUrl });
  } catch (e) {
    console.error("POST send-agreement-email", e);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
