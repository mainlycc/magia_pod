import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return profile?.role === "admin";
}

export async function POST(request: NextRequest) {
  try {
    const { coordinatorIds } = await request.json();

    if (!coordinatorIds || !Array.isArray(coordinatorIds) || coordinatorIds.length === 0) {
      return NextResponse.json({ error: "missing_coordinator_ids" }, { status: 400 });
    }

    const supabase = await createClient();

    // Sprawdź czy użytkownik jest adminem
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Sprawdź czy próbujemy usunąć siebie samego
    const { data: { user } } = await supabase.auth.getUser();
    if (user && coordinatorIds.includes(user.id)) {
      return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
    }

    // Usuń konta użytkowników (profiles zostaną usunięte przez CASCADE)
    const adminClient = createAdminClient();
    
    for (const coordinatorId of coordinatorIds) {
      const { error } = await adminClient.auth.admin.deleteUser(coordinatorId);
      if (error) {
        console.error(`Failed to delete coordinator ${coordinatorId}:`, error);
        // Kontynuuj usuwanie pozostałych, nawet jeśli jeden się nie powiedzie
      }
    }

    return NextResponse.json({ ok: true, deleted: coordinatorIds.length });
  } catch (error) {
    console.error("Error deleting coordinators:", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

