import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type BookingRow = {
  id: string;
  booking_ref: string;
  contact_email: string | null;
  payment_status: string | null;
  created_at: string | null;
};

export default async function AdminTripBookingsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, booking_ref, contact_email, payment_status, created_at")
    .eq("trip_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Rezerwacje</h1>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status płatności</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(bookings ?? []).map((b: BookingRow) => (
              <TableRow key={b.id}>
                <TableCell>{b.booking_ref}</TableCell>
                <TableCell>{b.contact_email}</TableCell>
                <TableCell className="capitalize">{b.payment_status}</TableCell>
                <TableCell>{b.created_at ? new Date(b.created_at).toLocaleString() : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}


