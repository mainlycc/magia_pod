"use client";

import { use, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

/** Placeholdery tworzone przy zgłoszeniu firmy bez listy imion (booking-form). */
function isPlaceholderCompanyParticipants(
  participants: Array<{ last_name: string }>,
): boolean {
  if (participants.length === 0) return false;
  return participants.every((p) => p.last_name.trim() === "(dane do uzupełnienia)");
}

const DEFAULT_COMPANY_PARTICIPANTS_INFO =
  "Dane uczestników wyjazdu należy przekazać organizatorowi na adres mailowy: office@grupa-depl.com najpóźniej 7 dni przed wyjazdem. Lista powinna zawierać imię i nazwisko oraz datę urodzenia każdego uczestnika.";

type BookingData = {
  booking: {
    id: string;
    booking_ref: string;
    contact_email: string;
    contact_phone: string | null;
    address: any;
    status: string;
    payment_status: string;
    created_at: string;
    trip: {
      id: string;
      title: string;
      start_date: string | null;
      end_date: string | null;
      price_cents: number | null;
      company_participants_info?: string | null;
    };
    participants: Array<{
      id: string;
      first_name: string;
      last_name: string;
      pesel: string;
      email: string | null;
      phone: string | null;
    }>;
  };
};

export default function BookingPage({ params }: { params: Promise<{ token: string }> | { token: string } }) {
  const { token } = use(params instanceof Promise ? params : Promise.resolve(params));
  const searchParams = useSearchParams();
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await fetch(`/api/bookings/by-token/${token}`);
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Nie udało się pobrać danych rezerwacji");
        }
        const data = await response.json();
        setBookingData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Błąd podczas ładowania danych");
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [token]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !bookingData) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <Alert variant="destructive">
          <AlertTitle>Błąd</AlertTitle>
          <AlertDescription>{error || "Nie udało się załadować danych rezerwacji"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { booking } = bookingData;
  const totalPrice = (booking.trip.price_cents || 0) * booking.participants.length;
  const showDetailedParticipantList = !isPlaceholderCompanyParticipants(booking.participants);
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("pl-PL");
    } catch {
      return dateStr;
    }
  };

  const paymentStatusFromUrl = (searchParams.get("paymentStatus") || "").trim();
  const resolvedPaymentStatus = (paymentStatusFromUrl || booking.payment_status || "").toUpperCase();
  const paymentUi =
    resolvedPaymentStatus === "CONFIRMED" || resolvedPaymentStatus === "PAID"
      ? { label: "Płatność potwierdzona", variant: "default" as const }
      : resolvedPaymentStatus === "PENDING"
        ? { label: "Oczekuje na płatność", variant: "secondary" as const }
        : resolvedPaymentStatus
          ? { label: `Status płatności: ${resolvedPaymentStatus}`, variant: "outline" as const }
          : { label: "Status płatności: —", variant: "outline" as const };

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-b from-muted/60 to-background">
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Rezerwacja</p>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{booking.booking_ref}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={paymentUi.variant}>{paymentUi.label}</Badge>
              </div>
            </div>
            <p className="text-muted-foreground">
              Płatność jest potwierdzeniem zawarcia umowy. Poniżej znajdziesz szczegóły rezerwacji.
            </p>
          </CardHeader>
        </div>
      </Card>

      {/* Szczegóły rezerwacji */}
      <Card>
        <CardHeader>
          <CardTitle>Szczegóły rezerwacji</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground text-sm">Wycieczka</Label>
              <p className="font-medium">{booking.trip.title}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Termin</Label>
              <p className="font-medium">
                {formatDate(booking.trip.start_date)} {booking.trip.end_date && `- ${formatDate(booking.trip.end_date)}`}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Liczba uczestników</Label>
              <p className="font-medium">{booking.participants.length}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Kwota do zapłaty</Label>
              <p className="font-medium text-lg text-primary">{(totalPrice / 100).toFixed(2)} PLN</p>
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-muted-foreground text-sm mb-2 block">Uczestnicy</Label>
            {showDetailedParticipantList ? (
              <div className="divide-y rounded-lg border bg-muted/10">
                {booking.participants.map((participant, idx) => (
                  <div key={participant.id} className="flex items-start gap-3 p-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-5">
                        {participant.first_name} {participant.last_name}
                      </div>
                      {(participant.email || participant.phone) && (
                        <div className="text-xs text-muted-foreground">
                          {participant.email ? participant.email : "—"}
                          {participant.phone ? ` • ${participant.phone}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                <p className="text-sm leading-relaxed">
                  Przy zgłoszeniu grupowym nie wyświetlamy tu imion i nazwisk — lista uczestników zostanie przekazana mailem zgodnie z zasadami podanymi przez organizatora. Liczba uczestników odpowiada liczbie miejsc z sekcji powyżej (
                  <span className="font-medium">{booking.participants.length}</span>
                  ).
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {booking.trip.company_participants_info?.trim()
                    ? booking.trip.company_participants_info
                    : DEFAULT_COMPANY_PARTICIPANTS_INFO}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

