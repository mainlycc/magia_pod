import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import ExcelJS from "exceljs"
import { formatPublicAgreementNumber } from "@/lib/agreements/public-agreement-number"

type XlsxParticipantRow = {
  first_name: string
  last_name: string
  date_of_birth: string | null
  agreement_number: string
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

// GET /api/insurance-local/generate-xlsx/[tripId]/[type]
// Generuje plik XLSX z listą uczestników objętych ubezpieczeniem
// Typ 1: wszyscy uczestnicy wycieczki
// Typ 2: uczestnicy którzy kupili ubezpieczenie typu 2
// Typ 3: uczestnicy którzy kupili ubezpieczenie typu 3 (domyślnie: poprzedni dzień, lub ?date=YYYY-MM-DD)
export async function GET(
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

    const { searchParams } = new URL(request.url)
    const variantIdParam = searchParams.get("variant_id")?.trim() || null

    // Typ 3: XLSX per wariant (100% / 100% Max)
    if (insuranceType === 3 && !variantIdParam) {
      return NextResponse.json(
        { error: "Dla raportu KR (typ 3) wymagane jest variant_id" },
        { status: 400 }
      )
    }

    // Pobierz dane wycieczki
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, title, start_date, end_date, slug")
      .eq("id", tripId)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: "Wycieczka nie znaleziona" }, { status: 404 })
    }

    let variantName = ""
    if (variantIdParam) {
      const { data: variantRow, error: variantError } = await supabase
        .from("insurance_variants")
        .select("id, name, type")
        .eq("id", variantIdParam)
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
      variantName = typeof variantRow.name === "string" ? variantRow.name.trim() : ""
    }

    let participants: XlsxParticipantRow[] = []

    if (insuranceType === 1) {
      // Wszyscy aktywni uczestnicy wycieczki
      const { data, error } = await supabase
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

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      participants = (data || []).map((p) => ({
        first_name: p.first_name,
        last_name: p.last_name,
        date_of_birth: p.birth_date,
        agreement_number: resolveAgreementNumberFromBooking(
          Array.isArray(p.bookings) ? p.bookings[0] : p.bookings
        ),
      }))
    } else {
      // Pobierz ID wariantów dla tej wycieczki i danego typu (opcjonalnie konkretny wariant)
      let tvQuery = supabase
        .from("trip_insurance_variants")
        .select(`
          id,
          insurance_variants!inner ( type )
        `)
        .eq("trip_id", tripId)
        .eq("insurance_variants.type", insuranceType)

      if (variantIdParam) {
        tvQuery = tvQuery.eq("variant_id", variantIdParam)
      }

      const { data: tripVariants, error: tvError } = await tvQuery

      if (tvError) return NextResponse.json({ error: tvError.message }, { status: 500 })

      const tripVariantIds = (tripVariants || []).map((tv: { id: string }) => tv.id)

      if (tripVariantIds.length === 0) {
        participants = []
      } else {
        let piQuery = supabase
          .from("participant_insurances")
          .select(`
            participants (
              first_name,
              last_name,
              birth_date,
              is_active
            ),
            bookings (
              agreements:agreements(agreement_seq),
              trips:trips(reservation_number)
            )
          `)
          .in("trip_insurance_variant_id", tripVariantIds)
          .neq("status", "cancelled")

        // Typ 3: filtr po dacie zakupu
        if (insuranceType === 3) {
          const dateParam = searchParams.get("date")
          const targetDate = dateParam
            ? new Date(dateParam)
            : (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d })()

          const from = targetDate.toISOString().split("T")[0] + "T00:00:00.000Z"
          const to = targetDate.toISOString().split("T")[0] + "T23:59:59.999Z"
          piQuery = piQuery.gte("purchased_at", from).lte("purchased_at", to)
        }

        const { data: piData, error: piError } = await piQuery
        if (piError) return NextResponse.json({ error: piError.message }, { status: 500 })

        const toParticipantRows = (pi: any): XlsxParticipantRow[] => {
          const agreementNumber = resolveAgreementNumberFromBooking(
            Array.isArray(pi?.bookings) ? pi.bookings[0] : pi?.bookings
          )
          const p = pi?.participants as
            | { first_name?: string; last_name?: string; birth_date?: string | null; is_active?: boolean | null }
            | Array<{ first_name?: string; last_name?: string; birth_date?: string | null; is_active?: boolean | null }>
            | null
            | undefined

          if (!p) return []
          const arr = Array.isArray(p) ? p : [p]
          return arr
            .filter((x) => x && x.is_active !== false && (x.first_name || x.last_name || x.birth_date !== undefined))
            .map((x) => ({
              first_name: String(x.first_name ?? ""),
              last_name: String(x.last_name ?? ""),
              date_of_birth: x.birth_date ?? null,
              agreement_number: agreementNumber,
            }))
        }

        participants = (piData || []).flatMap(toParticipantRows)
      }
    }

    // Generuj XLSX
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Uczestnicy")

    sheet.columns = [
      { header: "Imię", key: "first_name", width: 20 },
      { header: "Nazwisko", key: "last_name", width: 25 },
      { header: "Data urodzenia", key: "date_of_birth", width: 18 },
      { header: "Numer umowy/rezerwacji", key: "agreement_number", width: 24 },
    ]

    // Styl nagłówka
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F0FE" },
    }

    participants.forEach((p) => {
      sheet.addRow({
        first_name: p.first_name || "",
        last_name: p.last_name || "",
        date_of_birth: p.date_of_birth
          ? new Date(p.date_of_birth).toISOString().split("T")[0]
          : "",
        agreement_number: p.agreement_number || "",
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()

    const typeLabels: Record<number, string> = {
      1: "podstawowe",
      2: "dodatkowe",
      3: "KR",
    }
    const variantSlug = variantName
      ? `_${variantName
          .replace(/%/g, "pct")
          .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+/gi, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "")}`
      : ""
    const filename = `ubezpieczenie_${typeLabels[insuranceType]}${variantSlug}_${trip.slug || tripId}_${new Date().toISOString().split("T")[0]}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Participants-Count": String(participants.length),
        "X-Filename": filename,
      },
    })
  } catch (err) {
    console.error("GET /api/insurance-local/generate-xlsx error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
