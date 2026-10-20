import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import ExcelJS from "exceljs"
import { Resend } from "resend"
import { EMAIL_SENDER_NAME } from "@/lib/email/constants"
import { formatPublicAgreementNumber } from "@/lib/agreements/public-agreement-number"
import {
  listType1ExtraPersons,
  type1ExtraPersonsToXlsxRows,
} from "@/lib/insurance-local/type1-extra-persons"

function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = request.headers.get("authorization")
  return authHeader === `Bearer ${cronSecret}`
}

// POST /api/insurance-local/send-email/[tripId]/[type]
// Generuje XLSX, wypełnia szablon emaila i wysyła
// Auth: zalogowany admin LUB Bearer CRON_SECRET (wywołanie z crona)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; type: string }> }
) {
  try {
    const cronAuth = isCronAuthorized(request)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabase: any

    if (cronAuth) {
      supabase = createAdminClient()
    } else {
      supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const { tripId, type } = await params
    const insuranceType = parseInt(type)

    if (![1, 2, 3].includes(insuranceType)) {
      return NextResponse.json({ error: "Typ musi być 1, 2 lub 3" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    if (body.triggered_by === "cron" && !cronAuth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
    const triggeredBy: "manual" | "cron" = cronAuth ? "cron" : "manual"
    const variantId: string | null =
      typeof body.variant_id === "string" && body.variant_id.trim()
        ? body.variant_id.trim()
        : null
    const participantInsuranceIds: string[] = Array.isArray(body.participant_insurance_ids)
      ? body.participant_insurance_ids
          .filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
          .map((id: string) => id.trim())
      : []

    // Typ 3: raporty muszą iść osobno per wariant (100% / 100% Max)
    if (insuranceType === 3 && !variantId) {
      return NextResponse.json(
        { error: "Dla raportu KR (typ 3) wymagane jest variant_id — wysyłaj osobno wariant 100% i 100% Max" },
        { status: 400 }
      )
    }

    if (participantInsuranceIds.length > 0 && insuranceType !== 3) {
      return NextResponse.json(
        { error: "participant_insurance_ids jest dostępne tylko dla raportu KR (typ 3)" },
        { status: 400 }
      )
    }

    // 1. Pobierz dane wycieczki
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, title, start_date, end_date, slug, country, country_2, location")
      .eq("id", tripId)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: "Wycieczka nie znaleziona" }, { status: 404 })
    }

    let resolvedVariantName = ""
    if (variantId) {
      const { data: variantRow, error: variantError } = await supabase
        .from("insurance_variants")
        .select("id, name, type")
        .eq("id", variantId)
        .single()

      if (variantError || !variantRow) {
        return NextResponse.json({ error: "Wariant ubezpieczenia nie znaleziony" }, { status: 404 })
      }
      if (variantRow.type !== insuranceType) {
        return NextResponse.json(
          { error: `Wariant nie należy do typu ${insuranceType}` },
          { status: 400 }
        )
      }
      resolvedVariantName = typeof variantRow.name === "string" ? variantRow.name.trim() : ""
    }

    // 2. Pobierz szablon emaila
    const { data: template, error: templateError } = await supabase
      .from("insurance_email_templates")
      .select("*")
      .eq("type", insuranceType)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: "Szablon emaila nie znaleziony — skonfiguruj go w zakładce Ustawienia" }, { status: 404 })
    }

    if (!template.to_email) {
      return NextResponse.json({ error: "Brak adresu odbiorcy w szablonie emaila" }, { status: 400 })
    }

    // 3. Pobierz uczestników i wygeneruj XLSX
    const { participants, xlsxBuffer, xlsxFilename } = await buildXlsx(
      supabase,
      tripId,
      insuranceType,
      trip.slug,
      variantId,
      resolvedVariantName,
      participantInsuranceIds
    )

    // 4. Wypełnij tagi w szablonie
    const termin = formatTripDates(trip.start_date, trip.end_date)
    const kraj = formatTripCountries(trip)
    const participantsCount = String(participants.length)
    const tags: Record<string, string> = {
      "{wariant_ubezpieczenia}":
        resolvedVariantName ||
        (await getVariantName(supabase, tripId, insuranceType, variantId)),
      "{termin_od_do}": termin,
      "{termin}": termin,
      "{kraj}": kraj,
      "{tytul_wycieczki}": trip.title || "",
      "{kod_wycieczki}": trip.slug || tripId.slice(0, 8),
      "{liczba_osob}": participantsCount,
      "{liczba_ubezpieczen}": participantsCount,
      "{data_raportu}": new Date().toLocaleDateString("pl-PL"),
      "{data_poprzedniego_dnia}": (() => {
        const d = new Date(); d.setDate(d.getDate() - 1)
        return d.toLocaleDateString("pl-PL")
      })(),
      "{lista_umow}": "", // wypełniane dla typ 3
    }

    // Typ 3: lista umów tylko dla wskazanego wariantu (lub zaznaczonych rekordów)
    if (insuranceType === 3) {
      tags["{lista_umow}"] = await buildKrContractList(
        supabase,
        tripId,
        variantId,
        participantInsuranceIds
      )
    }

    const subject = replaceTags(template.subject_template, tags)
    const bodyText = replaceTags(template.body_template, tags)
    const bodyHtml = formatInsuranceEmailHtml(bodyText)

    // 5. Wyślij email przez Resend
    const apiKey = process.env.RESEND_API_KEY
    const senderName = process.env.RESEND_FROM_NAME || EMAIL_SENDER_NAME
    const from = `${senderName} <noreply@mail.mainly.pl>`

    if (!apiKey) {
      return NextResponse.json({ error: "Resend API key nie skonfigurowany" }, { status: 500 })
    }

    const resend = new Resend(apiKey)
    const xlsxAttachment = Buffer.from(xlsxBuffer)

    const sendResult = await resend.emails.send({
      from,
      to: template.to_email,
      cc: template.cc_email || undefined,
      subject,
      html: bodyHtml,
      text: bodyText,
      attachments: [
        {
          filename: xlsxFilename,
          content: xlsxAttachment,
        },
      ],
    })

    const sendError = sendResult.error
    const status = sendError ? "error" : "sent"
    const errorMessage = sendError ? String(sendError) : null

    // 6. Zapisz log
    const recipients = [template.to_email]
    if (template.cc_email) recipients.push(template.cc_email)

    const logPayload: Record<string, unknown> = {
      trip_id: tripId,
      insurance_type: insuranceType,
      recipients,
      xlsx_filename: xlsxFilename,
      participants_count: participants.length,
      status,
      error_message: errorMessage,
      triggered_by: triggeredBy,
    }
    if (variantId) logPayload.variant_id = variantId

    const { error: logError } = await supabase.from("insurance_email_logs").insert(logPayload)
    // Gdy kolumna variant_id jeszcze nie istnieje (brak migracji 069) — zapis bez niej
    if (logError && variantId) {
      delete logPayload.variant_id
      await supabase.from("insurance_email_logs").insert(logPayload)
    }

    if (sendError) {
      return NextResponse.json({ error: "Błąd wysyłki emaila", details: errorMessage }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      participants_count: participants.length,
      recipients,
      xlsx_filename: xlsxFilename,
      variant_id: variantId,
      variant_name: resolvedVariantName || null,
    })
  } catch (err) {
    console.error("POST /api/insurance-local/send-email error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function replaceTags(template: string, tags: Record<string, string>): string {
  let result = template
  for (const [tag, value] of Object.entries(tags)) {
    result = result.replace(new RegExp(tag.replace(/[{}]/g, "\\$&"), "g"), value)
  }
  return result
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Proste HTML z szablonu tekstowego: większa czcionka, pogrubione etykiety, lista. */
function formatInsuranceEmailHtml(bodyText: string): string {
  const lines = bodyText.replace(/\r\n/g, "\n").split("\n")
  const htmlParts: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      htmlParts.push('<div style="height: 12px; line-height: 12px; font-size: 12px;">&nbsp;</div>')
      continue
    }

    if (trimmed.startsWith("•") || trimmed.startsWith("- ")) {
      const item = trimmed.replace(/^•\s*/, "").replace(/^-\s+/, "")
      htmlParts.push(
        `<div style="margin: 4px 0 4px 8px; font-size: 16px; line-height: 1.55; color: #222222;">` +
          `<span style="color: #555555;">•</span> ${escapeHtml(item)}` +
          `</div>`
      )
      continue
    }

    const labelMatch = trimmed.match(/^([^:]{2,48}):\s*(.*)$/)
    if (labelMatch) {
      const label = labelMatch[1].trim()
      const value = labelMatch[2].trim()
      if (value) {
        htmlParts.push(
          `<div style="margin: 6px 0; font-size: 16px; line-height: 1.55; color: #222222;">` +
            `<strong style="font-weight: 700; color: #111111;">${escapeHtml(label)}:</strong> ` +
            `${escapeHtml(value)}` +
            `</div>`
        )
      } else {
        htmlParts.push(
          `<div style="margin: 14px 0 6px 0; font-size: 16px; line-height: 1.55; color: #111111;">` +
            `<strong style="font-weight: 700;">${escapeHtml(label)}:</strong>` +
            `</div>`
        )
      }
      continue
    }

    htmlParts.push(
      `<div style="margin: 6px 0; font-size: 16px; line-height: 1.6; color: #222222;">${escapeHtml(trimmed)}</div>`
    )
  }

  return (
    `<div style="margin:0;padding:0;background:#f4f4f5;">` +
    `<div style="max-width:640px;margin:0 auto;padding:28px 24px;font-family:Arial,Helvetica,sans-serif;background:#ffffff;color:#222222;">` +
    htmlParts.join("") +
    `</div></div>`
  )
}

