import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNextAgreementSeq } from "@/lib/agreements/agreement-seq";

export type EnsureAgreementResult =
  | {
      ok: true;
      agreement_seq: number;
      filename: string | null;
      created: boolean;
    }
  | {
      ok: false;
      error: string;
      details?: string;
      status: number;
    };

export function resolvePdfBaseUrl(origin: string): string {
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) return origin;
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    origin
  );
}

/** Zapisuje lub uzupełnia rekord agreements z numerem kolejnym — niezależnie od PDF. */
export async function persistAgreementSeq(
  admin: SupabaseClient,
  bookingId: string,
  agreementSeq: number,
  opts?: { pdfUrl?: string | null; generatedAt?: string | null },
): Promise<{ agreementId: string | null; error?: string }> {
  const now = new Date().toISOString();
  const { data: existing, error: checkError } = await admin
    .from("agreements")
    .select("id, agreement_seq, pdf_url")
    .eq("booking_id", bookingId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("generated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    return { agreementId: null, error: checkError.message };
  }

  const patch: Record<string, unknown> = {
    status: "generated",
    updated_at: now,
  };
  if (opts?.pdfUrl) {
    patch.pdf_url = opts.pdfUrl;
    patch.generated_at = opts.generatedAt ?? now;
  }
  if (!existing || existing.agreement_seq == null || existing.agreement_seq <= 0) {
    patch.agreement_seq = agreementSeq;
  }

  if (existing?.id) {
    const { error: updateError } = await admin
      .from("agreements")
      .update(patch)
      .eq("id", existing.id);
    if (updateError) return { agreementId: null, error: updateError.message };
    return { agreementId: existing.id };
  }

  const { data: inserted, error: insertError } = await admin
    .from("agreements")
    .insert({
      booking_id: bookingId,
      status: "generated",
      agreement_seq: agreementSeq,
      pdf_url: opts?.pdfUrl ?? null,
      generated_at: opts?.pdfUrl ? (opts.generatedAt ?? now) : now,
    })
    .select("id")
    .single();

  if (insertError) return { agreementId: null, error: insertError.message };
  return { agreementId: inserted?.id ?? null };
}

export async function ensureAgreementForBooking(
  bookingId: string,
  opts: { baseUrl: string },
): Promise<EnsureAgreementResult> {
  const supabaseAdmin = createAdminClient();

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      `
        *,
        trips:trips(*),
        participants:participants(*)
      `,
    )
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return { ok: false, error: "Booking not found", status: 404 };
  }

  const trip = Array.isArray(booking.trips) ? booking.trips[0] : booking.trips;
  if (!trip) {
    return { ok: false, error: "Trip not found", status: 404 };
  }

  const participants = Array.isArray(booking.participants)
    ? booking.participants.map((p: Record<string, unknown>) => ({
        first_name: p.first_name,
        last_name: p.last_name,
        pesel: p.pesel ? String(p.pesel) : "",
        email: p.email || undefined,
        phone: p.phone || undefined,
        document_type: p.document_type || undefined,
        document_number: p.document_number || undefined,
        selected_services: p.selected_services,
      }))
    : [];

  if (participants.length === 0) {
    return { ok: false, error: "Brak uczestników w rezerwacji", status: 400 };
  }

  if (!booking.booking_ref) {
    return { ok: false, error: "Brak numeru rezerwacji", status: 400 };
  }

  if (!booking.contact_email) {
    return { ok: false, error: "Brak adresu email klienta", status: 400 };
  }

  if (!trip.title) {
    return { ok: false, error: "Brak nazwy wycieczki", status: 400 };
  }

  const { data: existingAgreement, error: agreementCheckError } = await supabaseAdmin
    .from("agreements")
    .select("id, agreement_seq, pdf_url, status")
    .eq("booking_id", bookingId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("generated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (agreementCheckError && agreementCheckError.code !== "PGRST116") {
    console.error("Error checking existing agreement:", agreementCheckError);
  }

  const hasPdf =
    Boolean(existingAgreement?.pdf_url) || Boolean(booking.agreement_pdf_url);
  const existingSeq =
    typeof existingAgreement?.agreement_seq === "number" &&
    existingAgreement.agreement_seq > 0
      ? existingAgreement.agreement_seq
      : null;

  if (existingSeq && hasPdf) {
    return {
      ok: true,
      agreement_seq: existingSeq,
      filename: existingAgreement?.pdf_url ?? booking.agreement_pdf_url ?? null,
      created: false,
    };
  }

  let agreementNumber: number;
  let created = false;

  if (existingSeq) {
    agreementNumber = existingSeq;
  } else {
    agreementNumber = await getNextAgreementSeq(supabaseAdmin, trip.id as string);
    const persist = await persistAgreementSeq(supabaseAdmin, bookingId, agreementNumber);
    if (persist.error) {
      return {
        ok: false,
        error: "Failed to persist agreement number",
        details: persist.error,
        status: 500,
      };
    }
    created = true;
  }

  const tripInfo = {
    title: trip.title as string,
    start_date: trip.start_date ?? null,
    end_date: trip.end_date ?? null,
    price_cents: trip.price_cents ?? null,
    location: (trip as { location?: string | null }).location ?? null,
  };

  const reservationNumber = (trip as { reservation_number?: string | null }).reservation_number || null;
  const applicantType =
    (booking as { applicant_type?: string }).applicant_type ||
    (booking.company_name ? "company" : "individual");

  const pdfPayload = {
    booking_ref: booking.booking_ref,
    reservation_number: reservationNumber,
    agreement_number: agreementNumber,
    trip: tripInfo,
    trip_id: trip.id,
    applicant_type: applicantType,
    contact_email: booking.contact_email,
    contact_first_name: booking.contact_first_name || null,
    contact_last_name: booking.contact_last_name || null,
    contact_phone: booking.contact_phone || null,
    address: booking.address || null,
    company_name: booking.company_name || null,
    company_nip: booking.company_nip || null,
    company_address: booking.company_address || null,
    participants,
  };

  let pdfRes: Response;
  try {
    pdfRes = await fetch(`${opts.baseUrl}/api/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pdfPayload),
    });
  } catch (fetchError) {
    return {
      ok: false,
      error: "Nie udało się wygenerować PDF",
      details: fetchError instanceof Error ? fetchError.message : String(fetchError),
      status: 500,
    };
  }

  const pdfResponseText = await pdfRes.text();

  if (!pdfRes.ok) {
    let details = pdfResponseText.substring(0, 200);
    try {
      const parsed = JSON.parse(pdfResponseText);
      details = parsed.details || parsed.error || details;
    } catch {
      // keep raw text
    }
    return {
      ok: false,
      error: "PDF generation failed",
      details,
      status: pdfRes.status,
    };
  }

  let pdfResult: { base64: string; filename: string; warning?: string };
  try {
    if (!pdfResponseText?.trim()) {
      throw new Error("Empty response from PDF endpoint");
    }
    pdfResult = JSON.parse(pdfResponseText);
    if (!pdfResult.base64 || !pdfResult.filename) {
      throw new Error("Invalid response format from PDF endpoint");
    }
  } catch (parseError) {
    return {
      ok: false,
      error: "Failed to parse PDF response",
      details: parseError instanceof Error ? parseError.message : String(parseError),
      status: 500,
    };
  }

  const { base64, filename } = pdfResult;
  const generatedAt = new Date().toISOString();

  if (pdfResult.warning) {
    try {
      const buf = Buffer.from(base64, "base64");
      const { error: upErr } = await supabaseAdmin.storage
        .from("agreements")
        .upload(filename, buf, { contentType: "application/pdf", upsert: true });
      if (upErr) {
        return {
          ok: false,
          error: "Failed to save agreement PDF",
          details: upErr.message || String(upErr),
          status: 500,
        };
      }
    } catch (e) {
      return {
        ok: false,
        error: "Failed to save agreement PDF",
        details: e instanceof Error ? e.message : String(e),
        status: 500,
      };
    }
  }

  const persistPdf = await persistAgreementSeq(supabaseAdmin, bookingId, agreementNumber, {
    pdfUrl: filename,
    generatedAt,
  });
  if (persistPdf.error) {
    return {
      ok: false,
      error: "Failed to update agreement record",
      details: persistPdf.error,
      status: 500,
    };
  }

  return {
    ok: true,
    agreement_seq: agreementNumber,
    filename,
    created,
  };
}
