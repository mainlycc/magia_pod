import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET ?trip_id=&type=&page=1&pageSize=10
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get("trip_id")
    const type = searchParams.get("type")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || searchParams.get("limit") || "10", 10) || 10)
    )
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    async function runQuery(selectClause: string) {
      let query = supabase
        .from("insurance_email_logs")
        .select(selectClause, { count: "exact" })
        .order("sent_at", { ascending: false })
        .range(from, to)

      if (tripId) query = query.eq("trip_id", tripId)
      if (type) query = query.eq("insurance_type", parseInt(type))

      return query
    }

    let { data, error, count } = await runQuery("*, insurance_variants ( id, name )")

    if (error) {
      // Fallback gdy migracja 069 (variant_id) jeszcze nie jest wdrożona
      const fallback = await runQuery("*")
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 })
      }
      data = fallback.data
      count = fallback.count
    }

    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return NextResponse.json({
      data: data || [],
      total,
      page,
      pageSize,
      totalPages,
    })
  } catch (err) {
    console.error("GET /api/insurance-local/email-logs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
