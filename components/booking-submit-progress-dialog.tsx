"use client";

import { Check, Circle, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BookingSubmitProgressStatus = "running" | "success" | "error";

export const BOOKING_SUBMIT_STEPS_PAYMENT = [
  "Sprawdzanie danych uczestników",
  "Weryfikacja zgód i dokumentów",
  "Tworzenie rezerwacji",
  "Inicjalizacja płatności",
  "Przekierowanie do bramki płatności",
] as const;

export const BOOKING_SUBMIT_STEPS_RESERVE = [
  "Sprawdzanie danych uczestników",
  "Weryfikacja zgód i dokumentów",
  "Tworzenie rezerwacji",
  "Wysyłanie potwierdzenia",
  "Otwieranie panelu rezerwacji",
] as const;

/** Indeks kroku „Tworzenie rezerwacji” — czeka na odpowiedź API. */
export const BOOKING_SUBMIT_API_STEP_INDEX = 2;

type BookingSubmitProgressDialogProps = {
  open: boolean;
  withPayment: boolean;
  /** Indeks aktywnego / ostatnio ukończonego kroku (0-based). */
  activeStepIndex: number;
  status: BookingSubmitProgressStatus;
  errorMessage?: string | null;
  onClose?: () => void;
};

function StepIcon({
  state,
}: {
  state: "pending" | "active" | "done" | "error";
}) {
  if (state === "done") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
        <Check className="size-4" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
        <X className="size-4" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary/5 text-primary">
        <Loader2 className="size-4 animate-spin" aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#dadce3] text-[#a1a1aa]">
      <Circle className="size-3.5" aria-hidden />
    </span>
  );
}

export function BookingSubmitProgressDialog({
  open,
  withPayment,
  activeStepIndex,
  status,
  errorMessage,
  onClose,
}: BookingSubmitProgressDialogProps) {
  const steps = withPayment
    ? BOOKING_SUBMIT_STEPS_PAYMENT
    : BOOKING_SUBMIT_STEPS_RESERVE;

  const completedCount =
    status === "success"
      ? steps.length
      : status === "error"
        ? activeStepIndex
        : Math.min(activeStepIndex, steps.length);
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const lockDismiss = status === "running" || status === "success";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !lockDismiss) onClose?.();
      }}
    >
      <DialogContent
        showCloseButton={status === "error"}
        className="gap-5 sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (lockDismiss) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (lockDismiss) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (lockDismiss) e.preventDefault();
        }}
      >
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-xl tracking-tight">
            {status === "error"
              ? "Nie udało się dokończyć"
              : withPayment
                ? "Przygotowujemy płatność"
                : "Tworzymy rezerwację"}
          </DialogTitle>
          <DialogDescription>
            {status === "error"
              ? "Wystąpił problem podczas przetwarzania. Możesz zamknąć okno i spróbować ponownie."
              : "To potrwa chwilę — odhaczamy kolejne kroki."}
          </DialogDescription>
        </DialogHeader>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-[#eceef3]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              status === "error" ? "bg-destructive" : "bg-primary",
            )}
            style={{ width: `${Math.max(8, progressPercent)}%` }}
          />
        </div>

        <ul className="space-y-3" aria-live="polite">
          {steps.map((label, index) => {
            let state: "pending" | "active" | "done" | "error" = "pending";
            if (status === "success" || index < activeStepIndex) {
              state = "done";
            } else if (index === activeStepIndex) {
              state = status === "error" ? "error" : "active";
            }

            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors",
                  state === "active" && "bg-[#f7f8fb]",
                  state === "error" && "bg-destructive/5",
                )}
              >
                <StepIcon state={state} />
                <span
                  className={cn(
                    "text-sm leading-snug",
                    state === "done" && "text-[#0a0a0a]",
                    state === "active" && "font-medium text-[#0a0a0a]",
                    state === "pending" && "text-[#a1a1aa]",
                    state === "error" && "font-medium text-destructive",
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>

        {status === "error" && (
          <div className="space-y-3">
            {errorMessage ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive whitespace-pre-wrap">
                {errorMessage}
              </p>
            ) : null}
            <Button type="button" variant="outline" className="w-full" onClick={onClose}>
              Zamknij
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
