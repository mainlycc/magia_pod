"use client";

import { Suspense, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatAgreementNumber } from "@/lib/agreements/format-agreement-number";

type SuccessMessage = {
  id: string | null;
  title?: string;
  message: string;
  is_active: boolean;
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const bookingRef = searchParams.get("booking_ref");
  const token = searchParams.get("token");
  const [message, setMessage] = useState<SuccessMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [agreementNumberText, setAgreementNumberText] = useState<string | null>(null);
  const [isEnsuringAgreement, setIsEnsuringAgreement] = useState(false);

  useEffect(() => {
    const fetchMessage = async () => {
      try {
        const bookingToken = token || bookingRef;
        if (bookingToken) {
          const bookingRes = await fetch(`/api/bookings/by-token/${bookingToken}`);
          if (bookingRes.ok) {
            const data = await bookingRes.json();
            const tripMessage = (data?.booking?.trip?.reservation_success_message || "").trim();
            let agreementText = formatAgreementNumber({
              reservationNumber: data?.booking?.trip?.reservation_number ?? null,
              agreementSeq: data?.booking?.agreement_seq ?? null,
            });

            if (agreementText === "-") {
              setIsEnsuringAgreement(true);
              try {
                const ensureRes = await fetch(
                  `/api/bookings/by-token/${bookingToken}/ensure-agreement`,
                  { method: "POST" },
                );
                if (ensureRes.ok) {
                  const refreshed = await fetch(`/api/bookings/by-token/${bookingToken}`);
                  if (refreshed.ok) {
                    const refreshedData = await refreshed.json();
                    agreementText = formatAgreementNumber({
                      reservationNumber: refreshedData?.booking?.trip?.reservation_number ?? null,
                      agreementSeq: refreshedData?.booking?.agreement_seq ?? null,
                    });
                  }
                }
              } catch (ensureErr) {
                console.warn("ensure-agreement on success page failed:", ensureErr);
              } finally {
                setIsEnsuringAgreement(false);
              }
            }

            setAgreementNumberText(agreementText !== "-" ? agreementText : null);

            if (tripMessage) {
              setMessage({
                id: null,
                message: tripMessage,
                is_active: true,
              });
              return;
            }
          }
        }

        // 2) Fallback do globalnego komunikatu (jak dotychczas)
        const response = await fetch("/api/payment-success-message");
        if (response.ok) {
          const data = await response.json();
          setMessage(data);
        } else {
          // Fallback do domyślnego komunikatu
          setMessage({
            id: null,
            title: "Rezerwacja i płatność zakończone pomyślnie!",
            message: '<p class="mb-2">Dziękujemy za rezerwację i płatność! Twoja rezerwacja została potwierdzona, a płatność została zaksięgowana.</p><p class="mt-2 text-sm">Wszystkie dokumenty (umowa, potwierdzenie płatności) zostały wysłane na Twój adres e-mail.</p><p class="mt-2 text-sm">Nie musisz ręcznie wgrywać podpisanej umowy - wszystko zostało automatycznie przetworzone.</p>',
            is_active: true,
          });
        }
      } catch (error) {
        console.error("Error fetching success message:", error);
        // Fallback do domyślnego komunikatu
        setMessage({
          id: null,
          title: "Rezerwacja i płatność zakończone pomyślnie!",
          message: '<p class="mb-2">Dziękujemy za rezerwację i płatność! Twoja rezerwacja została potwierdzona, a płatność została zaksięgowana.</p><p class="mt-2 text-sm">Wszystkie dokumenty (umowa, potwierdzenie płatności) zostały wysłane na Twój adres e-mail.</p><p class="mt-2 text-sm">Nie musisz ręcznie wgrywać podpisanej umowy - wszystko zostało automatycznie przetworzone.</p>',
          is_active: true,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMessage();
  }, [bookingRef, token]);

  const defaultMessage = '<p class="mb-2">Dziękujemy za rezerwację i płatność! Twoja rezerwacja została potwierdzona, a płatność została zaksięgowana.</p><p class="mt-2 text-sm">Wszystkie dokumenty (umowa, potwierdzenie płatności) zostały wysłane na Twój adres e-mail.</p><p class="mt-2 text-sm">Nie musisz ręcznie wgrywać podpisanej umowy - wszystko zostało automatycznie przetworzone.</p>';

  const displayMessage = message?.message || defaultMessage;

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <Card>
        <CardContent className="space-y-4">
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-300 whitespace-pre-wrap">
              {isEnsuringAgreement ? (
                <p className="mb-2 text-sm text-muted-foreground">Przypisywanie numeru umowy…</p>
              ) : agreementNumberText ? (
                <p className="mb-2 text-sm">
                  Numer umowy: <strong>{agreementNumberText.replace(/^#/, "")}</strong>
                </p>
              ) : null}
              {displayMessage}
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2 pt-4">
            {token ? (
              <Button asChild variant="default" className="w-full">
                <Link href={`/booking/${token}`}>Zobacz szczegóły rezerwacji</Link>
              </Button>
            ) : bookingRef ? (
              <Button asChild variant="default" className="w-full">
                <Link href={`/booking/${bookingRef}`}>Zobacz szczegóły rezerwacji</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Wróć do strony głównej</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardContent className="p-6">Ładowanie...</CardContent>
        </Card>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
