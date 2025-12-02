import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPaymentStatusBadgeClass,
  getPaymentStatusLabel,
  type PaymentStatusValue,
} from "./payment-status";
import { PaymentStatusSelect } from "./payment-status-select";

type BookingRow = {
  id: string;
  booking_ref: string;
  contact_email: string | null;
  contact_phone: string | null;
  payment_status: PaymentStatusValue;
  created_at: string | null;
};

type ParticipantRow = {
  id: string;
  booking_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  pesel: string | null;
  document_type: string | null;
  document_number: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminTripBookingsPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = await (params instanceof Promise ? params : Promise.resolve(params));
  const supabase = await createClient();
  
  // Pobierz informacje o wycieczce
  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, start_date, end_date, slug")
    .eq("id", id)
    .single();

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select(
      "id, booking_ref, contact_email, contact_phone, payment_status, created_at",
    )
    .eq("trip_id", id)
    .order("created_at", { ascending: false });

  const bookings: BookingRow[] = (bookingsData ?? []).map((booking) => ({
    id: booking.id as string,
    booking_ref: booking.booking_ref as string,
    contact_email: booking.contact_email ?? null,
    contact_phone: booking.contact_phone ?? null,
    payment_status: (booking.payment_status ?? "unpaid") as PaymentStatusValue,
    created_at: booking.created_at ?? null,
  }));

  const bookingIds = bookings.map((booking) => booking.id);

  let participants: ParticipantRow[] = [];

  if (bookingIds.length) {
    const { data: participantsData } = await supabase
      .from("participants")
      .select(
        "id, booking_id, first_name, last_name, email, phone, pesel, document_type, document_number",
      )
      .in("booking_id", bookingIds);

    participants = (participantsData ?? []) as ParticipantRow[];
  }

  const participantsByBooking = new Map<string, ParticipantRow[]>();
  for (const participant of participants) {
    if (!participantsByBooking.has(participant.booking_id)) {
      participantsByBooking.set(participant.booking_id, []);
    }
    participantsByBooking.get(participant.booking_id)!.push(participant);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Rezerwacje</h1>
          {trip && (
            <div className="space-y-1">
              <p className="text-sm font-medium">{trip.title}</p>
              {trip.start_date && trip.end_date && (
                <p className="text-xs text-muted-foreground">
                  {new Date(trip.start_date).toLocaleDateString("pl-PL")} — {new Date(trip.end_date).toLocaleDateString("pl-PL")}
                </p>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Przegląd i zarządzanie rezerwacjami oraz uczestnikami wycieczki.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/trips">← Powrót do listy</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/api/trips/${id}/bookings?format=csv`}>
              Eksport CSV
            </Link>
          </Button>
        </div>
      </div>

      {bookings.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Brak rezerwacji dla tej wycieczki.
        </Card>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking: BookingRow) => {
            const bookingParticipants =
              participantsByBooking.get(booking.id) ?? [];

            const createdAtLabel = booking.created_at
              ? dateFormatter.format(new Date(booking.created_at))
              : "—";

            return (
              <Card key={booking.id} className="space-y-6 p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg font-semibold tracking-tight">
                        {booking.booking_ref}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border text-xs font-medium uppercase",
                          getPaymentStatusBadgeClass(booking.payment_status),
                        )}
                      >
                        {getPaymentStatusLabel(booking.payment_status)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Uczestnicy: {bookingParticipants.length}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Utworzono: {createdAtLabel}
                    </div>
                  </div>
                  <div className="grid gap-1 text-sm">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      Status płatności
                    </span>
                    <PaymentStatusSelect
                      bookingId={booking.id}
                      initialStatus={booking.payment_status}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      E-mail kontaktowy
                    </span>
                    <div>{booking.contact_email ?? "—"}</div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      Telefon kontaktowy
                    </span>
                    <div>{booking.contact_phone ?? "—"}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                      Uczestnicy
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {bookingParticipants.length
                        ? `${bookingParticipants.length} os.`
                        : "Brak uczestników"}
                    </span>
                  </div>

                  {bookingParticipants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Brak przypisanych uczestników.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Imię i nazwisko</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Telefon</TableHead>
                            <TableHead>PESEL</TableHead>
                            <TableHead>Dokument</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bookingParticipants.map((participant) => (
                            <TableRow key={participant.id}>
                              <TableCell className="font-medium">
                                {participant.first_name} {participant.last_name}
                              </TableCell>
                              <TableCell>
                                {participant.email && participant.email.length
                                  ? participant.email
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {participant.phone && participant.phone.length
                                  ? participant.phone
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {participant.pesel && participant.pesel.length
                                  ? participant.pesel
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {participant.document_type || participant.document_number
                                  ? `${participant.document_type ?? ""}${
                                      participant.document_number
                                        ? ` ${participant.document_number}`
                                        : ""
                                    }`.trim()
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
