"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import {
  AzureCard,
  ClientPanelHeader,
  ClientPanelShell,
  ClientPanelTitleAccent,
  azureClasses,
} from "@/components/client-panel";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type BookingProcessingMode = "payment" | "reservation";

type StepDef = {
  id: string;
  title: string;
  subtitle: string;
  /**
   * Real backend gate — step stays active until this is true.
   * Early UX steps have no gate and advance on timers while API runs in parallel.
   */
  gate?: "redirect";
  /** Minimum dwell time while this step is active (ms) */
  dwellMs: number;
};

type StepStatus = "pending" | "active" | "done";

type BookingProcessingProgressProps = {
  mode: BookingProcessingMode;
  /** POST /api/bookings zakończony sukcesem (kept for API compat; redirectReady is the gate) */
  bookingReady: boolean;
  /** Mamy URL docelowy (Paynow lub strona rezerwacji) */
  redirectReady: boolean;
  onComplete: () => void;
  /** When true, skip ClientPanelShell (embed inside an existing shell) */
  embedded?: boolean;
  className?: string;
};

function buildSteps(mode: BookingProcessingMode): StepDef[] {
  return [
    {
      id: "save",
      title: "Zapisujemy rezerwację",
      subtitle: "Zabezpieczamy Twoje miejsca i dane w systemie.",
      dwellMs: 1500,
    },
    {
      id: "participants",
      title: "Sprawdzamy dane uczestników",
      subtitle: "Weryfikujemy kompletność danych kontaktowych i uczestników.",
      dwellMs: 1600,
    },
    {
      id: "documents",
      title: "Weryfikujemy dokumenty i zgody",
      subtitle: "Sprawdzamy przyjęte regulaminy oraz wymagane oświadczenia.",
      dwellMs: 1600,
    },
    mode === "payment"
      ? {
          id: "prepare-payment",
          title: "Przygotowujemy bezpieczną płatność",
          subtitle: "Łączymy się z bramką płatności i tworzymy transakcję.",
          gate: "redirect",
          dwellMs: 1400,
        }
      : {
          id: "agreement",
          title: "Nadajemy numer umowy",
          subtitle: "Przypisujemy oficjalny numer umowy do rezerwacji.",
          gate: "redirect",
          dwellMs: 1400,
        },
    mode === "payment"
      ? {
          id: "redirect",
          title: "Przekierowujemy do płatności",
          subtitle: "Za chwilę przejdziesz do bezpiecznej bramki Paynow.",
          dwellMs: 1100,
        }
      : {
          id: "confirm",
          title: "Przygotowujemy potwierdzenie",
          subtitle: "Składamy podsumowanie rezerwacji dla Ciebie.",
          dwellMs: 1100,
        },
  ];
}

