import Link from "next/link";
import { headers } from "next/headers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ParticipantsResponse = {
  bookings: Array<{ id: string; booking_ref: string | null; payment_status: string | null }>;
  participants: Array<{
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    booking_id: string;
  }>;
  error?: string;
};

export default async function CoordParticipantsPage({ params }: { params: { id: string } }) {
  const tripId = params.id;
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const apiUrl = baseUrl ? `${baseUrl}/api/coord/trips/${tripId}/participants` : `/api/coord/trips/${tripId}/participants`;

  const res = await fetch(apiUrl, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ParticipantsResponse;
    const msg =
      body.error === "forbidden"
        ? "Nie masz dostępu do tej wycieczki."
        : body.error === "unauthorized"
          ? "Brak autoryzacji."
          : "Nie udało się pobrać uczestników.";
    return <Card className="p-5 text-sm text-red-600">{msg}</Card>;
  }

  const { bookings, participants } = (await res.json()) as ParticipantsResponse;

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
              const b = bookings.find((bb) => bb.id === p.booking_id);
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
