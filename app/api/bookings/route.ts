import { NextResponse } from "next/server";
import { z } from "zod";
import { readFile } from "fs/promises";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaynowPayment } from "@/lib/paynow";
import { generateBookingConfirmationEmail } from "@/lib/email/templates/booking-confirmation";

const addressSchema = z.object({
  street: z.string().min(2, "Podaj ulicę"),
  city: z.string().min(2, "Podaj miasto"),
  zip: z.string().min(4, "Podaj kod pocztowy"),
});

const participantSchema = z.object({
  first_name: z.string().min(2, "Podaj imię"),
  last_name: z.string().min(2, "Podaj nazwisko"),
  pesel: z
    .string()
    .regex(/^$|^\d{11}$/, "PESEL musi mieć dokładnie 11 cyfr")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data urodzenia w formacie RRRR-MM-DD"),
  email: z.string().email("Niepoprawny adres e-mail").optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().min(7, "Telefon jest zbyt krótki").optional().or(z.literal("").transform(() => undefined)),
  document_type: z.enum(["ID", "PASSPORT"]).optional(),
  document_number: z.string().min(3, "Podaj numer dokumentu").optional(),
  document_issue_date: z
    .string()
    .regex(/^$|^\d{4}-\d{2}-\d{2}$/, "Data w formacie RRRR-MM-DD")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  document_expiry_date: z
    .string()
    .regex(/^$|^\d{4}-\d{2}-\d{2}$/, "Data w formacie RRRR-MM-DD")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  gender_code: z.enum(["F", "M"]).optional(),
  selected_services: z.record(z.string(), z.unknown()).optional(),
});

const consentsSchema = z.object({
  rodo: z.literal(true),
  terms: z.literal(true),
  conditions: z.literal(true),
});

const companySchema = z.object({
  name: z.string().min(2, "Podaj nazwę firmy").optional().or(z.literal("").transform(() => undefined)),
  nip: z.string().regex(/^\d{10}$/, "NIP musi mieć dokładnie 10 cyfr").optional().or(z.literal("").transform(() => undefined)),
  address: addressSchema.optional(),
});

const invoicePersonSchema = z.object({
  first_name: z
    .string()
    .min(2, "Podaj imię")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  last_name: z
    .string()
    .min(2, "Podaj nazwisko")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  address: addressSchema.optional(),
});

const invoiceSchema = z
  .object({
    use_other_data: z.boolean().default(false),
    type: z.enum(["individual", "company"]).optional(),
    person: invoicePersonSchema.optional(),
    company: companySchema.optional(),
  })
  .optional();

const bookingPayloadSchema = z.object({
  slug: z.string().min(1, "Brak identyfikatora wycieczki"),
  contact_first_name: z.string().min(2, "Podaj imię").optional().or(z.literal("").transform(() => undefined)),
  contact_last_name: z.string().min(2, "Podaj nazwisko").optional().or(z.literal("").transform(() => undefined)),
  contact_pesel: z
    .string()
    .regex(/^$|^\d{11}$/, "PESEL musi mieć dokładnie 11 cyfr")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  contact_email: z.string().email("Niepoprawny adres e-mail"),
  contact_phone: z.string().min(7, "Podaj numer telefonu"),
  address: addressSchema.optional(),
  company_name: z.string().min(2, "Podaj nazwę firmy").optional().or(z.literal("").transform(() => undefined)),
  company_nip: z.string().regex(/^\d{10}$/, "NIP musi mieć dokładnie 10 cyfr").optional().or(z.literal("").transform(() => undefined)),
  company_address: addressSchema.optional(),
  participants: z.array(participantSchema).min(1, "Dodaj przynajmniej jednego uczestnika"),
  consents: consentsSchema,
  applicant_type: z.enum(["individual", "company"]).optional(),
  invoice_type: z.enum(["contact", "company", "custom"]).optional(),
  invoice_name: z.string().optional().or(z.literal("").transform(() => undefined)),
  invoice_nip: z.string().optional().or(z.literal("").transform(() => undefined)),
  invoice_address: addressSchema.optional(),
  invoice: invoiceSchema,
  with_payment: z.boolean().optional().default(false),
});

