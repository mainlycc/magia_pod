import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { shouldAutoCompleteTrip } from "@/lib/trips/trip-lifecycle"

/**
 * Cron: automatycznie oznacza minione aktywne wycieczki jako zrealizowane
 * (is_active = false). Idempotentne — ponowny run nie zmienia już
 * dezaktywowanych rekordów.
 *
 * GET /api/cron/complete-past-trips
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  if (!cronSecret) {
    console.warn(
      "Cron complete-past-trips: brak CRON_SECRET — ustaw zmienną środowiskową na Vercel",
    )
  }

  try {
    const admin = createAdminClient()
    const now = new Date()

    const { data: trips, error } = await admin
      .from("trips")
      .select("id, title, start_date, end_date, is_active")
      .eq("is_active", true)

    if (error) {
      console.error("complete-past-trips: fetch failed", error)
      return NextResponse.json(
        { error: "failed_to_fetch_trips", details: error.message },
        { status: 500 },
      )
    }

    const toComplete = (trips ?? []).filter((trip) =>
      shouldAutoCompleteTrip(trip, now),
    )

    if (toComplete.length === 0) {
      return NextResponse.json({
        ok: true,
        completed: 0,
        tripIds: [],
      })
    }

    const tripIds = toComplete.map((t) => t.id)
    const { error: updateError } = await admin
      .from("trips")
      .update({ is_active: false })
      .in("id", tripIds)

    if (updateError) {
      console.error("complete-past-trips: update failed", updateError)
      return NextResponse.json(
        { error: "failed_to_complete_trips", details: updateError.message },
        { status: 500 },
      )
    }

    console.log(
      "complete-past-trips: completed",
      toComplete.map((t) => ({ id: t.id, title: t.title })),
    )

    return NextResponse.json({
      ok: true,
      completed: tripIds.length,
      tripIds,
    })
  } catch (err) {
    console.error("complete-past-trips error:", err)
    return NextResponse.json(
      { error: "internal_error", details: String(err) },
      { status: 500 },
    )
  }
}
