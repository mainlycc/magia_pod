import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { subject, body } = await req.json();
    if (!subject || !body) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

    const supabase = await createClient();
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, contact_email")
      .eq("trip_id", params.id);

    const emails = Array.from(
      new Set(
        (bookings ?? [])
          .map((b) => b.contact_email as string | null)
          .filter((e): e is string => Boolean(e))
      )
    );

    if (emails.length === 0) return NextResponse.json({ ok: true });

    await Promise.all(
      emails.map((to) =>
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, text: body }),
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}


