"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "pending">("loading");
  const [message, setMessage] = useState<string>("");
  const bookingRef = searchParams.get("booking_ref");

  useEffect(() => {
    // Paynow może przekierować z parametrami w URL
    // Sprawdzamy czy są jakieś parametry statusu
    const paymentStatus = searchParams.get("status");
    const paymentId = searchParams.get("paymentId");
    const bookingRef = searchParams.get("booking_ref");

    const checkPaymentStatus = async () => {
      if (bookingRef && paymentId) {
        // Automatycznie sprawdź status płatności przez API Paynow
        try {
          const response = await fetch("/api/payments/paynow/check-status", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ booking_ref: bookingRef, payment_id: paymentId }),
          });

          const data = await response.json();
          
          if (data.success && data.paynow_status === "CONFIRMED") {
            setStatus("success");
            setMessage("Płatność została pomyślnie zrealizowana i zaktualizowana w systemie.");
            return;
          }
        } catch (error) {
          console.error("Error checking payment status:", error);
        }
      }

      // Fallback do sprawdzania parametrów URL
      if (paymentStatus) {
        switch (paymentStatus.toUpperCase()) {
          case "CONFIRMED":
          case "COMPLETED":
            setStatus("success");
            setMessage("Płatność została pomyślnie zrealizowana.");
            break;
          case "PENDING":
            setStatus("pending");
            setMessage("Płatność jest w trakcie przetwarzania. Sprawdź status później.");
            break;
          case "REJECTED":
          case "EXPIRED":
            setStatus("error");
            setMessage("Płatność nie została zrealizowana. Spróbuj ponownie.");
            break;
          default:
            setStatus("loading");
            setMessage("Sprawdzanie statusu płatności...");
        }
      } else {
        // Jeśli nie ma parametrów, zakładamy że płatność może być w trakcie przetwarzania
        // Webhook zaktualizuje status w bazie
        setStatus("pending");
        setMessage(
          "Płatność została przekierowana. Status płatności zostanie zaktualizowany automatycznie."
        );
      }
    };

    checkPaymentStatus();
  }, [searchParams]);

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Status płatności</CardTitle>
          <CardDescription>
            {bookingRef ? `Rezerwacja: ${bookingRef}` : "Informacja o płatności"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">{message || "Sprawdzanie statusu płatności..."}</p>
            </div>
          )}

          {status === "success" && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800 dark:text-green-200">Płatność zakończona pomyślnie</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                {message}
                {bookingRef && (
                  <p className="mt-2 text-sm">
                    Numer rezerwacji: <strong>{bookingRef}</strong>
                  </p>
                )}
                <p className="mt-2 text-sm">
                  Potwierdzenie płatności zostało wysłane na Twój adres e-mail.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {status === "pending" && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Płatność w trakcie przetwarzania</AlertTitle>
              <AlertDescription>
                {message}
                {bookingRef && (
                  <p className="mt-2 text-sm">
                    Numer rezerwacji: <strong>{bookingRef}</strong>
                  </p>
                )}
                <p className="mt-2 text-sm">
                  Status płatności zostanie zaktualizowany automatycznie. Sprawdź swoją skrzynkę e-mail
                  lub odśwież stronę rezerwacji za chwilę.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Płatność nie została zrealizowana</AlertTitle>
              <AlertDescription>
                {message}
                {bookingRef && (
                  <p className="mt-2 text-sm">
                    Numer rezerwacji: <strong>{bookingRef}</strong>
                  </p>
                )}
                <p className="mt-2 text-sm">
                  Jeśli chcesz spróbować ponownie, możesz wrócić do strony rezerwacji i rozpocząć płatność
                  od nowa.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2 pt-4">
            {bookingRef && (
              <Button asChild variant="default" className="w-full">
                <Link href={`/booking/${bookingRef}`}>Wróć do rezerwacji</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Wróć do strony głównej</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Status płatności</CardTitle>
            <CardDescription>Informacja o płatności</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Ładowanie...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <PaymentReturnContent />
    </Suspense>
  );
}

