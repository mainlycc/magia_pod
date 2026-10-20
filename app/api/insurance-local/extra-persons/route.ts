import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { parseType1ExtraPersonInput } from "@/lib/insurance-local/type1-extra-persons"

// GET /api/insurance-local/extra-persons?trip_id=
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const tripId = new URL(request.url).searchParams.get("trip_id")?.trim()
    if (!tripId) {
      return NextResponse.json({ error: "trip_id jest wymagane" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("insurance_type1_extra_persons")
      .select("id, trip_id, first_name, last_name, birth_date, created_at, updated_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error("GET /api/insurance-local/extra-persons error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST — dopisz osobę tylko do listy ubezpieczenia typu 1
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const tripId = typeof body?.trip_id === "string" ? body.trip_id.trim() : ""
    if (!tripId) {
      return NextResponse.json({ error: "trip_id jest wymagane" }, { status: 400 })
    }

    const parsed = parseType1ExtraPersonInput(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("insurance_type1_extra_persons")
      .insert({
        trip_id: tripId,
        ...parsed.value,
      })
      .select("id, trip_id, first_name, last_name, birth_date, created_at, updated_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (err) {
    console.error("POST /api/insurance-local/extra-persons error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
