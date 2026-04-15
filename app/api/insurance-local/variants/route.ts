import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const activeOnly = searchParams.get("active_only") !== "false"

    let query = supabase
      .from("insurance_variants")
      .select("*")
      .order("type", { ascending: true })
      .order("is_default", { ascending: false })
      .order("name", { ascending: true })

    if (type) query = query.eq("type", parseInt(type))
    if (activeOnly) query = query.eq("is_active", true)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (err) {
    console.error("GET /api/insurance-local/variants error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const body = await request.json()
    const { type, name, provider, description, is_default } = body

    if (!type || !name || !provider) {
      return NextResponse.json({ error: "type, name, provider są wymagane" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("insurance_variants")
      .insert({ type, name, provider, description: description || null, is_default: is_default || false })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error("POST /api/insurance-local/variants error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
