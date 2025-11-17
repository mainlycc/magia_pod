"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAYMENT_STATUS_OPTIONS,
  type PaymentStatusValue,
} from "./payment-status";

type PaymentStatusSelectProps = {
  bookingId: string;
  initialStatus: PaymentStatusValue;
};

export function PaymentStatusSelect({
  bookingId,
  initialStatus,
}: PaymentStatusSelectProps) {
  const router = useRouter();
  const [value, setValue] = useState<PaymentStatusValue>(initialStatus);
  const [isPending, startTransition] = useTransition();

  const handleChange = (nextStatus: PaymentStatusValue) => {
    if (nextStatus === value) return;

    const previous = value;
    setValue(nextStatus);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/bookings/${bookingId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ payment_status: nextStatus }),
          });

          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error ?? "update_failed");
          }

          toast.success("Status płatności zaktualizowany");
          router.refresh();
        } catch (error) {
          setValue(previous);
          toast.error("Nie udało się zapisać statusu płatności");
          console.error(error);
        }
      })();
    });
  };

  return (
    <Select value={value} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="min-w-[200px]" aria-label="Zmień status płatności">
        <SelectValue placeholder="Wybierz status" />
        {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      </SelectTrigger>
      <SelectContent>
        {PAYMENT_STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

