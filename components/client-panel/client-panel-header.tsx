"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { azureClasses } from "./azure-theme";

type ClientPanelHeaderProps = {
  title?: React.ReactNode;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  showBrand?: boolean;
  showSessionBadge?: boolean;
  className?: string;
};

export function ClientPanelHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Wróć do szczegółów",
  showBrand = true,
  showSessionBadge = false,
  className,
}: ClientPanelHeaderProps) {
  return (
    <header className={cn("mb-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
          {showBrand && (
            <Image
              src="/magia-podrozowania-logo.png"
              alt="Magia Podróżowania"
              width={2363}
              height={2363}
              className="block h-14 w-auto shrink-0 object-contain sm:h-16"
              priority
            />
          )}
          {title && (
            <h1 className="m-0 text-[26px] font-semibold leading-tight tracking-[-0.03em] text-[#0a0a0a] sm:text-[32px]">
              {title}
            </h1>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showSessionBadge && (
            <div className={azureClasses.badgeSuccess}>
              <span className={azureClasses.badgeSuccessDot} aria-hidden />
              Sesja aktywna
            </div>
          )}
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-full border border-[#dadce3] bg-white px-4 py-2 text-[13px] font-medium text-[#0a0a0a] no-underline transition-colors hover:bg-[#f7f8fb]"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              {backLabel}
            </Link>
          )}
        </div>
      </div>

      {subtitle && (
        <p className="mt-2 max-w-[640px] text-[14px] leading-snug text-[#3f3f46]">{subtitle}</p>
      )}
    </header>
  );
}

export function ClientPanelTitleAccent({ children }: { children: React.ReactNode }) {
  return <span className="azure-italic-accent">{children}</span>;
}
