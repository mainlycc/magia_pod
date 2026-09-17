import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type BookingRow = { id: string; booking_ref: string | null; payment_status: string | null };
type ParticipantRow = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  booking_id: string;
};

export default async function CoordParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tripId } = await params;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;

  if (!userId) {
    return <Card className="p-5 text-sm text-red-600">Brak autoryzacji.</Card>;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("allowed_trip_ids")
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error("Coord participants profile error", profileError);
    return <Card className="p-5 text-sm text-red-600">Nie udało się pobrać uczestników.</Card>;
  }

  const allowedTrips = (profile?.allowed_trip_ids as string[] | null) ?? [];
  if (!allowedTrips.includes(tripId)) {
    return <Card className="p-5 text-sm text-red-600">Nie masz dostępu do tej wycieczki.</Card>;
  }

  const adminSupabase = createAdminClient();
  const { data: bookings, error: bookingsError } = await adminSupabase
    .from("bookings")
    .select("id, booking_ref, payment_status")
    .eq("trip_id", tripId);

  if (bookingsError) {
    console.error("Coord participants bookings error", bookingsError);
    return <Card className="p-5 text-sm text-red-600">Nie udało się pobrać uczestników.</Card>;
  }

  const bookingRows = (bookings ?? []) as BookingRow[];
  const bookingIds = bookingRows.map((b) => b.id);
  let participants: ParticipantRow[] = [];

  if (bookingIds.length) {
    const { data: participantsData, error: participantsError } = await adminSupabase
      .from("participants")
      .select("first_name,last_name,email,phone,booking_id")
      .in("booking_id", bookingIds)
      .eq("is_active", true);

    if (participantsError) {
      console.error("Coord participants list error", participantsError);
      return <Card className="p-5 text-sm text-red-600">Nie udało się pobrać uczestników.</Card>;
    }

    participants = (participantsData ?? []) as ParticipantRow[];
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href={`/coord/trips/${tripId}/message`}>Wyślij wiadomość grupową</Link>
        </Button>
      </div>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Status płatności</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((p, idx) => {
              const b = bookingRows.find((bb) => bb.id === p.booking_id);
              return (
                <TableRow key={idx}>
                  <TableCell>
                    {p.first_name} {p.last_name}
                  </TableCell>
                  <TableCell>{p.email ?? "-"}</TableCell>
                  <TableCell>{p.phone ?? "-"}</TableCell>
                  <TableCell className="capitalize">{b?.payment_status ?? "unpaid"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