export function BookingProcessingProgress({
  mode,
  bookingReady: _bookingReady,
  redirectReady,
  onComplete,
  embedded = false,
  className,
}: BookingProcessingProgressProps) {
  void _bookingReady;
  const steps = useMemo(() => buildSteps(mode), [mode]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const completedRef = useRef(false);
  const stepEnteredAtRef = useRef(Date.now());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Smooth fill within the active step (pauses at ~92% while waiting on a gate)
  useEffect(() => {
    if (completedRef.current) return;
    const step = steps[activeIndex];
    if (!step) return;

    const gateBlocking = step.gate === "redirect" && !redirectReady;
    let frame = 0;

    const tick = () => {
      const elapsed = Date.now() - stepEnteredAtRef.current;
      if (gateBlocking) {
        // Pulse near the end while API finishes — don't look stuck at 0
        const base = Math.min(0.92, elapsed / step.dwellMs);
        setStepProgress(base);
      } else {
        setStepProgress(Math.min(1, elapsed / step.dwellMs));
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, redirectReady, steps]);

  useEffect(() => {
    if (completedRef.current) return;

    const step = steps[activeIndex];
    if (!step) return;

    // UX steps run immediately in parallel with the API.
    // Only the gated step waits for redirectReady (after its minimum dwell).
    const gateOk = step.gate !== "redirect" || redirectReady;
    if (!gateOk) return;

    const elapsedOnStep = Date.now() - stepEnteredAtRef.current;
    const remainingDwell = Math.max(0, step.dwellMs - elapsedOnStep);

    const advance = () => {
      if (completedRef.current) return;

      // Re-check gate at fire time (redirect may have arrived during dwell)
      if (step.gate === "redirect" && !redirectReady) return;

      const nextCompleted = activeIndex + 1;
      setCompletedCount(nextCompleted);
      setStepProgress(0);

      if (nextCompleted >= steps.length) {
        completedRef.current = true;
        onCompleteRef.current();
        return;
      }

      stepEnteredAtRef.current = Date.now();
      setActiveIndex(nextCompleted);
    };

    const timer = window.setTimeout(advance, remainingDwell);
    return () => window.clearTimeout(timer);
  }, [activeIndex, redirectReady, steps]);

  const allDone = completedCount >= steps.length;
  const progressValue = allDone
    ? 100
    : Math.round(
        ((completedCount + Math.min(1, stepProgress)) / steps.length) * 100,
      );
  const currentStep = steps[Math.min(activeIndex, steps.length - 1)];
  const waitingOnPayment =
    Boolean(currentStep?.gate) && !redirectReady && !allDone;

  const content = (
    <div className={cn("mx-auto w-full max-w-xl", className)}>
      {!embedded && (
        <ClientPanelHeader
          showBrand
          title={
            <>
              {mode === "payment" ? (
                <>
                  Przygotowujemy{" "}
                  <ClientPanelTitleAccent>płatność</ClientPanelTitleAccent>
                </>
              ) : (
                <>
                  Finalizujemy{" "}
                  <ClientPanelTitleAccent>rezerwację</ClientPanelTitleAccent>
                </>
              )}
            </>
          }
          subtitle={
            mode === "payment"
              ? "Proszę chwilę poczekać — zaraz przeniesiemy Cię do bezpiecznej płatności."
              : "Proszę chwilę poczekać — przygotowujemy Twoją rezerwację."
          }
        />
      )}

      <AzureCard
        accent={allDone ? "success" : "blue"}
        title={embedded ? "Przygotowujemy rezerwację" : undefined}
        subtitle={
          embedded
            ? mode === "payment"
              ? "Zapisujemy dane i łączymy się z bramką płatności."
              : "Sprawdzamy dane, dokumenty i numer umowy."
            : undefined
        }
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-[#3f3f46]">
              <span aria-live="polite">
                {allDone
                  ? "Gotowe"
                  : waitingOnPayment
                    ? `${currentStep?.title}…`
                    : currentStep
                      ? currentStep.title
                      : "Przetwarzanie…"}
              </span>
              <span className={azureClasses.mono}>{progressValue}%</span>
            </div>
            <Progress
              value={progressValue}
              className="h-2 bg-[#eceef3] [&>div]:bg-[var(--client-accent)] [&>div]:transition-none"
            />
          </div>

          <ul className="space-y-2" aria-label="Postęp przygotowania rezerwacji">
            {steps.map((step, index) => {
              const status: StepStatus =
                index < completedCount
                  ? "done"
                  : index === activeIndex && !allDone
                    ? "active"
                    : "pending";

              return (
                <li
                  key={step.id}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
                    status === "active" &&
                      cn(
                        "border-[var(--client-accent-soft)]",
                        azureClasses.bgAccentIce,
                      ),
                    status === "done" && "border-[#bbf7d0] bg-[#f0fdf4]",
                    status === "pending" && "border-[#eceef3] bg-[#f7f8fb]",
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {status === "done" ? (
                      <CheckCircle2
                        className="h-5 w-5 text-[#16a34a]"
                        aria-hidden
                      />
                    ) : status === "active" ? (
                      <Loader2
                        className={cn(
                          "h-5 w-5 animate-spin",
                          azureClasses.textAccent,
                        )}
                        aria-hidden
                      />
                    ) : (
                      <Circle className="h-5 w-5 text-[#a1a1aa]" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        status === "pending"
                          ? "text-[#a1a1aa]"
                          : "text-[#0a0a0a]",
                      )}
                    >
                      {step.title}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-xs leading-relaxed",
                        status === "pending"
                          ? "text-[#a1a1aa]"
                          : "text-[#3f3f46]",
                      )}
                    >
                      {step.subtitle}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <Separator className="bg-[#eceef3]" />

          <p className="text-center text-xs leading-relaxed text-[#a1a1aa]">
            {mode === "payment"
              ? "To może potrwać chwilę. Nie zamykaj tej strony — zaraz przejdziesz do płatności."
              : "To może potrwać chwilę. Nie zamykaj tej strony."}
          </p>
        </div>
      </AzureCard>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <ClientPanelShell containerClassName="max-w-xl">{content}</ClientPanelShell>
  );
}