function formatTripDates(start: string | null, end: string | null): string {
  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "?"
  return `${fmt(start)} – ${fmt(end)}`
}

function formatTripCountries(trip: {
  country?: string | null
  country_2?: string | null
  location?: string | null
}): string {
  const countries = [trip.country, trip.country_2]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
  if (countries.length > 0) return countries.join(", ")
  return typeof trip.location === "string" ? trip.location.trim() : ""
}

function extractVariantName(insuranceVariants: unknown): string | null {
  if (!insuranceVariants) return null
  if (Array.isArray(insuranceVariants)) {
    const name = insuranceVariants[0]?.name
    return typeof name === "string" && name.trim() ? name.trim() : null
  }
  if (typeof insuranceVariants === "object" && insuranceVariants !== null && "name" in insuranceVariants) {
    const name = (insuranceVariants as { name?: unknown }).name
    return typeof name === "string" && name.trim() ? name.trim() : null
  }
  return null
}

/** Nazwa pliku w załączniku / logach — tylko ASCII (nagłówki HTTP nie przyjmują PL znaków). */
function slugifyVariantForFilename(name: string): string {
  const slug = name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/gi, "l")
    .replace(/%/g, "pct")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
  return slug || "wariant"
}

async function getVariantName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  type: number,
  variantId?: string | null
): Promise<string> {
  // Bez !inner filtr po insurance_variants.type często nie działa w PostgREST
  // i zapytanie kończy się pustym wynikiem / błędem .single().
  let query = supabase
    .from("trip_insurance_variants")
    .select("insurance_variants!inner ( id, name, type )")
    .eq("trip_id", tripId)
    .eq("is_enabled", true)
    .eq("insurance_variants.type", type)

  if (variantId) {
    query = query.eq("variant_id", variantId)
  }

  const { data, error } = await query

  if (error) {
    console.error("getVariantName error:", error)
    return ""
  }

  const names = (data || [])
    .map((row: { insurance_variants?: unknown }) => extractVariantName(row.insurance_variants))
    .filter((name: string | null): name is string => Boolean(name))

  return [...new Set(names)].join(", ")
}

