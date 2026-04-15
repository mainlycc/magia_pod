import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET ?trip_id=&type=&limit=
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get("trip_id")
    const type = searchParams.get("type")
    const limit = parseInt(searchParams.get("limit") || "20")

    let query = supabase
      .from("insurance_email_logs")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(limit)

    if (tripId) query = query.eq("trip_id", tripId)
    if (type) query = query.eq("insurance_type", parseInt(type))

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (err) {
    console.error("GET /api/insurance-local/email-logs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