type BookingPayload = z.infer<typeof bookingPayloadSchema>;

function generateRef() {
  return `BK-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function buildConsents(consents: BookingPayload["consents"]) {
  const acceptedAt = new Date().toISOString();
  return Object.entries(consents).reduce<Record<string, { accepted: boolean; accepted_at: string }>>(
    (acc, [key, value]) => {
      acc[key] = { accepted: value, accepted_at: acceptedAt };
      return acc;
    },
    {},
  );
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bookingPayloadSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const seatsRequested = payload.participants.length;

    const supabase = await createClient();

    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select(
        "id, title, start_date, end_date, price_cents, seats_total, seats_reserved, is_active, public_slug, payment_split_enabled, payment_split_first_percent, reservation_number",
      )
      .or(`slug.eq.${payload.slug},public_slug.eq.${payload.slug}`)
      .eq("is_active", true)
      .single();

    if (tripErr || !trip) {
      return NextResponse.json({ error: "Trip not found or inactive" }, { status: 404 });
    }

    const seatsAvailable = Math.max(0, (trip.seats_total ?? 0) - (trip.seats_reserved ?? 0));
    if (seatsRequested > seatsAvailable) {
      return NextResponse.json({ error: "Not enough seats" }, { status: 409 });
    }

    const bookingRef = generateRef();

    const { data: reservedTrip, error: reserveErr } = await supabase.rpc("reserve_trip_seats", {
      p_trip_id: trip.id,
      p_requested: seatsRequested,
    });

    if (reserveErr || !reservedTrip) {
      return NextResponse.json({ error: "Not enough seats" }, { status: 409 });
    }

    const rollbackSeats = async () => {
      await supabase.rpc("release_trip_seats", {
        p_trip_id: trip.id,
        p_requested: seatsRequested,
      });
    };

    const consents = buildConsents(payload.consents);

    // Wstaw rezerwację używając funkcji RPC przez admin clienta
    // Funkcja RPC używa surowego SQL i omija cache PostgREST
    let booking: { id: string; booking_ref: string } | null = null;
    let accessToken: string | null = null;
    
    try {
      const adminSupabase = createAdminClient();
      
      // Najpierw spróbuj użyć funkcji RPC przez admin clienta
      const { data: rpcData, error: rpcError } = await adminSupabase.rpc('create_booking', {
        p_trip_id: trip.id,
        p_booking_ref: bookingRef,
        p_contact_first_name: payload.contact_first_name || null,
        p_contact_last_name: payload.contact_last_name || null,
        p_contact_pesel: payload.contact_pesel,
        p_contact_email: payload.contact_email,
        p_contact_phone: payload.contact_phone,
        p_address: payload.address,
        p_company_name: payload.company_name || null,
        p_company_nip: payload.company_nip || null,
        p_company_address: payload.company_address || null,
        p_consents: consents,
        p_status: "confirmed",
        p_payment_status: "unpaid",
        p_source: "public_page",
      });

      if (rpcError || !rpcData) {
        // Jeśli RPC nie działa, użyj bezpośredniego INSERT przez admin clienta
        // Używamy tylko podstawowych kolumn które na pewno istnieją
        console.warn("RPC create_booking failed, trying direct INSERT with admin client:", rpcError);
        
        // Fallback: INSERT używając tylko podstawowych kolumn (bez nowych pól z migracji)
        const insertData = {
          trip_id: trip.id,
          booking_ref: bookingRef,
          contact_email: payload.contact_email,
          contact_phone: payload.contact_phone,
          address: payload.address,
          consents,
          status: "confirmed" as const,
          payment_status: "unpaid" as const,
          source: "public_page" as const,
        };
        
        const { data: bookingData, error: insertError } = await adminSupabase
          .from("bookings")
          .insert(insertData)
          .select("id, booking_ref")
          .single();

        if (insertError || !bookingData) {
          throw new Error(insertError?.message || "Failed to create booking - no data returned");
        }
        
        booking = {
          id: bookingData.id,
          booking_ref: bookingData.booking_ref,
        };
        
        // Zaktualizuj nowe pola przez UPDATE (jeśli są zdefiniowane)
        // To omija problemy z cache PostgREST przy INSERT
        const updateData: any = {};
        if (payload.contact_first_name) updateData.contact_first_name = payload.contact_first_name;
        if (payload.contact_last_name) updateData.contact_last_name = payload.contact_last_name;
        if (payload.contact_pesel) updateData.contact_pesel = payload.contact_pesel;
        if (payload.company_name) updateData.company_name = payload.company_name;
        if (payload.company_nip) updateData.company_nip = payload.company_nip;
        if (payload.company_address) updateData.company_address = payload.company_address;
        if (payload.invoice_type) updateData.invoice_type = payload.invoice_type;
        if (payload.invoice_name) updateData.invoice_name = payload.invoice_name;
        if (payload.invoice_nip) updateData.invoice_nip = payload.invoice_nip;
        if (payload.invoice_address) updateData.invoice_address = payload.invoice_address;
        
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await adminSupabase
            .from("bookings")
            .update(updateData)
            .eq("id", booking.id);
          
          if (updateError) {
            console.warn("Failed to update additional booking fields:", updateError);
            // Nie rzucamy błędu - booking już został utworzony
          }
        }
      } else {
        // RPC zadziałało
        const bookingResult = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        
        if (!bookingResult || !bookingResult.id) {
          throw new Error("Failed to create booking - no data returned");
        }
        
        booking = {
          id: bookingResult.id,
          booking_ref: bookingResult.booking_ref,
        };

        // Zaktualizuj dane fakturowe po wywołaniu RPC
        const adminSupabase = createAdminClient();
        const updateData: any = {};
        if (payload.invoice_type) updateData.invoice_type = payload.invoice_type;
        if (payload.invoice_name) updateData.invoice_name = payload.invoice_name;
        if (payload.invoice_nip) updateData.invoice_nip = payload.invoice_nip;
        if (payload.invoice_address) updateData.invoice_address = payload.invoice_address;

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await adminSupabase
            .from("bookings")
            .update(updateData)
            .eq("id", booking.id);

          if (updateError) {
            console.warn("Failed to update invoice fields on booking:", updateError);
          }
        }
      }
    } catch (err: any) {
      console.error("Error creating booking:", {
        error: err,
        message: err?.message,
        code: err?.code,
      });
      await rollbackSeats();
      return NextResponse.json(
        { 
          error: "Failed to create booking",
          details: err?.message || "Unknown error",
          code: err?.code,
        },
        { status: 500 }
      );
    }

    if (!booking) {
      await rollbackSeats();
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 }
      );
    }

    // Pobierz access_token używając admin clienta (omija RLS)
    try {
      const adminSupabase = createAdminClient();
      const { data: bookingWithToken, error: tokenError } = await adminSupabase
        .from("bookings")
        .select("access_token")
        .eq("id", booking.id)
        .single();
      
      if (!tokenError && bookingWithToken?.access_token) {
        accessToken = bookingWithToken.access_token;
        console.log("✅ Fetched access_token using admin client:", accessToken);
      } else if (tokenError) {
        console.error("❌ Could not fetch access_token:", {
          error: tokenError.message,
          code: tokenError.code,
          hint: tokenError.hint,
          booking_id: booking.id
        });
      }
    } catch (err: any) {
      console.error("❌ Error fetching access_token:", {
        error: err?.message,
        booking_id: booking.id
      });
    }

    // Jeśli access_token nie został pobrany w INSERT, spróbuj pobrać osobno używając admin clienta
    // (aby ominąć RLS który blokuje anon odczyt)
    if (!accessToken) {
      try {
        // Użyj admin clienta aby ominąć RLS
        const adminSupabase = createAdminClient();
        const { data: bookingWithToken, error: tokenError } = await adminSupabase
          .from("bookings")
          .select("access_token")
          .eq("id", booking.id)
          .single();
        
        if (!tokenError && bookingWithToken?.access_token) {
          accessToken = bookingWithToken.access_token;
          console.log("✅ Fetched access_token using admin client:", accessToken);
        } else if (tokenError) {
          console.error("❌ Could not fetch access_token even with admin client:", {
            error: tokenError.message,
            code: tokenError.code,
            hint: tokenError.hint,
            booking_id: booking.id
          });
        }
      } catch (err: any) {
        console.error("❌ Error fetching access_token with admin client:", {
          error: err?.message,
          booking_id: booking.id
        });
      }
    } else {
      console.log("✅ access_token retrieved from INSERT:", accessToken);
    }

    const participantsPayload = payload.participants.map((participant) => {
      const participantData: any = {
        booking_id: booking.id,
        first_name: participant.first_name.trim(),
        last_name: participant.last_name.trim(),
        pesel: participant.pesel && participant.pesel.trim() !== "" ? participant.pesel.trim() : null,
        email: participant.email && participant.email.trim() !== "" ? participant.email.trim() : null,
        phone: participant.phone && participant.phone.trim() !== "" ? participant.phone.trim() : null,
        document_type: participant.document_type ?? null,
        document_number: participant.document_number && participant.document_number.trim() !== "" ? participant.document_number.trim() : null,
        // gender_code - tymczasowo usunięte, ponieważ kolumna nie istnieje w bazie
        // Aby dodać z powrotem, uruchom migrację 017_insurance_hdi_enhancements.sql
        // gender_code: participant.gender_code ?? null,
      };
      
      // Obsługa dat dokumentu - konwersja string na Date tylko jeśli data jest poprawna
      if (participant.document_issue_date && participant.document_issue_date.trim() !== "") {
        try {
          const issueDate = new Date(participant.document_issue_date);
          if (!isNaN(issueDate.getTime())) {
            participantData.document_issue_date = issueDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
          }
        } catch (e) {
          console.warn("Invalid document_issue_date:", participant.document_issue_date);
        }
      }
      
      if (participant.document_expiry_date && participant.document_expiry_date.trim() !== "") {
        try {
          const expiryDate = new Date(participant.document_expiry_date);
          if (!isNaN(expiryDate.getTime())) {
            participantData.document_expiry_date = expiryDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
          }
        } catch (e) {
          console.warn("Invalid document_expiry_date:", participant.document_expiry_date);
        }
      }
      
      // Address - używamy adresu kontaktu, nie adresu uczestnika (jeśli nie ma osobnego)
      // Sprawdzamy czy address jest obiektem i czy ma wymagane pola
      if (payload.address && typeof payload.address === 'object') {
        participantData.address = payload.address;
      }
      
      // Selected services - zapis wybranych usług dodatkowych
      if (participant.selected_services && typeof participant.selected_services === 'object') {
        participantData.selected_services = participant.selected_services;
      }
      
      return participantData;
    });
    
    console.log("📝 Participants payload prepared:", JSON.stringify(participantsPayload, null, 2));

    const adminSupabase = createAdminClient();
    const { error: participantsErr, data: participantsData } = await adminSupabase.from("participants").insert(participantsPayload).select();

    if (participantsErr) {
      console.error("❌ Error inserting participants:", {
        error: participantsErr,
        message: participantsErr.message,
        code: participantsErr.code,
        details: participantsErr.details,
        hint: participantsErr.hint,
        participantsPayload: JSON.stringify(participantsPayload, null, 2),
      });
      await adminSupabase.from("bookings").delete().eq("id", booking.id);
      await rollbackSeats();
      return NextResponse.json(
        { 
          error: "Failed to add participants",
          details: participantsErr.message || "Unknown error",
          code: participantsErr.code,
          hint: participantsErr.hint,
        },
        { status: 500 }
      );
    }
    
    console.log("✅ Successfully inserted participants:", participantsData);

    // Pobierz baseUrl - w produkcji MUSI być ustawiony NEXT_PUBLIC_BASE_URL
    // W przeciwnym razie Paynow przekieruje na localhost zamiast produkcyjnego URL
    const { origin } = new URL(req.url);
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
    
    // Jeśli nie ma NEXT_PUBLIC_BASE_URL, sprawdź VERCEL_URL (dla Vercel deployment)
    if (!baseUrl && process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    }
    
    // Fallback na origin tylko w development (localhost)
    if (!baseUrl) {
      baseUrl = origin;
      console.warn("NEXT_PUBLIC_BASE_URL nie jest ustawione - używany jest origin z requestu. To może powodować problemy w produkcji!");
    }

    const tripInfo = {
      title: trip.title as string,
      start_date: trip.start_date ?? null,
      end_date: trip.end_date ?? null,
      price_cents: trip.price_cents ?? null,
    };

    let attachment: { filename: string; base64: string } | null = null;
    let agreementPdfUrl: string | null = null;

    // Pobierz reservation_number z wycieczki i policz numer kolejny umowy dla tej wycieczki
    const reservationNumber = trip.reservation_number || null;
    let agreementNumber = 1; // Domyślnie pierwsza umowa
    
    if (reservationNumber) {
      // Policz ile już jest umów dla wszystkich rezerwacji tej wycieczki
      // Najpierw pobierz wszystkie booking_id dla tej wycieczki
      const { data: tripBookings, error: bookingsError } = await adminSupabase
        .from("bookings")
        .select("id")
        .eq("trip_id", trip.id);
      
      if (!bookingsError && tripBookings && tripBookings.length > 0) {
        const bookingIds = tripBookings.map(b => b.id);
        const { count: agreementsCount, error: agreementsCountError } = await adminSupabase
          .from("agreements")
          .select("*", { count: "exact", head: true })
          .in("booking_id", bookingIds);
        
        if (!agreementsCountError && agreementsCount !== null) {
          agreementNumber = agreementsCount + 1;
        }
      }
    }

    try {
      // W development zawsze używaj origin (localhost), w produkcji baseUrl
      const pdfUrl = process.env.NODE_ENV === "development" ? origin : baseUrl;
      const pdfRes = await fetch(`${pdfUrl}/api/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_ref: booking.booking_ref,
          reservation_number: reservationNumber,
          agreement_number: agreementNumber,
          trip: tripInfo,
          contact_email: payload.contact_email,
          contact_first_name: payload.contact_first_name || null,
          contact_last_name: payload.contact_last_name || null,
          contact_pesel: payload.contact_pesel || null,
          contact_phone: payload.contact_phone || null,
          address: payload.address || null,
          company_name: payload.company_name || null,
          company_nip: payload.company_nip || null,
          company_address: payload.company_address || null,
          invoice_type: payload.invoice_type || null,
          invoice_name: payload.invoice_name || null,
          invoice_nip: payload.invoice_nip || null,
          invoice_address: payload.invoice_address || null,
          participants: payload.participants.map((p) => ({
            first_name: p.first_name,
            last_name: p.last_name,
            pesel: p.pesel,
            email: p.email || undefined,
            phone: p.phone || undefined,
            document_type: p.document_type || undefined,
            document_number: p.document_number || undefined,
          })),
        }),
      });

      if (pdfRes.ok) {
        const { base64, filename } = (await pdfRes.json()) as { base64: string; filename: string };
        attachment = { filename, base64 };
        agreementPdfUrl = filename;

        // Zapisz informację o umowie w tabeli agreements
        try {
          await adminSupabase.from("agreements").insert({
            booking_id: booking.id,
            status: "generated",
            pdf_url: filename,
          });
        } catch (agreementErr) {
          console.error("Error saving agreement to database:", agreementErr);
          // Nie blokujemy rezerwacji jeśli zapis umowy się nie powiedzie
        }
      }
    } catch (err) {
      console.error("PDF generation request failed:", err);
      // brak PDF nie blokuje rezerwacji – spróbujemy fallbacku niżej
    }

    // Fallback: jeśli nie udało się wygenerować PDF, dołącz przykładową umowę z /public
    if (!attachment) {
      try {
        const fallbackPath = `${process.cwd()}/public/example-agreement.pdf`;
        const buf = await readFile(fallbackPath);
        attachment = { filename: "umowa.pdf", base64: buf.toString("base64") };
        agreementPdfUrl = "example-agreement.pdf";
        console.warn("Using fallback agreement PDF attachment (example-agreement.pdf)");
      } catch (fallbackErr) {
        console.error("Failed to attach fallback agreement PDF:", fallbackErr);
      }
    }

    if (payload.contact_email) {
      try {
        let emailHtml: string;
        let textContent: string;
        
        // Tworzymy link do strony rezerwacji z access_token
        let bookingLink: string;
        if (accessToken) {
          bookingLink = `${baseUrl}/booking/${accessToken}`;
          console.log("✅ Booking link created with access_token:", bookingLink);
        } else {
          // Logujemy szczegóły dla debugowania
          console.error("❌ access_token is null for booking:", {
            booking_ref: booking.booking_ref,
            booking_id: booking.id,
            message: "Check database and RLS policies"
          });
          // Tymczasowo używamy linku do strony wycieczki
          bookingLink = `${baseUrl}/trip/${trip.public_slug || payload.slug}`;
          console.warn("⚠️ Using fallback link to trip page:", bookingLink);
        }

        // Jeśli with_payment=false, utwórz link do płatności
        let paymentLink: string | null = null;
        if (!payload.with_payment && accessToken) {
          paymentLink = `${baseUrl}/booking/${accessToken}`;
        } else if (!payload.with_payment && booking.booking_ref) {
          paymentLink = `${baseUrl}/booking/${booking.booking_ref}`;
        }

        emailHtml = generateBookingConfirmationEmail(
          booking.booking_ref,
          bookingLink,
          trip.title as string,
          trip.start_date,
          trip.end_date,
          seatsRequested,
          paymentLink,
        );
        
        let textContentBase = `Dziękujemy za rezerwację w Magii Podróżowania.\n\nKod rezerwacji: ${booking.booking_ref}\n\nW załączniku do tego maila znajdziesz wygenerowaną umowę w formacie PDF.\n\nProsimy o:\n1. Pobranie załączonej umowy PDF\n2. Podpisanie umowy\n3. Przesłanie podpisanej umowy przez link poniżej\n\nLink do przesłania podpisanej umowy:\n${bookingLink}`;
        
        if (paymentLink) {
          textContentBase += `\n\nMożesz również dokonać płatności za rezerwację klikając w poniższy link:\n${paymentLink}`;
        }
        
        textContent = textContentBase;

        const resend = new Resend(process.env.RESEND_API_KEY);
        const senderName = process.env.RESEND_FROM_NAME || "Magia Podróży";
        const envFrom = process.env.RESEND_FROM;
        let emailAddress = "noreply@mail.mainly.pl";
        if (envFrom && envFrom.includes("@")) {
          const emailMatch = envFrom.match(/<([^>]+)>/) || envFrom.match(/([^\s<]+@[^\s>]+)/);
          if (emailMatch) {
            const localPart = (emailMatch[1] || emailMatch[0]).split("@")[0];
            emailAddress = `${localPart}@mail.mainly.pl`;
          } else {
            emailAddress = `${envFrom.split("@")[0]}@mail.mainly.pl`;
          }
        }

        const attachments = attachment
          ? [{ filename: attachment.filename, content: attachment.base64, encoding: "base64" as const }]
          : undefined;

        const { error: emailError } = await resend.emails.send({
          from: `${senderName} <${emailAddress}>`,
          to: payload.contact_email,
          subject: `Potwierdzenie rezerwacji ${booking.booking_ref}`,
          html: emailHtml,
          text: textContent,
          attachments,
        });

        if (emailError) {
          console.error("Resend error sending booking confirmation:", emailError);
        } else {
          console.log("✅ Booking confirmation email sent to:", payload.contact_email);
        }
      } catch (err) {
        console.error("Error sending email:", err);
        // ignorujemy błąd wysyłki maila, rezerwacja już zapisana
      }
    }

    // Utworzenie płatności Paynow v3
    let redirectUrl: string | null = null;
    const unitPrice = trip.price_cents ?? 0;
    const totalAmountCents = unitPrice * seatsRequested;
    
    // Oblicz kwotę zaliczki i reszty na podstawie ustawień wycieczki
    const paymentSplitEnabled = trip.payment_split_enabled ?? true;
    const paymentSplitFirstPercent = trip.payment_split_first_percent ?? 30;
    
    let firstPaymentAmountCents = totalAmountCents;
    let secondPaymentAmountCents = 0;
    
    if (paymentSplitEnabled) {
      // Oblicz zaliczkę (np. 30% z pełnej kwoty)
      firstPaymentAmountCents = Math.round((totalAmountCents * paymentSplitFirstPercent) / 100);
      // Reszta to pozostała kwota
      secondPaymentAmountCents = totalAmountCents - firstPaymentAmountCents;
    }
    
    // Zapisz kwoty w booking
    try {
      const adminSupabase = createAdminClient();
      await adminSupabase
        .from("bookings")
        .update({
          first_payment_amount_cents: firstPaymentAmountCents,
          second_payment_amount_cents: secondPaymentAmountCents,
        })
        .eq("id", booking.id);
    } catch (err) {
      console.error("Error updating payment amounts in booking:", err);
      // Nie blokujemy rezerwacji jeśli aktualizacja się nie powiedzie
    }

    console.log(`[Bookings POST] Creating Paynow payment: total=${totalAmountCents}, first_payment=${firstPaymentAmountCents} (${paymentSplitFirstPercent}%), second_payment=${secondPaymentAmountCents}, booking_ref=${booking.booking_ref}, with_payment=${payload.with_payment}`);

    // Tworzenie płatności Paynow tylko gdy with_payment=true
    if (firstPaymentAmountCents > 0 && payload.with_payment) {
      try {
        // Utwórz URL powrotu - jeśli mamy access_token, przekieruj do strony rezerwacji, w przeciwnym razie do strony powrotu
        const returnUrl = accessToken
          ? `${baseUrl}/booking/${accessToken}`
          : `${baseUrl}/payments/return?booking_ref=${booking.booking_ref}`;

        console.log(`[Bookings POST] Creating Paynow payment with returnUrl: ${returnUrl}`);
        
        const payment = await createPaynowPayment({
          amountCents: firstPaymentAmountCents, // Używamy kwoty zaliczki zamiast pełnej kwoty
          externalId: booking.booking_ref,
          description: `Rezerwacja ${booking.booking_ref} - ${trip.title} (zaliczka ${paymentSplitFirstPercent}%)`,
          buyerEmail: payload.contact_email,
          continueUrl: returnUrl,
          notificationUrl: `${baseUrl}/api/payments/paynow/webhook`,
        });
        
        console.log(`[Bookings POST] Paynow payment created: paymentId=${payment.paymentId}, redirectUrl=${payment.redirectUrl}`);
        redirectUrl = payment.redirectUrl ?? null;

        // WAŻNE: Zapisz payment_id w payment_history - to pozwoli na sprawdzenie statusu bez webhooków
        // Używamy admin clienta, aby ominąć RLS i mieć pewność, że operacja się powiedzie
        try {
          const { createAdminClient } = await import("@/lib/supabase/admin");
          const adminClient = createAdminClient();
          
          // Sprawdź czy już istnieje wpis dla tej rezerwacji z tym paymentId
          const { data: existingPayment, error: checkError } = await adminClient
            .from("payment_history")
            .select("id, notes, amount_cents")
            .eq("booking_id", booking.id)
            .like("notes", `%${payment.paymentId}%`)
            .limit(1);

          if (checkError) {
            console.error(`[Bookings POST] Error checking existing payment history:`, checkError);
          }

          if (!existingPayment || existingPayment.length === 0) {
            // Dodaj wpis w historii płatności z paymentId (status pending)
            console.log(`[Bookings POST] Inserting payment history entry for payment ${payment.paymentId} (PENDING)`);
            console.log(`[Bookings POST] Insert data: booking_id=${booking.id}, amount_cents=${firstPaymentAmountCents}, payment_method=paynow`);
            
            // Użyj retry logic, aby upewnić się, że payment_id jest zawsze zapisane
            let retries = 3;
            let insertSuccess = false;
            
            while (retries > 0 && !insertSuccess) {
              const { error: insertError, data: insertedPayment } = await adminClient
                .from("payment_history")
                .insert({
                  booking_id: booking.id,
                  amount_cents: firstPaymentAmountCents,
                  payment_method: "paynow",
                  notes: `Paynow payment ${payment.paymentId} - status: PENDING (initialized) - zaliczka ${paymentSplitFirstPercent}%`,
                })
                .select();

              if (insertError) {
                console.error(`[Bookings POST] ❌ Failed to insert payment history (attempt ${4 - retries}/3):`, {
                  error: insertError,
                  errorCode: insertError.code,
                  errorMessage: insertError.message,
                  errorDetails: insertError.details,
                  errorHint: insertError.hint,
                  bookingId: booking.id,
                  paymentId: payment.paymentId,
                  amountCents: firstPaymentAmountCents,
                });
                
                retries--;
                if (retries > 0) {
                  // Poczekaj chwilę przed ponowną próbą
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              } else {
                insertSuccess = true;
                console.log(`[Bookings POST] ✓ Successfully inserted payment history entry:`, insertedPayment);
              }
            }
            
            if (!insertSuccess) {
              console.error(`[Bookings POST] ⚠️ CRITICAL: Failed to insert payment history after 3 attempts. Payment ${payment.paymentId} may not be checkable without webhook!`);
            }
          } else {
            console.log(`[Bookings POST] Payment history entry already exists for payment ${payment.paymentId} (id: ${existingPayment[0].id}, amount: ${existingPayment[0].amount_cents})`);
          }
        } catch (historyError) {
          // Błąd zapisywania payment_history nie powinien blokować tworzenia rezerwacji
          console.error("[Bookings POST] Error saving payment history:", historyError);
        }
      } catch (err) {
        // jeśli nie uda się stworzyć płatności, rezerwacja dalej istnieje,
        // ale użytkownik nie zostanie przekierowany do płatności online
        console.error("[Bookings POST] ❌ Paynow create payment error:", err);
        console.error("[Bookings POST] Error details:", {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        // redirectUrl pozostaje null, więc użytkownik zostanie przekierowany do booking_url
      }
    }

    // Zawsze zwracamy booking_url do strony rezerwacji (gdzie można załączyć umowę i zapłacić)
    // Jeśli access_token nie istnieje, użyjemy booking_ref jako identyfikator
    // (wymaga to obsługi w routingu /booking/[token] aby akceptował również booking_ref)
    let bookingUrl: string | null = null;
    if (accessToken) {
      bookingUrl = `${baseUrl}/booking/${accessToken}`;
      console.log("✅ Created booking_url with access_token:", bookingUrl);
    } else {
      // Fallback: użyj booking_ref - ale to wymaga zmiany w routingu
      // Na razie użyjemy endpointu API który zwróci booking data
      bookingUrl = `${baseUrl}/booking/${booking.booking_ref}`;
      console.warn("⚠️ Using booking_ref as fallback for booking_url:", bookingUrl);
      console.warn("   Please run migration 015_bookings_access_token.sql or 018_fix_access_token.sql");
    }

    const responseData = {
      booking_ref: booking.booking_ref,
      agreement_pdf_url: agreementPdfUrl,
      booking_url: bookingUrl, // URL do strony rezerwacji (załączanie umowy + płatność)
      redirect_url: redirectUrl, // Opcjonalny URL do Paynow (jeśli płatność została utworzona)
    };
    
    console.log("[Bookings POST] ✅ Returning response:", {
      booking_ref: responseData.booking_ref,
      has_booking_url: !!responseData.booking_url,
      has_redirect_url: !!responseData.redirect_url,
      redirect_url: responseData.redirect_url,
    });
    
    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error("POST /api/bookings error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}