async function buildKrContractList(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  variantId?: string | null,
  participantInsuranceIds: string[] = []
): Promise<string> {
  const useSelectedIds = participantInsuranceIds.length > 0

  let tvQuery = supabase
    .from("trip_insurance_variants")
    .select("id, insurance_variants!inner ( type )")
    .eq("trip_id", tripId)
    .eq("insurance_variants.type", 3)

  if (variantId) {
    tvQuery = tvQuery.eq("variant_id", variantId)
  }

  const { data: tripVariants } = await tvQuery

  const tripVariantIds = (tripVariants || []).map((tv: { id: string }) => tv.id)
  if (tripVariantIds.length === 0) return ""

  let query = supabase
    .from("participant_insurances")
    .select(`
      purchased_at,
      bookings (
        agreements:agreements(agreement_seq),
        trips:trips(reservation_number)
      ),
      trip_insurance_variants ( insurance_variants ( name ) )
    `)
    .in("trip_insurance_variant_id", tripVariantIds)
    .neq("status", "cancelled")

  if (useSelectedIds) {
    query = query.in("id", participantInsuranceIds)
  } else {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const from = yesterday.toISOString().split("T")[0] + "T00:00:00.000Z"
    const to = yesterday.toISOString().split("T")[0] + "T23:59:59.999Z"
    query = query.gte("purchased_at", from).lte("purchased_at", to)
  }

  const { data } = await query

  if (!data || data.length === 0) {
    return useSelectedIds
      ? "Brak zaznaczonych ubezpieczeń KR."
      : "Brak ubezpieczeń KR z poprzedniego dnia."
  }

  return (data as Array<{
    bookings: {
      agreements?: { agreement_seq?: number | null } | Array<{ agreement_seq?: number | null }> | null
      trips?: { reservation_number?: string | null } | Array<{ reservation_number?: string | null }> | null
    } | null
    trip_insurance_variants: { insurance_variants: { name: string } } | null
  }>)
    .map((pi) => {
      const b = pi.bookings
      const trip = Array.isArray(b?.trips) ? b.trips[0] : b?.trips
      const agreements = Array.isArray(b?.agreements)
        ? b.agreements
        : b?.agreements
          ? [b.agreements]
          : []
      const seq =
        agreements
          .map((a) => a?.agreement_seq ?? 0)
          .filter((n) => n > 0)
          .sort((a, c) => c - a)[0] ?? null
      const agreementNumber = formatPublicAgreementNumber({
        reservationNumber: trip?.reservation_number ?? null,
        agreementSeq: seq,
      })
      const ref = agreementNumber === "-" ? "—" : agreementNumber
      const variant = pi.trip_insurance_variants?.insurance_variants?.name || "—"
      return `• Umowa ${ref} — ${variant}`
    })
    .join("\n")
}

