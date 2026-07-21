"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookingForm } from "@/components/booking-form";
import { AzureCard, ClientPanelShell } from "@/components/client-panel";
import {
  ClientPanelHeader,
  ClientPanelTitleAccent,
} from "@/components/client-panel/client-panel-header";
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
  const searchParams = useSearchParams();
  const agreementPreviewMode = searchParams.get("podglad") === "1";

  const [trip, setTrip] = useState<TripForReserve | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrip = async () => {
      try {
        const supabase = createClient();

        const { data: tripData, error: tripError } = await supabase
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
      } catch {
        setError("Wystąpił błąd podczas ładowania danych wycieczki.");
      } finally {
        setLoading(false);
      }
    };

    loadTrip();
  }, [slug]);

  const seatsLeft = trip ? Math.max(0, (trip.seats_total ?? 0) - (trip.seats_reserved ?? 0)) : 0;
  const seatsTotal = trip?.seats_total ?? 0;
  const hasNoSeats = trip ? seatsLeft <= 0 : false;

  return (
    <ClientPanelShell>
      <ClientPanelHeader
        title={
          <>
            Rezerwacja <ClientPanelTitleAccent>wycieczki</ClientPanelTitleAccent>
          </>
        }
        subtitle="Wypełnij dane kontaktowe, uzupełnij listę uczestników i zaakceptuj zgody, aby wysłać rezerwację."
        backHref={`/trip/${slug}`}
      />

      {loading && (
        <AzureCard accent="blue" title="Ładowanie">
          <p className="text-sm text-[#3f3f46]">Ładowanie danych wycieczki...</p>
        </AzureCard>
      )}

      {!loading && error && (
        <AzureCard accent="danger" title="Rezerwacja niedostępna">
          <p className="text-sm text-[#3f3f46]">{error}</p>
        </AzureCard>
      )}

      {!loading && !error && trip && hasNoSeats && (
        <AzureCard accent="black" title="Brak wolnych miejsc">
          <p className="text-sm text-[#3f3f46]">
            Dla tej wycieczki nie ma już wolnych miejsc. Formularz rezerwacji jest niedostępny.
          </p>
        </AzureCard>
      )}

      {!loading && !error && trip && !hasNoSeats && (
        <BookingForm slug={slug} startAtAgreementPreview={agreementPreviewMode} />
      )}
    </ClientPanelShell>
  );
}
