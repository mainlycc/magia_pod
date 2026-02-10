"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookingForm } from "@/components/booking-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type TripForReserve = {
  id: string;
  title: string;
  slug: string;
  public_slug?: string | null;
  seats_total: number | null;
  seats_reserved: number | null;
  is_active: boolean | null;
};

export default function ReservePage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const { slug } = use(params instanceof Promise ? params : Promise.resolve(params));

  const [trip, setTrip] = useState<TripForReserve | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrip = async () => {
      try {
        const supabase = createClient();

        let { data: tripData, error: tripError } = await supabase
          .from("trips")
          .select("id,title,slug,public_slug,seats_total,seats_reserved,is_active")
          .or(`slug.eq.${slug},public_slug.eq.${slug}`)
          .maybeSingle<TripForReserve>();

        if (tripError) {
          setError("Nie udało się załadować danych wycieczki.");
          return;
        }

        if (!tripData || tripData.is_active === false) {
          setError("Wycieczka nie jest dostępna.");
          return;
        }

        setTrip(tripData);
      } catch (e) {
        setError("Wystąpił błąd podczas ładowania danych wycieczki.");
      } finally {
        setLoading(false);
      }
    };

    loadTrip();
  }, [slug]);

  const seatsLeft = trip
    ? Math.max(0, (trip.seats_total ?? 0) - (trip.seats_reserved ?? 0))
    : 0;

  const hasNoSeats = trip ? seatsLeft <= 0 : false;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Rezerwacja wycieczki</h1>
          <p className="text-muted-foreground text-sm">
            Wypełnij dane kontaktowe, listę uczestników oraz zaakceptuj wymagane zgody, aby wysłać rezerwację.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href={`/trip/${slug}`}>Wróć do szczegółów</Link>
        </Button>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Ładowanie danych wycieczki...</p>
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardHeader>
            <CardTitle>Rezerwacja niedostępna</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && trip && hasNoSeats && (
        <Card>
          <CardHeader>
            <CardTitle>Brak wolnych miejsc</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Dla tej wycieczki nie ma już wolnych miejsc. Formularz rezerwacji jest niedostępny.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && trip && !hasNoSeats && (
        <BookingForm slug={slug} />
      )}
    </div>
  );
}

