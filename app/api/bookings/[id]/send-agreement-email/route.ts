import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  generateAgreementUpdatedEmailHtml,
  generateAgreementUpdatedEmailText,
} from "@/lib/email/templates/agreement-updated";
import { resolvePublicBaseUrl } from "@/lib/url/resolve-public-base-url";

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

function resolvePublicBaseUrlFromRequest(request: NextRequest): string {
  const { origin } = new URL(request.url);
  return resolvePublicBaseUrl(origin);
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

    const { data: booking, error: bookingError } = await adminClient
      .from("bookings")
      .select(
        `
        id,
        booking_ref,
        contact_email,
        access_token,
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

    const { data: agreements, error: agrErr } = await adminClient
      .from("agreements")
      .select("id, pdf_url, status, generated_at, updated_at")
      .eq("booking_id", bookingId)
      .order("generated_at", { ascending: false })
      .limit(1);

    if (agrErr) {
      console.error("send-agreement-email: agreements query", agrErr);
      return NextResponse.json({ error: "Nie udało się odczytać umowy" }, { status: 500 });
    }

    const agreement = agreements?.[0];
    const pdfUrl = agreement?.pdf_url?.trim();
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

    const baseUrl = resolvePublicBaseUrlFromRequest(request);
    const token = booking.access_token as string | null | undefined;
    const bookingLink = token ? `${baseUrl}/booking/${token}` : null;

    const html = generateAgreementUpdatedEmailHtml({
      bookingRef: booking.booking_ref as string,
      tripTitle,
      bookingLink,
    });
    const text = generateAgreementUpdatedEmailText({
      bookingRef: booking.booking_ref as string,
      tripTitle,
      bookingLink,
    });

    const subject = `Zaktualizowana umowa — rezerwacja ${booking.booking_ref}`;

    const baseFileName = pdfUrl.includes("/") ? pdfUrl.split("/").pop()! : pdfUrl;
    const attachmentFilename = baseFileName.toLowerCase().endsWith(".pdf")
      ? baseFileName
      : `${baseFileName}.pdf`;

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

    return NextResponse.json({ ok: true, sent_at: sentAt });
  } catch (e) {
    console.error("POST send-agreement-email", e);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
