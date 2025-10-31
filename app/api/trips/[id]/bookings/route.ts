import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, booking_ref, contact_email, payment_status")
    .eq("trip_id", params.id);
  const bookingIds = (bookings ?? []).map((b) => b.id);

  type Participant = {
    booking_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    pesel: string | null;
  };
  let participants: Participant[] = [];
  if (bookingIds.length) {
    const { data } = await supabase
      .from("participants")
      .select("booking_id, first_name, last_name, email, phone, pesel").in("booking_id", bookingIds);
    participants = (data as Participant[] | null) ?? [];
  }

  if (format === "csv") {
    const header = [
      "booking_ref",
      "payment_status",
      "first_name",
      "last_name",
      "email",
      "phone",
      "pesel",
    ];
    const rows = participants.map((p) => {
      const b = bookings?.find((bb) => bb.id === p.booking_id);
      return [
        b?.booking_ref ?? "",
        b?.payment_status ?? "",
        p.first_name ?? "",
        p.last_name ?? "",
        p.email ?? "",
        p.phone ?? "",
        p.pesel ?? "",
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=trip_${params.id}_participants.csv`,
      },
    });
  }

  return NextResponse.json({ bookings: bookings ?? [], participants });
}


