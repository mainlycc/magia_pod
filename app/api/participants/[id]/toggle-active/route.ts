import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims()
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub
  if (!userId) return false

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single()

  return profile?.role === "admin"
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    const isAdmin = await checkAdmin(supabase)
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 })
    }

    const adminClient = createAdminClient()
    const { data: participant, error: fetchError } = await adminClient
      .from("participants")
      .select("id, is_active")
      .eq("id", id)
      .single()

    if (fetchError || !participant) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    const newIsActive = participant.is_active === false
    const { error: updateError } = await adminClient
      .from("participants")
      .update({ is_active: newIsActive })
      .eq("id", id)

    if (updateError) {
      console.error("Error toggling participant active:", updateError)
      return NextResponse.json({ error: "update_failed" }, { status: 500 })
    }

    return NextResponse.json({ id, is_active: newIsActive })
  } catch (err) {
    console.error("Error in POST /api/participants/[id]/toggle-active:", err)
    return NextResponse.json({ error: "unexpected" }, { status: 500 })
  }
}
