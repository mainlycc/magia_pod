import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ParticipantDetailPage(props: PageProps) {
  const params = await props.params;
  const supabase = await createClient();

  const { data: participant, error } = await supabase
    .from("participants")
    .select(
      `
      id,
      first_name,
      last_name,
      pesel,
      email,
      phone,
      address,
      booking_id,
      birth_date,
      notes,
      medical_info,
      consents_summary,
      group_name,
      bookings:bookings(
        id,
        booking_ref,
        status,
        payment_status,
        created_at,
        trip_id,
        trips:trips(
          id,
          title,
          start_date,
          end_date
        )
      )
    `,
    )
    .eq("id", params.id)
    .single();

  if (error || !participant) {
    return notFound();
  }

  const trips = Array.isArray((participant as any).bookings)
    ? (participant as any).bookings
    : (participant as any).bookings
    ? [(participant as any).bookings]
    : [];

  const formatDate = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleDateString("pl-PL") : "-";

  const age =
    participant.birth_date
      ? (() => {
          const d = new Date(participant.birth_date as string);
          if (Number.isNaN(d.getTime())) return null;
          const diffMs = Date.now() - d.getTime();
          const ageDt = new Date(diffMs);
          return Math.abs(ageDt.getUTCFullYear() - 1970);
        })()
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {participant.first_name} {participant.last_name}
          </h1>
          {participant.group_name && (
            <p className="text-sm text-muted-foreground mt-1">
              Grupa: {participant.group_name}
            </p>
          )}
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/uczestnicy">Powrót do listy</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 space-y-2">
          <h2 className="text-lg font-semibold">Dane osobowe</h2>
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">Imię i nazwisko: </span>
              {participant.first_name} {participant.last_name}
            </div>
            <div>
              <span className="font-medium">PESEL: </span>
              {participant.pesel || "-"}
            </div>
            <div>
              <span className="font-medium">Data urodzenia: </span>
              {participant.birth_date ? formatDate(participant.birth_date as string) : "-"}
              {age != null && ` (${age} lat)`}
            </div>
            <div>
              <span className="font-medium">E-mail: </span>
              {participant.email || "-"}
            </div>
            <div>
              <span className="font-medium">Telefon: </span>
              {participant.phone || "-"}
            </div>
            <div>
              <span className="font-medium">Adres: </span>
              {participant.address
                ? (() => {
                    const a = participant.address as any;
                    return [a.street, a.zip, a.city].filter(Boolean).join(", ");
                  })()
                : "-"}
            </div>
            <div>
              <span className="font-medium">Uwagi: </span>
              {participant.notes || "-"}
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <h2 className="text-lg font-semibold">Informacje o zgodach / medyczne</h2>
          <div className="text-sm space-y-2">
            <div>
              <span className="font-medium">Podsumowanie zgód: </span>
              {participant.consents_summary || (
                <span className="text-muted-foreground">brak opisowego podsumowania</span>
              )}
            </div>
            <div>
              <span className="font-medium">Informacje medyczne (opisowe): </span>
              {participant.medical_info || (
                <span className="text-muted-foreground">brak</span>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Historia wyjazdów</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Wyjazd</TableHead>
              <TableHead>Termin</TableHead>
              <TableHead>Nr rezerwacji</TableHead>
              <TableHead>Status rezerwacji</TableHead>
              <TableHead>Status płatności</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Brak powiązanych wyjazdów.
                </TableCell>
              </TableRow>
            )}
            {trips.map((booking: any) => {
              const trip = Array.isArray(booking.trips) ? booking.trips[0] : booking.trips;
              return (
                <TableRow key={booking.id}>
                  <TableCell>{trip?.title ?? "-"}</TableCell>
                  <TableCell>
                    {trip?.start_date
                      ? `${formatDate(trip.start_date)}${
                          trip.end_date ? ` — ${formatDate(trip.end_date)}` : ""
                        }`
                      : "-"}
                  </TableCell>
                  <TableCell>{booking.booking_ref}</TableCell>
                  <TableCell className="capitalize">{booking.status}</TableCell>
                  <TableCell className="capitalize">{booking.payment_status}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/bookings/${booking.id}`}>Szczegóły rezerwacji</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}