type XlsxParticipantRow = {
  first_name: string
  last_name: string
  date_of_birth: string | null
  agreement_number: string
  insurance_variant: string
}

function resolveVariantNameFromParticipantInsurance(
  pi: {
    trip_insurance_variants?:
      | { insurance_variants?: unknown }
      | Array<{ insurance_variants?: unknown }>
      | null
  },
  fallback = ""
): string {
  const tiv = pi?.trip_insurance_variants
  const tivObj = Array.isArray(tiv) ? tiv[0] : tiv
  return extractVariantName(tivObj?.insurance_variants) || fallback
}

function resolveAgreementNumberFromBooking(booking: unknown): string {
  const b = booking as {
    agreements?: { agreement_seq?: number | null } | Array<{ agreement_seq?: number | null }> | null
    trips?: { reservation_number?: string | null } | Array<{ reservation_number?: string | null }> | null
  } | null

  if (!b) return ""
  const trip = Array.isArray(b.trips) ? b.trips[0] : b.trips
  const agreements = Array.isArray(b.agreements)
    ? b.agreements
    : b.agreements
      ? [b.agreements]
      : []
  const seq =
    agreements
      .map((a) => a?.agreement_seq ?? 0)
      .filter((n) => n > 0)
      .sort((a, c) => c - a)[0] ?? null
  const formatted = formatPublicAgreementNumber({
    reservationNumber: trip?.reservation_number ?? null,
    agreementSeq: seq,
  })
  return formatted === "-" ? "" : formatted
}

