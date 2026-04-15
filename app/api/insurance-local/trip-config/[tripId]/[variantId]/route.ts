import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; variantId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { tripId, variantId } = await params
    const body = await request.json()

    const allowed = ["price_grosz", "is_enabled"]
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { data, error } = await supabase
      .from("trip_insurance_variants")
      .update(updates)
      .eq("id", variantId)
      .eq("trip_id", tripId)
      .select(`
        id, trip_id, price_grosz, is_enabled, created_at,
        insurance_variants ( id, type, name, provider, description, is_default )
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (err) {
    console.error("PATCH /api/insurance-local/trip-config/[variantId] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; variantId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { tripId, variantId } = await params

    // Sprawdź czy nie ma zakupionych ubezpieczeń — jeśli tak, zablokuj usunięcie
    const { count } = await supabase
      .from("participant_insurances")
      .select("*", { count: "exact", head: true })
      .eq("trip_insurance_variant_id", variantId)
      .neq("status", "cancelled")

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Nie można usunąć wariantu — ${count} uczestnik(ów) ma aktywne ubezpieczenie` },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from("trip_insurance_variants")
      .delete()
      .eq("id", variantId)
      .eq("trip_id", tripId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/insurance-local/trip-config/[variantId] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
