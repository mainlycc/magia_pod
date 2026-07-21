"use client";

import { cn } from "@/lib/utils";
import { azureClasses } from "./azure-theme";

export type BookingStepperStep = {
  id: string;
  title: string;
  description: string;
};

type BookingStepperProps = {
  steps: BookingStepperStep[];
  currentStepId: string;
  maxAvailableIndex: number;
  onStepClick?: (stepId: string) => void;
  className?: string;
};

export function BookingStepper({
  steps,
  currentStepId,
  maxAvailableIndex,
  onStepClick,
  className,
}: BookingStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div
      className={cn(
        "mb-9 rounded-[18px] border border-[#dadce3] bg-white p-5 sm:p-[20px_24px]",
        className,
      )}
    >
      <div className="mb-5 flex gap-2">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const filled = stepNumber <= activeIndex + 1;
          const isCurrent = index === activeIndex;

          return (
            <button
              key={step.id}
              type="button"
              disabled={index > maxAvailableIndex + 1}
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                "relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#eceef3]",
                index <= maxAvailableIndex + 1 ? "cursor-pointer" : "cursor-not-allowed opacity-50",
              )}
              aria-label={`Krok ${stepNumber}: ${step.title}`}
            >
              {filled && (
                <span
                  className={cn(
                    "absolute inset-0 rounded-full",
                    isCurrent ? "bg-[#1e90ff]" : "bg-[#0a0a0a]",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-none lg:flex">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const active = index === activeIndex;
          const done = index < activeIndex;
          const disabled = index > maxAvailableIndex + 1;

          return (
            <button
              key={step.id}
              type="button"
              disabled={disabled}
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                "flex flex-1 items-center gap-3 text-left transition-opacity",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              )}
            >
              <div
                className={cn(
                  "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[13px] font-semibold",
                  azureClasses.mono,
                  active && "bg-[#1e90ff] text-white shadow-[0_6px_14px_-6px_#1e90ff]",
                  done && !active && "bg-[#cee4fc] text-[#1e90ff]",
                  !active && !done && "bg-[#eceef3] text-[#a1a1aa]",
                )}
              >
                {done ? "✓" : `0${stepNumber}`}
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-[14.5px] leading-tight tracking-tight",
                    active && "font-semibold text-[#0a0a0a]",
                    done && !active && "font-medium text-[#3f3f46]",
                    !active && !done && "font-medium text-[#a1a1aa]",
                  )}
                >
                  {step.title}
                </div>
                <div className="mt-0.5 text-xs font-medium text-[#a1a1aa]">{step.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
