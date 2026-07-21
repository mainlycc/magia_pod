"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { azureClasses } from "./azure-theme";

export function getStepKicker(stepIndex: number, totalSteps: number) {
  return `Krok ${String(stepIndex + 1).padStart(2, "0")} z ${String(totalSteps).padStart(2, "0")}`;
}

type AzureFormFooterProps = {
  children: React.ReactNode;
  className?: string;
  align?: "between" | "end";
};

export function AzureFormFooter({
  children,
  className,
  align = "between",
}: AzureFormFooterProps) {
  return (
    <div
      className={cn(
        "mt-6 flex gap-3 border-t border-[#eceef3] pt-6",
        align === "between" ? "justify-between" : "justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AzureBtnPrimary({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(azureClasses.btnPrimary, "h-auto border-none", className)}
      {...props}
    />
  );
}

export function AzureBtnOutline({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      className={cn(azureClasses.btnOutline, "h-auto shadow-none", className)}
      {...props}
    />
  );
}

export function AzureBtnGhost({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      className={cn(azureClasses.btnGhost, "h-auto shadow-none", className)}
      {...props}
    />
  );
}

export function AzureCancelLink({ href }: { href: string }) {
  return (
    <AzureBtnGhost asChild>
      <Link href={href}>← Anuluj</Link>
    </AzureBtnGhost>
  );
}

type AzurePricePanelProps = {
  depositCents: number;
  totalCents: number;
  firstPercent: number;
  tripBaseCents: number;
  addonsCents: number;
  participantLines?: Array<{ label: string; amountCents: number }>;
};

function formatPln(cents: number) {
  return (Math.max(0, cents || 0) / 100).toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getHeroAmountTextClass(formattedAmount: string) {
  const len = formattedAmount.length;
  if (len > 11) return "text-[26px] sm:text-[32px]";
  if (len > 9) return "text-[32px] sm:text-[40px]";
  if (len > 7) return "text-[36px] sm:text-[46px]";
  return "text-[40px] sm:text-[52px]";
}

const priceAmountClass = cn(azureClasses.mono, "shrink-0 whitespace-nowrap tabular-nums");

export function AzurePricePanel({
  depositCents,
  totalCents,
  firstPercent,
  tripBaseCents,
  addonsCents,
  participantLines = [],
}: AzurePricePanelProps) {
  const remainingCents = Math.max(0, totalCents - depositCents);
  const depositFormatted = formatPln(depositCents);
  const totalFormatted = formatPln(totalCents);
  const remainingFormatted = formatPln(remainingCents);

  return (
    <div className={azureClasses.pricePanel}>
      <div className={azureClasses.pricePanelBar} aria-hidden />
      <div className="p-6 sm:p-[28px_26px]">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1e90ff]" aria-hidden />
          Do zapłaty teraz
        </div>

        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span
            className={cn(
              azureClasses.mono,
              getHeroAmountTextClass(depositFormatted),
              "max-w-full font-semibold leading-none",
            )}
          >
            {depositFormatted}
          </span>
          <span className="shrink-0 text-[20px] font-medium text-white/80 sm:text-[22px]">PLN</span>
        </div>
        <div className="mt-1.5 space-y-0.5 text-[13px] font-medium text-white/85">
          <p>Zaliczka {firstPercent}% z</p>
          <p className={cn(azureClasses.mono, "font-semibold text-white")}>{totalFormatted} PLN</p>
        </div>

        {participantLines.length > 0 && (
          <div className="mt-5 flex flex-col gap-2.5 border-t border-white/20 pt-4">
            {participantLines.map((line) => (
              <div key={line.label} className="flex min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] font-medium text-white/90">{line.label}</span>
                <span className={cn(priceAmountClass, "text-[13px] font-semibold text-white")}>
                  {formatPln(line.amountCents)} PLN
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-white/20 pt-3.5">
          <div className="mb-2 flex min-w-0 items-baseline justify-between gap-3">
            <span className="shrink-0 text-sm font-semibold">Wartość rezerwacji</span>
            <span className={cn(priceAmountClass, "text-[17px] font-semibold")}>{totalFormatted} PLN</span>
          </div>
          <div className="flex min-w-0 justify-between gap-3 text-xs font-medium text-white/80">
            <span className="shrink-0">Pozostałe do zapłaty</span>
            <span className={priceAmountClass}>{remainingFormatted} PLN</span>
          </div>
        </div>

        <div className="mt-5 rounded-xl border-l-[3px] border-white bg-[#0a0a0a] p-3.5">
          <div className="mb-2.5 text-[10.5px] font-semibold tracking-wide text-white/70">
            HARMONOGRAM
          </div>
          <div className="mb-2 flex min-w-0 items-center gap-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#1e90ff]" aria-hidden />
            <span className="min-w-0 flex-1 text-xs font-medium">Dziś · zaliczka</span>
            <span className={cn(priceAmountClass, "text-xs font-semibold")}>{depositFormatted} PLN</span>
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full border-[1.5px] border-[#1e90ff] bg-transparent"
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-xs font-medium text-white/70">Pozostała kwota</span>
            <span className={cn(priceAmountClass, "text-xs font-medium text-white/70")}>
              {remainingFormatted} PLN
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-1 text-xs text-white/75">
          <div className="flex min-w-0 justify-between gap-3">
            <span className="shrink-0">Cena wycieczki</span>
            <span className={priceAmountClass}>{formatPln(tripBaseCents)} PLN</span>
          </div>
          <div className="flex min-w-0 justify-between gap-3">
            <span className="shrink-0">Usługi dodatkowe</span>
            <span className={priceAmountClass}>{formatPln(addonsCents)} PLN</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type ParticipantCardShellProps = {
  index: number;
  firstName?: string;
  lastName?: string;
  isMain?: boolean;
  children: React.ReactNode;
  onRemove?: () => void;
  canRemove?: boolean;
};

export function ParticipantCardShell({
  index,
  firstName,
  lastName,
  isMain,
  children,
  onRemove,
  canRemove,
}: ParticipantCardShellProps) {
  const initials =
    firstName && lastName
      ? `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
      : null;
  const hasName = Boolean(firstName || lastName);

  return (
    <div className={azureClasses.participantCard}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold tracking-tight",
              hasName
                ? "bg-[#1e90ff] text-white shadow-[0_6px_14px_-6px_#1e90ff]"
                : "border border-dashed border-[#dadce3] bg-[#eceef3] text-[#a1a1aa]",
            )}
          >
            {initials || `0${index + 1}`}
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-[#a1a1aa]">
              <span>UCZESTNIK {String(index + 1).padStart(2, "0")}</span>
              {isMain && (
                <span className="rounded-full bg-[#1e90ff] px-2 py-0.5 text-[10px] font-bold text-white">
                  ZGŁASZAJĄCY
                </span>
              )}
            </div>
            <div className="mt-0.5 text-lg font-semibold tracking-tight text-[#0a0a0a]">
              {hasName ? (
                `${firstName ?? ""} ${lastName ?? ""}`.trim()
              ) : (
                <span className="azure-italic-accent text-[#a1a1aa]">Dane do uzupełnienia</span>
              )}
            </div>
          </div>
        </div>
        {canRemove && onRemove && (
          <AzureBtnOutline type="button" onClick={onRemove} className="px-3 py-1.5 text-xs">
            Usuń
          </AzureBtnOutline>
        )}
      </div>
      {children}
    </div>
  );
}

type ApplicantTypeToggleProps = {
  value: "individual" | "company";
  onChange: (value: "individual" | "company") => void;
};

export function ApplicantTypeToggle({ value, onChange }: ApplicantTypeToggleProps) {
  const options = [
    {
      id: "individual" as const,
      label: "1. Osoba fizyczna",
      desc: "Rezerwacja na imię i nazwisko",
    },
    {
      id: "company" as const,
      label: "2. Firma",
      desc: "Faktura na NIP, wyjazd integracyjny",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "relative overflow-hidden rounded-[14px] p-5 text-left transition-all",
              active ? azureClasses.typeToggleActive : azureClasses.typeToggleInactive,
            )}
          >
            {active && <div className={azureClasses.typeToggleBar} aria-hidden />}
            <div
              className={cn(
                "absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px]",
                active ? "border-white bg-transparent" : "border-[#dadce3] bg-white",
              )}
            >
              {active && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
            </div>
            <div className={cn("mb-2.5 text-[17px] font-semibold tracking-tight", active ? "text-white" : "text-[#0a0a0a]")}>
              {option.label}
            </div>
            <div className={cn("text-[12.5px]", active ? "text-white/85" : "text-[#3f3f46]")}>
              {option.desc}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function AzureInfoAlert({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7 grid grid-cols-[auto_1fr] items-start gap-4 rounded-[14px] border border-[#cee4fc] bg-[#e8f2fe] p-[18px_22px]">
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#1e90ff] text-white shadow-[0_6px_14px_-6px_#1e90ff]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <circle cx="12" cy="16.5" r="0.8" fill="currentColor" />
        </svg>
      </div>
      <div>
        <div className="mb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-[#1e90ff]">{title}</div>
        <div className="text-sm font-medium leading-relaxed text-[#0a0a0a]">{children}</div>
      </div>
    </div>
  );
}
