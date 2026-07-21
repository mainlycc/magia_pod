"use client";

import { use, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AzureCard,
  ClientPanelHeader,
  ClientPanelShell,
  ClientPanelTitleAccent,
  azureClasses,
} from "@/components/client-panel";
import { cn } from "@/lib/utils";
import { formatAgreementNumber } from "@/lib/agreements/format-agreement-number";
import {
  calculateBookingTotalCents,
  getFirstInstallmentPercent,
} from "@/lib/utils/payment-calculator";
import {
  resolveAdditionalServicesCents,
  sumAdditionalServicesCentsUsingCatalogs,
} from "@/lib/sum-additional-services-cents";

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
      payment_split_enabled?: boolean | null;
      payment_split_first_percent?: number | null;
      payment_split_second_percent?: number | null;
      payment_schedule?: Array<{ installment_number?: number; percent: number; due_date: string }> | null;
      form_diets?: unknown;
      form_extra_insurances?: unknown;
      form_additional_attractions?: unknown;
    };
    participants: Array<{
      id: string;
      first_name: string;
      last_name: string;
      pesel: string;
      email: string | null;
      phone: string | null;
      selected_services?: unknown;
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

      if (!shouldEnsure) return;
      if (ensureFailed) return;
      if (typeof bookingData.booking.agreement_seq === "number" && bookingData.booking.agreement_seq > 0) return;

      void runEnsureAgreement();
    };

    void maybeEnsureAgreement();
  }, [bookingData, ensureFailed, searchParams, token]);

  if (loading) {
    return (
      <ClientPanelShell>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#a1a1aa]" />
        </div>
      </ClientPanelShell>
    );
  }

  if (error || !bookingData) {
    return (
      <ClientPanelShell>
        <AzureCard accent="danger" title="Błąd">
          <p className="text-sm text-[#3f3f46]">{error || "Nie udało się załadować danych rezerwacji"}</p>
        </AzureCard>
      </ClientPanelShell>
    );
  }

  const { booking } = bookingData;
  const participantsCount = booking.participants.length;
  const tripUnitPriceCents = booking.trip.price_cents ?? 0;
  const tripBaseCents = tripUnitPriceCents * participantsCount;

  const addonsCentsFromCatalogs = sumAdditionalServicesCentsUsingCatalogs(booking.participants, {
    form_diets: booking.trip.form_diets,
    form_extra_insurances: booking.trip.form_extra_insurances,
    form_additional_attractions: booking.trip.form_additional_attractions,
  });
  const addonsCents = resolveAdditionalServicesCents(
    booking.participants,
    undefined,
    addonsCentsFromCatalogs,
  );
  const totalPrice = tripBaseCents + addonsCents;

  const firstPercent = getFirstInstallmentPercent({
    payment_split_enabled: booking.trip.payment_split_enabled ?? null,
    payment_split_first_percent: booking.trip.payment_split_first_percent ?? null,
    payment_split_second_percent: booking.trip.payment_split_second_percent ?? null,
    payment_schedule: booking.trip.payment_schedule ?? null,
  });
  const depositCents = Math.round((totalPrice * firstPercent) / 100);
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

  const paymentUi =
    resolvedPaymentStatus === "CONFIRMED" || resolvedPaymentStatus === "PAID"
      ? { label: "Płatność potwierdzona", success: true }
      : resolvedPaymentStatus === "PENDING"
        ? { label: "Oczekuje na płatność", success: false }
        : resolvedPaymentStatus
          ? { label: `Status płatności: ${resolvedPaymentStatus}`, success: false }
          : { label: "Status płatności: —", success: false };

  return (
    <ClientPanelShell>
      <ClientPanelHeader
        showSessionBadge
        title={
          <>
            Twoja <ClientPanelTitleAccent>rezerwacja</ClientPanelTitleAccent>
          </>
        }
        subtitle="Płatność jest potwierdzeniem zawarcia umowy. Poniżej znajdziesz szczegóły rezerwacji."
      />

      <AzureCard accent="blue" className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#a1a1aa]">Numer umowy</p>
            {isEnsuringAgreement ? (
              <div className="flex items-center gap-2 py-1">
                <Loader2 className="h-5 w-5 animate-spin text-[#a1a1aa]" />
                <span className="text-lg text-[#a1a1aa]">Przypisywanie numeru…</span>
              </div>
            ) : (
              <h1 className="text-3xl font-semibold tracking-tight text-[#0a0a0a] sm:text-4xl">
                {agreementHeaderText}
              </h1>
            )}
          </div>
          <div className={cn(azureClasses.badgeSuccess, paymentUi.success && "border-[#bbf7d0]")}>
            <span
              className={cn(
                azureClasses.badgeSuccessDot,
                !paymentUi.success && "bg-[#a1a1aa] shadow-none",
              )}
              aria-hidden
            />
            {paymentUi.label}
          </div>
        </div>
      </AzureCard>

      {ensureFailed && agreementHeaderText === "—" && (
        <Alert variant="destructive" className="mb-6 rounded-[14px] border-[#fecaca] bg-[#fee2e2]">
          <AlertTitle>Nie udało się przypisać numeru umowy</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Spróbuj odświeżyć — numer powinien pojawić się automatycznie po zawarciu umowy.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runEnsureAgreement()}
              disabled={isEnsuringAgreement}
              className="shrink-0 rounded-xl border-[#dadce3]"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Odśwież
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {shouldShowSuccessMessage && booking.trip.reservation_success_message?.trim() && (
        <AzureCard accent="success" className="mb-6">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#3f3f46]">
            {booking.trip.reservation_success_message}
          </p>
        </AzureCard>
      )}

      <AzureCard accent="blue" title="Szczegóły rezerwacji">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                Wycieczka
              </Label>
              <p className="mt-1 font-medium text-[#0a0a0a]">{booking.trip.title}</p>
            </div>
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                Termin
              </Label>
              <p className="mt-1 font-medium text-[#0a0a0a]">
                {formatDate(booking.trip.start_date)}{" "}
                {booking.trip.end_date && `- ${formatDate(booking.trip.end_date)}`}
              </p>
            </div>
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                Liczba uczestników
              </Label>
              <p className="mt-1 font-medium text-[#0a0a0a]">{booking.participants.length}</p>
            </div>
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                Kwota do zapłaty
              </Label>
              <div className="mt-2 space-y-2">
                <div className="grid gap-1 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#3f3f46]">Cena wycieczki</span>
                    <span className={cn(azureClasses.mono, "font-semibold")}>
                      {(tripBaseCents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#3f3f46]">Usługi dodatkowe</span>
                    <span className={cn(azureClasses.mono, "font-semibold")}>
                      {(addonsCents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN
                    </span>
                  </div>
                  <Separator className="my-1 bg-[#eceef3]" />
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-[#3f3f46]">Łączna cena</span>
                    <span className={cn(azureClasses.mono, "text-lg font-semibold text-[#1e90ff]")}>
                      {(totalPrice / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#3f3f46]">Zaliczka ({firstPercent}%)</span>
                    <span className={cn(azureClasses.mono, "font-semibold")}>
                      {(depositCents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN
                    </span>
                  </div>
                </div>
                {addonsCents > 0 && (
                  <p className="text-xs text-[#a1a1aa]">
                    * Cena końcowa zawiera wybrane usługi dodatkowe.
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator className="bg-[#eceef3]" />

          <div>
            <Label className="mb-3 block text-[11px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
              Uczestnicy
            </Label>
            {showDetailedParticipantList ? (
              <div className="space-y-3">
                {booking.participants.map((participant, idx) => {
                  const initials = `${participant.first_name?.[0] ?? ""}${participant.last_name?.[0] ?? ""}`.toUpperCase();
                  return (
                    <div
                      key={participant.id}
                      className="flex items-start gap-3 rounded-2xl border border-[#dadce3] bg-[#f7f8fb] p-4"
                    >
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1e90ff] text-sm font-semibold text-white shadow-[0_6px_14px_-6px_#1e90ff]">
                        {initials || idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold tracking-wide text-[#a1a1aa]">
                          UCZESTNIK {String(idx + 1).padStart(2, "0")}
                        </div>
                        <div className="text-sm font-semibold leading-5 text-[#0a0a0a]">
                          {participant.first_name} {participant.last_name}
                        </div>
                        {(participant.email || participant.phone) && (
                          <div className="text-xs text-[#3f3f46]">
                            {participant.email ? participant.email : "—"}
                            {participant.phone ? ` • ${participant.phone}` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-[#dadce3] bg-[#f7f8fb] p-4">
                <p className="text-sm leading-relaxed text-[#3f3f46]">
                  Przy zgłoszeniu grupowym nie wyświetlamy tu imion i nazwisk — lista uczestników zostanie przekazana mailem zgodnie z zasadami podanymi przez organizatora. Liczba uczestników odpowiada liczbie miejsc z sekcji powyżej (
                  <span className="font-medium text-[#0a0a0a]">{booking.participants.length}</span>
                  ).
                </p>
                <p className="text-sm leading-relaxed text-[#a1a1aa]">
                  {booking.trip.company_participants_info?.trim()
                    ? booking.trip.company_participants_info
                    : DEFAULT_COMPANY_PARTICIPANTS_INFO}
                </p>
              </div>
            )}
          </div>
        </div>
      </AzureCard>
    </ClientPanelShell>
  );
}
