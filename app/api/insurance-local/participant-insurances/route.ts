import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET ?trip_id=&type=&booking_id=
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get("trip_id")
    const type = searchParams.get("type")
    const bookingId = searchParams.get("booking_id")

    let query = supabase
      .from("participant_insurances")
      .select(`
        id,
        status,
        purchased_at,
        booking_id,
        participant_id,
        trip_insurance_variant_id,
        bookings (
          id,
          booking_ref,
          contact_email,
          contact_first_name,
          contact_last_name
        ),
        participants (
          id,
          first_name,
          last_name,
          date_of_birth,
          pesel
        ),
        trip_insurance_variants (
          id,
          price_grosz,
          insurance_variants (
            id,
            type,
            name,
            provider
          )
        )
      `)
      .order("purchased_at", { ascending: false })

    if (bookingId) {
      query = query.eq("booking_id", bookingId)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Filtruj po trip_id i type po stronie serwera (join przez trip_insurance_variants)
    let filtered = data || []
    if (tripId) {
      // Pobierz ID trip_insurance_variants dla tej wycieczki
      const { data: tripVariants } = await supabase
        .from("trip_insurance_variants")
        .select("id")
        .eq("trip_id", tripId)

      const variantIds = new Set((tripVariants || []).map((v) => v.id))
      filtered = filtered.filter((pi) => variantIds.has(pi.trip_insurance_variant_id))
    }

    if (type) {
      const wantedType = parseInt(type)
      filtered = filtered.filter((pi) => {
        const tiv = pi?.trip_insurance_variants as
          | { insurance_variants?: { type?: number | null } | Array<{ type?: number | null }> | null }
          | Array<{ insurance_variants?: { type?: number | null } | Array<{ type?: number | null }> | null }>
          | null
          | undefined

        if (!tiv) return false
        const tivArr = Array.isArray(tiv) ? tiv : [tiv]

        return tivArr.some((x) => {
          const iv = x?.insurance_variants as
            | { type?: number | null }
            | Array<{ type?: number | null }>
            | null
            | undefined

          if (!iv) return false
          if (Array.isArray(iv)) return iv.some((y) => y?.type === wantedType)
          return iv.type === wantedType
        })
      })
    }

    return NextResponse.json(filtered)
  } catch (err) {
    console.error("GET /api/insurance-local/participant-insurances error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const body = await request.json()
    const { booking_id, participant_id, trip_insurance_variant_id, status } = body

    if (!booking_id || !trip_insurance_variant_id) {
      return NextResponse.json({ error: "booking_id i trip_insurance_variant_id są wymagane" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("participant_insurances")
      .insert({
        booking_id,
        participant_id: participant_id || null,
        trip_insurance_variant_id,
        status: status || "purchased",
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error("POST /api/insurance-local/participant-insurances error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