async function buildXlsx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  insuranceType: number,
  tripSlug: string | null,
  variantId?: string | null,
  variantName?: string | null,
  participantInsuranceIds: string[] = []
): Promise<{
  participants: XlsxParticipantRow[]
  xlsxBuffer: ArrayBuffer
  xlsxFilename: string
}> {
  let participants: XlsxParticipantRow[] = []
  const useSelectedIds = participantInsuranceIds.length > 0
  const resolvedVariantName =
    (typeof variantName === "string" && variantName.trim() ? variantName.trim() : "") ||
    (await getVariantName(supabase, tripId, insuranceType, variantId))

  if (insuranceType === 1) {
    const { data } = await supabase
      .from("participants")
      .select(`
        first_name,
        last_name,
        birth_date,
        bookings!inner (
          trip_id,
          status,
          agreements:agreements(agreement_seq),
          trips:trips(reservation_number)
        )
      `)
      .eq("bookings.trip_id", tripId)
      .neq("bookings.status", "cancelled")
      .eq("is_active", true)

    participants = (data || []).map((p: {
      first_name: string
      last_name: string
      birth_date: string | null
      bookings?: unknown
    }) => ({
      first_name: p.first_name,
      last_name: p.last_name,
      date_of_birth: p.birth_date,
      agreement_number: resolveAgreementNumberFromBooking(
        Array.isArray(p.bookings) ? p.bookings[0] : p.bookings
      ),
      insurance_variant: resolvedVariantName,
    }))

    const extraPersons = await listType1ExtraPersons(supabase, tripId)
    participants.push(...type1ExtraPersonsToXlsxRows(extraPersons, resolvedVariantName))
  } else {
    let tvQuery = supabase
      .from("trip_insurance_variants")
      .select("id, insurance_variants!inner ( type )")
      .eq("trip_id", tripId)
      .eq("insurance_variants.type", insuranceType)

    if (variantId) {
      tvQuery = tvQuery.eq("variant_id", variantId)
    }

    const { data: tripVariants } = await tvQuery

    const tripVariantIds = (tripVariants || []).map((tv: { id: string }) => tv.id)

    if (tripVariantIds.length > 0) {
      let query = supabase
        .from("participant_insurances")
        .select(`
          participants ( first_name, last_name, birth_date, is_active ),
          bookings (
            agreements:agreements(agreement_seq),
            trips:trips(reservation_number)
          ),
          trip_insurance_variants (
            insurance_variants ( name )
          )
        `)
        .in("trip_insurance_variant_id", tripVariantIds)
        .neq("status", "cancelled")

      if (useSelectedIds) {
        query = query.in("id", participantInsuranceIds)
      } else if (insuranceType === 3) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const from = yesterday.toISOString().split("T")[0] + "T00:00:00.000Z"
        const to = yesterday.toISOString().split("T")[0] + "T23:59:59.999Z"
        query = query.gte("purchased_at", from).lte("purchased_at", to)
      }

      const { data } = await query
      const toParticipantRows = (pi: any): XlsxParticipantRow[] => {
        const agreementNumber = resolveAgreementNumberFromBooking(
          Array.isArray(pi?.bookings) ? pi.bookings[0] : pi?.bookings
        )
        const rowVariantName = resolveVariantNameFromParticipantInsurance(pi, resolvedVariantName)
        const p = pi?.participants as
          | { first_name?: string; last_name?: string; birth_date?: string | null; is_active?: boolean | null }
          | Array<{ first_name?: string; last_name?: string; birth_date?: string | null; is_active?: boolean | null }>
          | null
          | undefined

        if (!p) return []
        const arr = Array.isArray(p) ? p : [p]
        return arr
          .filter((x) => x && x.is_active !== false)
          .map((x) => ({
            first_name: String(x?.first_name ?? ""),
            last_name: String(x?.last_name ?? ""),
            date_of_birth: (x?.birth_date ?? null) as string | null,
            agreement_number: agreementNumber,
            insurance_variant: rowVariantName,
          }))
      }

      participants = (data || []).flatMap(toParticipantRows)
    }
  }

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Uczestnicy")
  sheet.columns = [
    { header: "Imię", key: "first_name", width: 20 },
    { header: "Nazwisko", key: "last_name", width: 25 },
    { header: "Data urodzenia", key: "date_of_birth", width: 18 },
    { header: "Numer umowy/rezerwacji", key: "agreement_number", width: 24 },
    { header: "Wariant ubezpieczenia", key: "insurance_variant", width: 28 },
  ]
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FE" } }

  participants.forEach((p) => {
    sheet.addRow({
      first_name: p.first_name || "",
      last_name: p.last_name || "",
      date_of_birth: p.date_of_birth ? new Date(p.date_of_birth).toISOString().split("T")[0] : "",
      agreement_number: p.agreement_number || "",
      insurance_variant: p.insurance_variant || "",
    })
  })

  const xlsxBuffer = await workbook.xlsx.writeBuffer()
  const typeLabels: Record<number, string> = { 1: "podstawowe", 2: "dodatkowe", 3: "KR" }
  const variantSlug = variantName ? `_${slugifyVariantForFilename(variantName)}` : ""
  const xlsxFilename = `ubezpieczenie_${typeLabels[insuranceType]}${variantSlug}_${tripSlug || tripId.slice(0, 8)}_${new Date().toISOString().split("T")[0]}.xlsx`

  return { participants, xlsxBuffer, xlsxFilename }
}
