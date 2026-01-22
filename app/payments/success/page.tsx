"use client";

import { Suspense, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type SuccessMessage = {
  id: string | null;
  title: string;
  message: string;
  is_active: boolean;
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const bookingRef = searchParams.get("booking_ref");
  const token = searchParams.get("token");
  const [message, setMessage] = useState<SuccessMessage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessage = async () => {
      try {
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
  }, []);

  const defaultTitle = "Rezerwacja i płatność zakończone pomyślnie!";
  const defaultMessage = '<p class="mb-2">Dziękujemy za rezerwację i płatność! Twoja rezerwacja została potwierdzona, a płatność została zaksięgowana.</p><p class="mt-2 text-sm">Wszystkie dokumenty (umowa, potwierdzenie płatności) zostały wysłane na Twój adres e-mail.</p><p class="mt-2 text-sm">Nie musisz ręcznie wgrywać podpisanej umowy - wszystko zostało automatycznie przetworzone.</p>';

  const displayTitle = message?.title || defaultTitle;
  const displayMessage = message?.message || defaultMessage;

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{displayTitle}</CardTitle>
          <CardDescription>
            {bookingRef ? `Rezerwacja: ${bookingRef}` : "Potwierdzenie rezerwacji"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 dark:text-green-200">Sukces!</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              {bookingRef && (
                <p className="mb-2 text-sm">
                  Numer rezerwacji: <strong>{bookingRef}</strong>
                </p>
              )}
              <div 
                dangerouslySetInnerHTML={{ __html: displayMessage }}
                className="space-y-2"
              />
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
          <CardHeader>
            <CardTitle>Ładowanie...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
