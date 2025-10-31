import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function CoordParticipantsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const tripId = params.id;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, booking_ref, payment_status")
    .eq("trip_id", tripId);

  const bookingIds = (bookings ?? []).map((b) => b.id);
  type ParticipantRow = {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    booking_id: string;
  };
  let participants: ParticipantRow[] = [];
  if (bookingIds.length) {
    const { data } = await supabase
      .from("participants")
      .select("first_name,last_name,email,phone,booking_id")
      .in("booking_id", bookingIds);
    participants = data ?? [];
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Uczestnicy</h1>
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
              const b = bookings?.find((bb) => bb.id === p.booking_id);
              return (
                <TableRow key={idx}>
                  <TableCell>{p.first_name} {p.last_name}</TableCell>
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


