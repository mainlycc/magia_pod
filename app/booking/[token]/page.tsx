"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
  const [processingPayment, setProcessingPayment] = useState(false);
  const [agreementUploaded, setAgreementUploaded] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  // Formularz płatności
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolder, setCardHolder] = useState("");

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
        setPaymentCompleted(data.booking.payment_status === "paid" || data.booking.payment_status === "overpaid");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Błąd podczas ładowania danych");
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [token]);

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

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Walidacja
    if (!cardNumber || !cardExpiry || !cardCvv || !cardHolder) {
      toast.error("Wypełnij wszystkie pola formularza płatności");
      return;
    }

    // Prosta walidacja numeru karty (16 cyfr)
    const cleanCardNumber = cardNumber.replace(/\s/g, "");
    if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
      toast.error("Nieprawidłowy numer karty");
      return;
    }

    // Walidacja daty ważności (MM/YY)
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      toast.error("Nieprawidłowy format daty ważności (MM/YY)");
      return;
    }

    // Walidacja CVV (3-4 cyfry)
    if (!/^\d{3,4}$/.test(cardCvv)) {
      toast.error("Nieprawidłowy kod CVV");
      return;
    }

    setProcessingPayment(true);

    try {
      const response = await fetch(`/api/bookings/by-token/${token}/simulate-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          card_number: cleanCardNumber,
          card_holder: cardHolder,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Nie udało się przetworzyć płatności");
      }

      toast.success("Płatność została przetworzona pomyślnie");
      setPaymentCompleted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd podczas przetwarzania płatności");
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, "");
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(" ").slice(0, 19);
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
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

      {/* Symulacja płatności */}
      <Card>
        <CardHeader>
          <CardTitle>Płatność</CardTitle>
          <CardDescription>Symulacja płatności kartą</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentCompleted ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Płatność zakończona</AlertTitle>
              <AlertDescription>Płatność za rezerwację została pomyślnie przetworzona.</AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="card-number">Numer karty</Label>
                <Input
                  id="card-number"
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  maxLength={19}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="card-expiry">Data ważności</Label>
                  <Input
                    id="card-expiry"
                    type="text"
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    maxLength={5}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="card-cvv">CVV</Label>
                  <Input
                    id="card-cvv"
                    type="text"
                    placeholder="123"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-holder">Imię i nazwisko na karcie</Label>
                <Input
                  id="card-holder"
                  type="text"
                  placeholder="Jan Kowalski"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  To jest symulacja płatności. Żadne rzeczywiste transakcje nie zostaną wykonane.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={processingPayment}>
                {processingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Przetwarzanie...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Zapłać {(totalPrice / 100).toFixed(2)} PLN
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

