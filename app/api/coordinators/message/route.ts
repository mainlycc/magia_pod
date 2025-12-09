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
    const { coordinatorIds, subject, body } = await request.json();

    if (!coordinatorIds || !Array.isArray(coordinatorIds) || coordinatorIds.length === 0) {
      return NextResponse.json({ error: "missing_coordinator_ids" }, { status: 400 });
    }

    if (!subject || !body) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const supabase = await createClient();

    // Sprawdź czy użytkownik jest adminem
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Pobierz emaile koordynatorów z auth.users
    const adminClient = createAdminClient();
    const { data: usersData } = await adminClient.auth.admin.listUsers();

    const emails = coordinatorIds
      .map((id) => {
        const user = usersData.users.find((u) => u.id === id);
        return user?.email;
      })
      .filter((email): email is string => Boolean(email));

    if (emails.length === 0) {
      return NextResponse.json({ error: "no_emails" }, { status: 400 });
    }

    // Wyślij emaile do wszystkich koordynatorów
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    
    await Promise.all(
      emails.map((to) =>
        fetch(`${baseUrl}/api/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, text: body }),
        })
      )
    );

    return NextResponse.json({ ok: true, sent: emails.length });
  } catch (error) {
    console.error("Error sending messages:", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

