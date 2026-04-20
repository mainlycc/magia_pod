"use client";

import { use, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

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
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("pl-PL");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Rezerwacja {booking.booking_ref}</h1>
        <p className="text-muted-foreground">
          Płatność jest potwierdzeniem zawarcia umowy. Poniżej znajdziesz szczegóły rezerwacji.
        </p>
      </div>

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
            <div className="space-y-2">
              {booking.participants.map((participant) => (
                <div key={participant.id} className="text-sm">
                  {participant.first_name} {participant.last_name}
                  {participant.email && ` • ${participant.email}`}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

