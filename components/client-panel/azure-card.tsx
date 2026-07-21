import { cn } from "@/lib/utils";
import { azureClasses } from "./azure-theme";

type AzureCardAccent = "blue" | "black" | "success" | "danger" | "none";

type AzureCardProps = {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  accent?: AzureCardAccent;
  kicker?: string;
  title?: React.ReactNode;
  subtitle?: string;
  header?: React.ReactNode;
};

const accentBarClass: Record<Exclude<AzureCardAccent, "none">, string> = {
  blue: azureClasses.cardAccentBlue,
  black: azureClasses.cardAccentBlack,
  success: azureClasses.cardAccentSuccess,
  danger: azureClasses.cardAccentDanger,
};

export function AzureCard({
  children,
  className,
  innerClassName,
  accent = "none",
  kicker,
  title,
  subtitle,
  header,
}: AzureCardProps) {
  const hasHeader = Boolean(header || kicker || title || subtitle);

  return (
    <div className={cn(azureClasses.card, className)}>
      {accent !== "none" && <div className={accentBarClass[accent]} aria-hidden />}
      <div className={cn(azureClasses.cardInner, innerClassName)}>
        {header}
        {hasHeader && !header && (
          <div className="mb-7">
            {kicker && (
              <div className={cn(azureClasses.kicker, "mb-3")}>
                <span className={azureClasses.kickerDot} aria-hidden />
                {kicker}
              </div>
            )}
            {title && <div className={azureClasses.cardTitle}>{title}</div>}
            {subtitle && <p className={azureClasses.cardSub}>{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
