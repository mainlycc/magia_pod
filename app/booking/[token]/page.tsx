"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, Upload, CreditCard, Loader2 } from "lucide-react";

type BookingData = {
  booking: {
    id: string;
    booking_ref: string;
    contact_email: string;
    contact_phone: string | null;
    address: any;
    status: string;
    payment_status: string;
    agreement_pdf_url: string | null;
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
  const router = useRouter();
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAgreement, setUploadingAgreement] = useState(false);
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [agreementUploaded, setAgreementUploaded] = useState(false);

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
        
        // Jeśli płatność nie jest opłacona, automatycznie inicjuj płatność Paynow
        const booking = data.booking;
        if (booking && booking.payment_status !== "paid" && booking.payment_status !== "overpaid") {
          // Automatycznie przekieruj do płatności Paynow
          handlePaynowPaymentAuto(booking.booking_ref);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Błąd podczas ładowania danych");
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [token]);

  const handlePaynowPaymentAuto = async (bookingRef: string) => {
    try {
      const response = await fetch("/api/payments/paynow/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          booking_ref: bookingRef,
        }),
      });

      if (!response.ok) {
        // Jeśli nie uda się zainicjować płatności, nie pokazuj błędu - użytkownik może kliknąć przycisk
        console.warn("Auto-init payment failed, user can click button manually");
        return;
      }

      const data = await response.json();
      
      if (data.redirectUrl) {
        // Przekieruj użytkownika do Paynow
        window.location.href = data.redirectUrl;
      }
    } catch (err) {
      // Ignoruj błąd - użytkownik może kliknąć przycisk płatności ręcznie
      console.warn("Auto-init payment error:", err);
    }
  };

  const handleAgreementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Tylko pliki PDF są dozwolone");
      return;
    }

    setUploadingAgreement(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/bookings/by-token/${token}/upload-agreement`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Nie udało się przesłać umowy");
      }

      toast.success("Podpisana umowa została przesłana pomyślnie");
      setAgreementUploaded(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd podczas przesyłania umowy");
    } finally {
      setUploadingAgreement(false);
    }
  };

  const handlePaynowPayment = async () => {
    if (!bookingData) return;

    setInitiatingPayment(true);

    try {
      const response = await fetch("/api/payments/paynow/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          booking_ref: bookingData.booking.booking_ref,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Nie udało się zainicjować płatności");
      }

      const data = await response.json();
      
      if (data.redirectUrl) {
        // Przekieruj użytkownika do Paynow
        window.location.href = data.redirectUrl;
      } else {
        throw new Error("Brak URL przekierowania");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd podczas inicjalizacji płatności");
      setInitiatingPayment(false);
    }
  };

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
        <p className="text-muted-foreground">Prześlij podpisaną umowę i dokonaj płatności</p>
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

      {/* Upload umowy */}
      <Card>
        <CardHeader>
          <CardTitle>Podpisana umowa</CardTitle>
          <CardDescription>Prześlij podpisaną umowę w formacie PDF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {agreementUploaded ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Umowa przesłana</AlertTitle>
              <AlertDescription>Podpisana umowa została pomyślnie przesłana.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="agreement-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 p-4 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploadingAgreement ? "Przesyłanie..." : "Kliknij, aby wybrać plik PDF"}
                    </span>
                  </div>
                </Label>
                <Input
                  id="agreement-upload"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleAgreementUpload}
                  disabled={uploadingAgreement}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Maksymalny rozmiar pliku: 10MB. Tylko pliki PDF są dozwolone.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Płatność Paynow */}
      <Card>
        <CardHeader>
          <CardTitle>Płatność</CardTitle>
          <CardDescription>Dokonaj płatności za rezerwację przez Paynow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {booking.payment_status === "paid" || booking.payment_status === "overpaid" ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Płatność zakończona</AlertTitle>
              <AlertDescription>
                Płatność za rezerwację została pomyślnie przetworzona.
                {booking.payment_status === "overpaid" && (
                  <span className="block mt-1 text-sm">
                    Uwaga: Wykryto nadpłatę. Skontaktuj się z nami w celu zwrotu nadpłaty.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          ) : booking.payment_status === "partial" ? (
            <Alert>
              <AlertTitle>Płatność częściowa</AlertTitle>
              <AlertDescription>
                Rezerwacja została częściowo opłacona. Możesz dokonać dopłaty.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Kwota do zapłaty</p>
                    <p className="text-2xl font-bold text-primary">
                      {(totalPrice / 100).toFixed(2)} PLN
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handlePaynowPayment}
                className="w-full"
                disabled={initiatingPayment}
                size="lg"
              >
                {initiatingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Przekierowywanie do Paynow...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Zapłać przez Paynow
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Zostaniesz przekierowany do bezpiecznej strony płatności Paynow
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

