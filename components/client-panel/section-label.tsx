import { cn } from "@/lib/utils";
import { azureClasses } from "./azure-theme";

type SectionLabelProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div className={cn(azureClasses.sectionLabel, className)}>
      <span className={azureClasses.sectionLabelDot} aria-hidden />
      {children}
    </div>
  );
}
