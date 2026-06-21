"use client";

import { use, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAgreementNumber } from "@/lib/agreements/format-agreement-number";

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
    agreement_seq: number | null;
    created_at: string;
    trip: {
      id: string;
      title: string;
      start_date: string | null;
      end_date: string | null;
      price_cents: number | null;
      reservation_number: string | null;
      company_participants_info?: string | null;
      reservation_success_message?: string | null;
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
  const [isEnsuringAgreement, setIsEnsuringAgreement] = useState(false);
  const [ensureFailed, setEnsureFailed] = useState(false);
  const [isSyncingPayment, setIsSyncingPayment] = useState(false);
  const [paymentSynced, setPaymentSynced] = useState(false);

  const refreshBooking = async () => {
    const response = await fetch(`/api/bookings/by-token/${token}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (response.ok) {
      const data = await response.json();
      setBookingData(data);
      return data as BookingData;
    }
    return null;
  };

  const runEnsureAgreement = async () => {
    setIsEnsuringAgreement(true);
    setEnsureFailed(false);
    try {
      const res = await fetch(`/api/bookings/by-token/${token}/ensure-agreement`, { method: "POST" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.warn("ensure-agreement failed:", t || res.statusText);
        setEnsureFailed(true);
        return;
      }
      await refreshBooking();
    } catch (e) {
      console.warn("ensure-agreement error:", e);
      setEnsureFailed(true);
    } finally {
      setIsEnsuringAgreement(false);
    }
  };

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await fetch(`/api/bookings/by-token/${token}`, {
          cache: "no-store",
          headers: { "cache-control": "no-cache" },
        });
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

  // Po powrocie z Paynow (continueUrl → /booking/{token}?paymentStatus=...) zsynchronizuj wpłatę i wystaw fakturę
  useEffect(() => {
    const syncPaymentAfterPaynow = async () => {
      if (!bookingData?.booking?.booking_ref) return;
      if (isSyncingPayment || paymentSynced) return;

      const paymentStatusFromUrl = (searchParams.get("paymentStatus") || "").trim().toUpperCase();
      const paymentIdFromUrl = searchParams.get("paymentId") || undefined;
      const fromPaynowFlag = (searchParams.get("fromPaynow") || "").trim() === "1";
      const returningFromPaynow =
        paymentStatusFromUrl === "CONFIRMED" ||
        paymentStatusFromUrl === "PAID" ||
        paymentStatusFromUrl === "PENDING" ||
        Boolean(paymentIdFromUrl) ||
        fromPaynowFlag;

      if (!returningFromPaynow) return;

      setIsSyncingPayment(true);
      try {
        const response = await fetch("/api/payments/paynow/check-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_ref: bookingData.booking.booking_ref,
            payment_id: paymentIdFromUrl,
          }),
        });

        if (response.ok) {
          await refreshBooking();
        }
      } catch (syncErr) {
        console.warn("Payment sync after Paynow return failed:", syncErr);
      } finally {
        setIsSyncingPayment(false);
        setPaymentSynced(true);
      }
    };

    void syncPaymentAfterPaynow();
  }, [bookingData, isSyncingPayment, paymentSynced, searchParams]);

  useEffect(() => {
    const maybeEnsureAgreement = async () => {
      if (!bookingData?.booking) return;
      if (isEnsuringAgreement) return;

      const paymentStatusFromUrl = (searchParams.get("paymentStatus") || "").trim();
      const resolvedPaymentStatus = (paymentStatusFromUrl || bookingData.booking.payment_status || "").toUpperCase();
      const createdFlag = (searchParams.get("created") || "").trim() === "1";
      const shouldEnsure =
        createdFlag || resolvedPaymentStatus === "CONFIRMED" || resolvedPaymentStatus === "PAID";

      // Jeśli umowa już ma numer, nic nie robimy
      if (!shouldEnsure) return;
      if (ensureFailed) return;
      if (typeof bookingData.booking.agreement_seq === "number" && bookingData.booking.agreement_seq > 0) return;

      void runEnsureAgreement();
    };

    void maybeEnsureAgreement();
  }, [bookingData, ensureFailed, searchParams, token]);

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
  const createdFlag = (searchParams.get("created") || "").trim() === "1";
  const shouldShowSuccessMessage =
    createdFlag || resolvedPaymentStatus === "CONFIRMED" || resolvedPaymentStatus === "PAID";

  const agreementNumberText = formatAgreementNumber({
    reservationNumber: booking.trip.reservation_number,
    agreementSeq: booking.agreement_seq,
  });
  const agreementHeaderText = agreementNumberText === "-" ? "—" : agreementNumberText.replace(/^#/, "");
  const agreementHeaderLabel = "Numer umowy";

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
                <p className="text-sm text-muted-foreground">{agreementHeaderLabel}</p>
                {isEnsuringAgreement ? (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-lg text-muted-foreground">Przypisywanie numeru…</span>
                  </div>
                ) : (
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {agreementHeaderText}
                  </h1>
                )}
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

      {ensureFailed && agreementHeaderText === "—" && (
        <Alert variant="destructive">
          <AlertTitle>Nie udało się przypisać numeru umowy</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Spróbuj odświeżyć — numer powinien pojawić się automatycznie po zawarciu umowy.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runEnsureAgreement()}
              disabled={isEnsuringAgreement}
              className="shrink-0"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Odśwież
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {shouldShowSuccessMessage && booking.trip.reservation_success_message?.trim() && (
        <p className="whitespace-pre-wrap">{booking.trip.reservation_success_message}</p>
      )}

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

