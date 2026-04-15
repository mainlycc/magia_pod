import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import ExcelJS from "exceljs"
import { Resend } from "resend"

// POST /api/insurance-local/send-email/[tripId]/[type]
// Generuje XLSX, wypełnia szablon emaila i wysyła
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; type: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { tripId, type } = await params
    const insuranceType = parseInt(type)

    if (![1, 2, 3].includes(insuranceType)) {
      return NextResponse.json({ error: "Typ musi być 1, 2 lub 3" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const triggeredBy: "manual" | "cron" = body.triggered_by || "manual"

    // 1. Pobierz dane wycieczki
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, title, start_date, end_date, slug")
      .eq("id", tripId)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: "Wycieczka nie znaleziona" }, { status: 404 })
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
      supabase, tripId, insuranceType, trip.slug
    )

    // 4. Wypełnij tagi w szablonie
    const termin = formatTripDates(trip.start_date, trip.end_date)
    const tags: Record<string, string> = {
      "{wariant_ubezpieczenia}": await getVariantName(supabase, tripId, insuranceType),
      "{termin_od_do}": termin,
      "{termin}": termin,
      "{kraj}": "", // TODO: dodać kraj do trips jeśli jest w schema
      "{tytul_wycieczki}": trip.title || "",
      "{kod_wycieczki}": trip.slug || tripId.slice(0, 8),
      "{liczba_osob}": String(participants.length),
      "{data_raportu}": new Date().toLocaleDateString("pl-PL"),
      "{data_poprzedniego_dnia}": (() => {
        const d = new Date(); d.setDate(d.getDate() - 1)
        return d.toLocaleDateString("pl-PL")
      })(),
      "{lista_umow}": "", // wypełniane dla typ 3
    }

    // Typ 3: lista umów
    if (insuranceType === 3) {
      tags["{lista_umow}"] = await buildKrContractList(supabase, tripId)
    }

    const subject = replaceTags(template.subject_template, tags)
    const bodyText = replaceTags(template.body_template, tags)
    const bodyHtml = `<div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333;">${bodyText.replace(/\n/g, "<br>")}</div>`

    // 5. Wyślij email przez Resend
    const apiKey = process.env.RESEND_API_KEY
    const senderName = process.env.RESEND_FROM_NAME || "Magia Podróży"
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

    await supabase.from("insurance_email_logs").insert({
      trip_id: tripId,
      insurance_type: insuranceType,
      recipients,
      xlsx_filename: xlsxFilename,
      participants_count: participants.length,
      status,
      error_message: errorMessage,
      triggered_by: triggeredBy,
    })

    if (sendError) {
      return NextResponse.json({ error: "Błąd wysyłki emaila", details: errorMessage }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      participants_count: participants.length,
      recipients,
      xlsx_filename: xlsxFilename,
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

function formatTripDates(start: string | null, end: string | null): string {
  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "?"
  return `${fmt(start)} – ${fmt(end)}`
}

async function getVariantName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  type: number
): Promise<string> {
  const { data } = await supabase
    .from("trip_insurance_variants")
    .select("insurance_variants ( name )")
    .eq("trip_id", tripId)
    .eq("is_enabled", true)
    .eq("insurance_variants.type", type)
    .limit(1)
    .single()

  return data?.insurance_variants?.name || ""
}

async function buildKrContractList(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string
): Promise<string> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const from = yesterday.toISOString().split("T")[0] + "T00:00:00.000Z"
  const to = yesterday.toISOString().split("T")[0] + "T23:59:59.999Z"

  const { data: tripVariants } = await supabase
    .from("trip_insurance_variants")
    .select("id, insurance_variants!inner ( type )")
    .eq("trip_id", tripId)
    .eq("insurance_variants.type", 3)

  const variantIds = (tripVariants || []).map((tv: { id: string }) => tv.id)
  if (variantIds.length === 0) return ""

  const { data } = await supabase
    .from("participant_insurances")
    .select(`
      purchased_at,
      bookings ( booking_ref ),
      trip_insurance_variants ( insurance_variants ( name ) )
    `)
    .in("trip_insurance_variant_id", variantIds)
    .gte("purchased_at", from)
    .lte("purchased_at", to)
    .neq("status", "cancelled")

  if (!data || data.length === 0) return "Brak ubezpieczeń KR z poprzedniego dnia."

  return (data as Array<{
    bookings: { booking_ref: string } | null
    trip_insurance_variants: { insurance_variants: { name: string } } | null
  }>)
    .map((pi) => {
      const ref = pi.bookings?.booking_ref || "—"
      const variant = pi.trip_insurance_variants?.insurance_variants?.name || "—"
      return `• Umowa #${ref} — ${variant}`
    })
    .join("\n")
}

