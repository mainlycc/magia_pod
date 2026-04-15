import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/insurance-local/trip-config/[tripId]
// Zwraca pełną konfigurację ubezpieczeń dla wycieczki (wszystkie 3 typy)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { tripId } = await params

    const { data, error } = await supabase
      .from("trip_insurance_variants")
      .select(`
        id,
        trip_id,
        price_grosz,
        is_enabled,
        created_at,
        updated_at,
        insurance_variants (
          id,
          type,
          name,
          provider,
          description,
          is_default
        )
      `)
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (err) {
    console.error("GET /api/insurance-local/trip-config error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST — dodaj wariant do wycieczki
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { tripId } = await params
    const body = await request.json()
    const { variant_id, price_grosz } = body

    if (!variant_id) {
      return NextResponse.json({ error: "variant_id jest wymagane" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("trip_insurance_variants")
      .insert({
        trip_id: tripId,
        variant_id,
        price_grosz: price_grosz ?? null,
        is_enabled: true,
      })
      .select(`
        id, trip_id, price_grosz, is_enabled, created_at,
        insurance_variants ( id, type, name, provider, description, is_default )
      `)
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ten wariant jest już przypisany do wycieczki" }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error("POST /api/insurance-local/trip-config error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
