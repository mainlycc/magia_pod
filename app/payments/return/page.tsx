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
      // Zawsze spróbuj sprawdzić status płatności przez API Paynow, jeśli mamy booking_ref
      if (bookingRef) {
        try {
          console.log(`[Payment Return] Checking payment status for booking_ref: ${bookingRef}, payment_id: ${paymentId || "not provided"}`);
          
          // Spróbuj sprawdzić status z retry logic
          let retries = 3;
          let checkSuccess = false;
          
          while (retries > 0 && !checkSuccess) {
            try {
              const response = await fetch("/api/payments/paynow/check-status", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ 
                  booking_ref: bookingRef, 
                  payment_id: paymentId || undefined // payment_id jest opcjonalne
                }),
              });

              const data = await response.json();
              console.log(`[Payment Return] Check status response (attempt ${4 - retries}/3):`, data);
              
              if (data.success) {
                checkSuccess = true;
                
                if (data.paynow_status === "CONFIRMED" || data.payment_status === "paid") {
                  setStatus("success");
                  setMessage(data.message || "Płatność została pomyślnie zrealizowana i zaktualizowana w systemie.");
                  return;
                } else if (data.paynow_status === "PENDING") {
                  setStatus("pending");
                  setMessage("Płatność jest w trakcie przetwarzania. Status zostanie zaktualizowany automatycznie.");
                  return;
                } else if (data.paynow_status === "REJECTED" || data.paynow_status === "EXPIRED") {
                  setStatus("error");
                  setMessage("Płatność nie została zrealizowana. Spróbuj ponownie.");
                  return;
                } else {
                  // Nieznany status - pokaż jako pending
                  setStatus("pending");
                  setMessage(data.message || "Status płatności jest sprawdzany. Odśwież stronę za chwilę.");
                  return;
                }
              } else if (data.error) {
                console.error(`[Payment Return] Error from check-status API:`, data.error);
                // Jeśli błąd, spróbuj ponownie
                retries--;
                if (retries > 0) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            } catch (fetchError) {
              console.error(`[Payment Return] Error checking payment status (attempt ${4 - retries}/3):`, fetchError);
              retries--;
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
          
          // Jeśli wszystkie próby się nie powiodły, pokaż jako pending
          if (!checkSuccess) {
            console.error("[Payment Return] Failed to check payment status after 3 attempts");
            setStatus("pending");
            setMessage("Nie udało się sprawdzić statusu płatności. Status zostanie zaktualizowany automatycznie. Odśwież stronę za chwilę.");
          }
        } catch (error) {
          console.error("[Payment Return] Unexpected error checking payment status:", error);
          setStatus("pending");
          setMessage("Wystąpił błąd podczas sprawdzania statusu płatności. Status zostanie zaktualizowany automatycznie.");
        }
      }

      // Fallback do sprawdzania parametrów URL (jeśli Paynow przekazuje status w URL)
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
      } else if (bookingRef) {
        // Jeśli nie ma parametrów, ale mamy booking_ref, spróbuj ponownie sprawdzić status po krótkim opóźnieniu
        // Czasami Paynow potrzebuje chwili na przetworzenie płatności
        setTimeout(async () => {
          try {
            console.log(`[Payment Return] Delayed check for booking_ref: ${bookingRef}`);
            const response = await fetch("/api/payments/paynow/check-status", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ booking_ref: bookingRef }),
            });

            const data = await response.json();
            console.log(`[Payment Return] Delayed check response:`, data);
            
            if (data.success) {
              if (data.paynow_status === "CONFIRMED" || data.payment_status === "paid") {
                setStatus("success");
                setMessage(data.message || "Płatność została pomyślnie zrealizowana i zaktualizowana w systemie.");
              } else if (data.paynow_status === "PENDING") {
                setStatus("pending");
                setMessage("Płatność jest w trakcie przetwarzania. Status zostanie zaktualizowany automatycznie.");
              } else {
                setStatus("pending");
                setMessage(
                  "Płatność została przekierowana. Status płatności zostanie zaktualizowany automatycznie. Odśwież stronę za chwilę."
                );
              }
            } else {
              setStatus("pending");
              setMessage(
                "Płatność została przekierowana. Status płatności zostanie zaktualizowany automatycznie. Odśwież stronę za chwilę."
              );
            }
          } catch (error) {
            console.error("[Payment Return] Error in delayed check:", error);
            setStatus("pending");
            setMessage(
              "Płatność została przekierowana. Status płatności zostanie zaktualizowany automatycznie."
            );
          }
        }, 2000); // Sprawdź ponownie po 2 sekundach
      } else {
        // Jeśli nie ma ani parametrów, ani booking_ref
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

