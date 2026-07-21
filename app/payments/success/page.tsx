"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import {
  AzureBtnOutline,
  AzureBtnPrimary,
  AzureCard,
  ClientPanelHeader,
  ClientPanelShell,
} from "@/components/client-panel";
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

        const response = await fetch("/api/payment-success-message");
        if (response.ok) {
          const data = await response.json();
          setMessage(data);
        } else {
          setMessage({
            id: null,
            title: "Rezerwacja i płatność zakończone pomyślnie!",
            message:
              '<p class="mb-2">Dziękujemy za rezerwację i płatność! Twoja rezerwacja została potwierdzona, a płatność została zaksięgowana.</p><p class="mt-2 text-sm">Wszystkie dokumenty (umowa, potwierdzenie płatności) zostały wysłane na Twój adres e-mail.</p><p class="mt-2 text-sm">Nie musisz ręcznie wgrywać podpisanej umowy - wszystko zostało automatycznie przetworzone.</p>',
            is_active: true,
          });
        }
      } catch (error) {
        console.error("Error fetching success message:", error);
        setMessage({
          id: null,
          title: "Rezerwacja i płatność zakończone pomyślnie!",
          message:
            '<p class="mb-2">Dziękujemy za rezerwację i płatność! Twoja rezerwacja została potwierdzona, a płatność została zaksięgowana.</p><p class="mt-2 text-sm">Wszystkie dokumenty (umowa, potwierdzenie płatności) zostały wysłane na Twój adres e-mail.</p><p class="mt-2 text-sm">Nie musisz ręcznie wgrywać podpisanej umowy - wszystko zostało automatycznie przetworzone.</p>',
          is_active: true,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMessage();
  }, [bookingRef, token]);

  const defaultMessage =
    '<p class="mb-2">Dziękujemy za rezerwację i płatność! Twoja rezerwacja została potwierdzona, a płatność została zaksięgowana.</p><p class="mt-2 text-sm">Wszystkie dokumenty (umowa, potwierdzenie płatności) zostały wysłane na Twój adres e-mail.</p><p class="mt-2 text-sm">Nie musisz ręcznie wgrywać podpisanej umowy - wszystko zostało automatycznie przetworzone.</p>';

  const displayMessage = message?.message || defaultMessage;

  return (
    <ClientPanelShell containerClassName="max-w-2xl">
      <ClientPanelHeader
        title="Płatność zakończona"
        subtitle="Twoja rezerwacja została potwierdzona."
        showBrand
      />

      <AzureCard accent="success" title="Rezerwacja i płatność zakończone pomyślnie!">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-[14px] border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-[#166534]">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-2 text-sm leading-relaxed">
              {loading ? (
                <p>Ładowanie...</p>
              ) : (
                <>
                  {isEnsuringAgreement ? (
                    <p className="text-[#3f3f46]">Przypisywanie numeru umowy…</p>
                  ) : agreementNumberText ? (
                    <p>
                      Numer umowy: <strong>{agreementNumberText.replace(/^#/, "")}</strong>
                    </p>
                  ) : null}
                  <div
                    className="prose prose-sm max-w-none text-[#166534]"
                    dangerouslySetInnerHTML={{ __html: displayMessage }}
                  />
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {token ? (
              <AzureBtnPrimary asChild className="w-full">
                <Link href={`/booking/${token}`}>Zobacz szczegóły rezerwacji</Link>
              </AzureBtnPrimary>
            ) : bookingRef ? (
              <AzureBtnPrimary asChild className="w-full">
                <Link href={`/booking/${bookingRef}`}>Zobacz szczegóły rezerwacji</Link>
              </AzureBtnPrimary>
            ) : null}
            <AzureBtnOutline asChild className="w-full">
              <Link href="/">Wróć do strony głównej</Link>
            </AzureBtnOutline>
          </div>
        </div>
      </AzureCard>
    </ClientPanelShell>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <ClientPanelShell containerClassName="max-w-2xl">
          <AzureCard accent="blue" title="Ładowanie">
            <p className="text-sm text-[#3f3f46]">Ładowanie...</p>
          </AzureCard>
        </ClientPanelShell>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
