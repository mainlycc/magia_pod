import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/cron/insurance-notifications
// Wywoływane przez Vercel Cron codziennie o 09:00
// 1. Typ 1 i 2: wycieczki startujące za 5 dni → wyślij emaile (jeśli jeszcze nie wysłane dziś)
// 2. Typ 3: raport za poprzedni dzień → wyślij email
export async function GET(request: NextRequest) {
  try {
    // Weryfikacja tokenu cron (opcjonalna, ale zalecana)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()

    const results: Array<{ tripId: string; type: number; status: string; error?: string }> = []

    // 1. Znajdź wycieczki startujące za 5 dni
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 5)
    const targetDateStr = targetDate.toISOString().split("T")[0]

    const { data: tripsToNotify, error: tripsError } = await supabase
      .from("trips")
      .select("id, title, slug, start_date, end_date")
      .eq("start_date", targetDateStr)

    if (tripsError) {
      console.error("Cron: błąd pobierania wycieczek:", tripsError)
    }

    const todayStr = new Date().toISOString().split("T")[0]

    for (const trip of tripsToNotify || []) {
      for (const type of [1, 2]) {
        // Sprawdź czy email dla tej wycieczki i typu był już wysłany dziś
        const { data: existingLog } = await supabase
          .from("insurance_email_logs")
          .select("id")
          .eq("trip_id", trip.id)
          .eq("insurance_type", type)
          .eq("status", "sent")
          .gte("sent_at", todayStr + "T00:00:00.000Z")
          .limit(1)
          .single()

        if (existingLog) {
          results.push({ tripId: trip.id, type, status: "skipped_already_sent" })
          continue
        }

        // Wyślij email
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        try {
          const res = await fetch(
            `${baseUrl}/api/insurance-local/send-email/${trip.id}/${type}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ triggered_by: "cron" }),
            }
          )
          const data = await res.json()
          if (res.ok) {
            results.push({ tripId: trip.id, type, status: "sent" })
          } else {
            results.push({ tripId: trip.id, type, status: "error", error: data.error })
          }
        } catch (err) {
          results.push({ tripId: trip.id, type, status: "error", error: String(err) })
        }
      }
    }

    // 2. Typ 3: znajdź wszystkie wycieczki z aktywnymi ubezpieczeniami KR zakupionymi wczoraj
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const from = yesterday.toISOString().split("T")[0] + "T00:00:00.000Z"
    const to = yesterday.toISOString().split("T")[0] + "T23:59:59.999Z"

    const { data: type3Data } = await supabase
      .from("participant_insurances")
      .select(`
        trip_insurance_variants (
          trip_id,
          insurance_variants!inner ( type )
        )
      `)
      .gte("purchased_at", from)
      .lte("purchased_at", to)
      .neq("status", "cancelled")
      .eq("trip_insurance_variants.insurance_variants.type", 3)

    const extractTripIds = (pi: any): string[] => {
      const tiv = pi?.trip_insurance_variants as
        | { trip_id?: string | null }
        | Array<{ trip_id?: string | null }>
        | null
        | undefined

      if (!tiv) return []
      if (Array.isArray(tiv)) {
        return tiv
          .map((x) => x?.trip_id ?? null)
          .filter((id): id is string => Boolean(id))
      }
      return [tiv.trip_id ?? null].filter((id): id is string => Boolean(id))
    }

    const uniqueTripIds = [
      ...new Set(
        (type3Data || []).flatMap(extractTripIds)
      ),
    ]

    for (const tripId of uniqueTripIds) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      try {
        const res = await fetch(
          `${baseUrl}/api/insurance-local/send-email/${tripId}/3`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ triggered_by: "cron" }),
          }
        )
        const data = await res.json()
        if (res.ok) {
          results.push({ tripId, type: 3, status: "sent" })
        } else {
          results.push({ tripId, type: 3, status: "error", error: data.error })
        }
      } catch (err) {
        results.push({ tripId, type: 3, status: "error", error: String(err) })
      }
    }

    console.log("Cron insurance-notifications wyniki:", results)

    return NextResponse.json({ ok: true, processed: results.length, results })
  } catch (err) {
    console.error("GET /api/cron/insurance-notifications error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