async function buildXlsx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  insuranceType: number,
  tripSlug: string | null
): Promise<{
  participants: Array<{ first_name: string; last_name: string; date_of_birth: string | null }>
  xlsxBuffer: ArrayBuffer
  xlsxFilename: string
}> {
  let participants: Array<{ first_name: string; last_name: string; date_of_birth: string | null }> = []

  if (insuranceType === 1) {
    const { data } = await supabase
      .from("participants")
      .select("first_name, last_name, date_of_birth, bookings!inner ( trip_id, status )")
      .eq("bookings.trip_id", tripId)
      .neq("bookings.status", "cancelled")

    participants = (data || []).map((p: { first_name: string; last_name: string; date_of_birth: string | null }) => ({
      first_name: p.first_name,
      last_name: p.last_name,
      date_of_birth: p.date_of_birth,
    }))
  } else {
    const { data: tripVariants } = await supabase
      .from("trip_insurance_variants")
      .select("id, insurance_variants!inner ( type )")
      .eq("trip_id", tripId)
      .eq("insurance_variants.type", insuranceType)

    const variantIds = (tripVariants || []).map((tv: { id: string }) => tv.id)

    if (variantIds.length > 0) {
      let query = supabase
        .from("participant_insurances")
        .select("participants ( first_name, last_name, date_of_birth )")
        .in("trip_insurance_variant_id", variantIds)
        .neq("status", "cancelled")

      if (insuranceType === 3) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const from = yesterday.toISOString().split("T")[0] + "T00:00:00.000Z"
        const to = yesterday.toISOString().split("T")[0] + "T23:59:59.999Z"
        query = query.gte("purchased_at", from).lte("purchased_at", to)
      }

      const { data } = await query
      const toParticipantRows = (
        pi: any
      ): Array<{ first_name: string; last_name: string; date_of_birth: string | null }> => {
        const p = pi?.participants as
          | { first_name?: string; last_name?: string; date_of_birth?: string | null }
          | Array<{ first_name?: string; last_name?: string; date_of_birth?: string | null }>
          | null
          | undefined

        if (!p) return []
        const arr = Array.isArray(p) ? p : [p]
        return arr.map((x) => ({
          first_name: String(x?.first_name ?? ""),
          last_name: String(x?.last_name ?? ""),
          date_of_birth: (x?.date_of_birth ?? null) as string | null,
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
  ]
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FE" } }

  participants.forEach((p) => {
    sheet.addRow({
      first_name: p.first_name || "",
      last_name: p.last_name || "",
      date_of_birth: p.date_of_birth ? new Date(p.date_of_birth).toISOString().split("T")[0] : "",
    })
  })

  const xlsxBuffer = await workbook.xlsx.writeBuffer()
  const typeLabels: Record<number, string> = { 1: "podstawowe", 2: "dodatkowe", 3: "KR" }
  const xlsxFilename = `ubezpieczenie_${typeLabels[insuranceType]}_${tripSlug || tripId.slice(0, 8)}_${new Date().toISOString().split("T")[0]}.xlsx`

  return { participants, xlsxBuffer, xlsxFilename }
}
