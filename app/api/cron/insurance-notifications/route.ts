import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolvePublicBaseUrl } from "@/lib/url/resolve-public-base-url"

// GET /api/cron/insurance-notifications
// Wywoływane przez Vercel Cron codziennie o 09:00 UTC
// Mechanizm A (Typ 1 i 2): wycieczki startujące za 5 dni → XLSX + mail z szablonu (raz na wycieczkę/typ)
// Mechanizm B (Typ 3): raport KR za poprzedni dzień → osobno per wariant
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    if (!cronSecret) {
      console.warn(
        "Cron insurance-notifications: brak CRON_SECRET — ustaw zmienną środowiskową na Vercel"
      )
    }

    const supabase = createAdminClient()
    const baseUrl = resolvePublicBaseUrl(new URL(request.url).origin)

    const cronAuthHeaders: HeadersInit = {
      "Content-Type": "application/json",
    }
    if (cronSecret) {
      cronAuthHeaders.Authorization = `Bearer ${cronSecret}`
    } else if (authHeader) {
      cronAuthHeaders.Authorization = authHeader
    }

    const results: Array<{
      tripId: string
      type: number
      status: string
      variantId?: string
      participantsCount?: number
      error?: string
    }> = []

    // ── Mechanizm A: Typ 1 i 2 — wycieczki startujące za 5 dni ──────────────
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 5)
    const targetDateStr = targetDate.toISOString().split("T")[0]

    const { data: tripsToNotify, error: tripsError } = await supabase
      .from("trips")
      .select("id, title, slug, start_date, end_date")
      .eq("start_date", targetDateStr)

    if (tripsError) {
      console.error("Cron: błąd pobierania wycieczek (typ 1/2):", tripsError)
    }

    for (const trip of tripsToNotify || []) {
      for (const type of [1, 2] as const) {
        // Idempotencja: ten sam raport (wycieczka + typ) nie idzie drugi raz
        const { data: existingLog } = await supabase
          .from("insurance_email_logs")
          .select("id")
          .eq("trip_id", trip.id)
          .eq("insurance_type", type)
          .eq("status", "sent")
          .limit(1)
          .maybeSingle()

        if (existingLog) {
          results.push({ tripId: trip.id, type, status: "skipped_already_sent" })
          continue
        }

        const participantsCount = await countParticipantsForCron(supabase, trip.id, type)
        if (participantsCount === 0) {
          results.push({
            tripId: trip.id,
            type,
            status: "skipped_no_participants",
            participantsCount: 0,
          })
          continue
        }

        try {
          const res = await fetch(
            `${baseUrl}/api/insurance-local/send-email/${trip.id}/${type}`,
            {
              method: "POST",
              headers: cronAuthHeaders,
              body: JSON.stringify({ triggered_by: "cron" }),
            }
          )
          const data = await res.json().catch(() => ({}))
          if (res.ok) {
            results.push({
              tripId: trip.id,
              type,
              status: "sent",
              participantsCount: data.participants_count ?? participantsCount,
            })
          } else {
            results.push({
              tripId: trip.id,
              type,
              status: "error",
              participantsCount,
              error: data.error || `HTTP ${res.status}`,
            })
          }
        } catch (err) {
          results.push({
            tripId: trip.id,
            type,
            status: "error",
            participantsCount,
            error: String(err),
          })
        }
      }
    }

    // ── Mechanizm B: Typ 3 — osobne raporty KR per wariant za wczoraj ───────
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const from = yesterday.toISOString().split("T")[0] + "T00:00:00.000Z"
    const to = yesterday.toISOString().split("T")[0] + "T23:59:59.999Z"

    const { data: type3Data, error: type3Error } = await supabase
      .from("participant_insurances")
      .select(`
        trip_insurance_variants (
          trip_id,
          variant_id,
          insurance_variants!inner ( id, type )
        )
      `)
      .gte("purchased_at", from)
      .lte("purchased_at", to)
      .neq("status", "cancelled")
      .eq("trip_insurance_variants.insurance_variants.type", 3)

    if (type3Error) {
      console.error("Cron: błąd pobierania KR:", type3Error)
    }

    type TripVariantPair = { tripId: string; variantId: string }

    const extractTripVariantPairs = (pi: any): TripVariantPair[] => {
      const tiv = pi?.trip_insurance_variants as
        | {
            trip_id?: string | null
            variant_id?: string | null
            insurance_variants?: { id?: string | null } | Array<{ id?: string | null }> | null
          }
        | Array<{
            trip_id?: string | null
            variant_id?: string | null
            insurance_variants?: { id?: string | null } | Array<{ id?: string | null }> | null
          }>
        | null
        | undefined

      if (!tiv) return []

      const rows = Array.isArray(tiv) ? tiv : [tiv]
      return rows
        .map((row) => {
          const tripId = row?.trip_id ?? null
          const fromJoin = Array.isArray(row?.insurance_variants)
            ? row.insurance_variants[0]?.id
            : row?.insurance_variants?.id
          const variantId = row?.variant_id || fromJoin || null
          if (!tripId || !variantId) return null
          return { tripId, variantId }
        })
        .filter((x): x is TripVariantPair => Boolean(x))
    }

    const uniquePairs = [
      ...new Map(
        (type3Data || [])
          .flatMap(extractTripVariantPairs)
          .map((p) => [`${p.tripId}:${p.variantId}`, p] as const)
      ).values(),
    ]

    for (const { tripId, variantId } of uniquePairs) {
      try {
        const res = await fetch(
          `${baseUrl}/api/insurance-local/send-email/${tripId}/3`,
          {
            method: "POST",
            headers: cronAuthHeaders,
            body: JSON.stringify({ triggered_by: "cron", variant_id: variantId }),
          }
        )
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          results.push({ tripId, type: 3, status: "sent", variantId })
        } else {
          results.push({
            tripId,
            type: 3,
            status: "error",
            variantId,
            error: data.error || `HTTP ${res.status}`,
          })
        }
      } catch (err) {
        results.push({
          tripId,
          type: 3,
          status: "error",
          variantId,
          error: String(err),
        })
      }
    }

    console.log("Cron insurance-notifications wyniki:", results)

    return NextResponse.json({
      ok: true,
      processed: results.length,
      baseUrl,
      targetStartDateType12: targetDateStr,
      results,
    })
  } catch (err) {
    console.error("GET /api/cron/insurance-notifications error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Liczba osób do raportu: typ 1 = wszyscy aktywni; typ 2 = tylko z wykupionym ubezp. */
async function countParticipantsForCron(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  type: 1 | 2
): Promise<number> {
  if (type === 1) {
    const { count, error } = await supabase
      .from("participants")
      .select("id, bookings!inner ( trip_id, status )", { count: "exact", head: true })
      .eq("bookings.trip_id", tripId)
      .neq("bookings.status", "cancelled")
      .eq("is_active", true)

    if (error) {
      console.error("Cron: błąd liczenia uczestników typ 1:", error)
      return 0
    }
    return count ?? 0
  }

  const { data: tripVariants, error: tvError } = await supabase
    .from("trip_insurance_variants")
    .select("id, insurance_variants!inner ( type )")
    .eq("trip_id", tripId)
    .eq("insurance_variants.type", 2)

  if (tvError) {
    console.error("Cron: błąd wariantów typ 2:", tvError)
    return 0
  }

  const tripVariantIds = (tripVariants || []).map((tv: { id: string }) => tv.id)
  if (tripVariantIds.length === 0) return 0

  const { count, error } = await supabase
    .from("participant_insurances")
    .select("id", { count: "exact", head: true })
    .in("trip_insurance_variant_id", tripVariantIds)
    .neq("status", "cancelled")

  if (error) {
    console.error("Cron: błąd liczenia ubezpieczeń typ 2:", error)
    return 0
  }
  return count ?? 0
}
