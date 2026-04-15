import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")

    let query = supabase
      .from("insurance_email_templates")
      .select("*")
      .order("type", { ascending: true })

    if (type) query = query.eq("type", parseInt(type))

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (err) {
    console.error("GET /api/insurance-local/email-templates error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
