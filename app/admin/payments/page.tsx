"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReusableTable } from "@/components/reusable-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getPaymentStatusBadgeClass,
  getPaymentStatusLabel,
  type PaymentStatusValue,
} from "../trips/[id]/bookings/payment-status";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2Icon } from "lucide-react";

type BookingWithTrip = {
  id: string;
  booking_ref: string;
  contact_email: string | null;
  contact_phone: string | null;
  payment_status: PaymentStatusValue;
  created_at: string | null;
  trip_id: string;
  trips: {
    id: string;
    title: string;
    slug: string;
  } | null;
};

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
});

// Wrapper dla PaymentStatusSelect z callbackiem
function PaymentStatusSelectWithRefresh({
  bookingId,
  initialStatus,
  onStatusChange,
}: {
  bookingId: string;
  initialStatus: PaymentStatusValue;
  onStatusChange?: (bookingId: string, newStatus: PaymentStatusValue) => void;
}) {
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
          onStatusChange?.(bookingId, nextStatus);
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
        {[
          { value: "unpaid", label: "Nieopłacona" },
          { value: "partial", label: "Częściowa" },
          { value: "paid", label: "Opłacona" },
          { value: "overpaid", label: "Nadpłata" },
        ].map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingWithTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Pobierz wszystkie rezerwacje z wycieczkami
      await loadBookings(null);
    } catch (err) {
      toast.error("Nie udało się wczytać danych");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async (tripId: string | null) => {
    try {
      const supabase = createClient();
      let query = supabase
        .from("bookings")
        .select(
          `
          id,
          booking_ref,
          contact_email,
          contact_phone,
          payment_status,
          created_at,
          trip_id,
          trips:trips!inner(id, title, slug)
        `,
        )
        .order("created_at", { ascending: false });

      if (tripId) {
        query = query.eq("trip_id", tripId);
      }

      const { data: bookingsData, error } = await query;

      if (error) {
        throw error;
      }

      if (bookingsData) {
        // Mapuj dane, aby przekształcić tablicę trips w pojedynczy obiekt
        const mappedBookings: BookingWithTrip[] = bookingsData.map((booking: any) => ({
          ...booking,
          trips: Array.isArray(booking.trips) && booking.trips.length > 0 
            ? booking.trips[0] 
            : null,
        }));
        setBookings(mappedBookings);
      }
    } catch (err) {
      toast.error("Nie udało się wczytać płatności");
      console.error(err);
    }
  };

  const handlePaymentStatusChange = (bookingId: string, newStatus: PaymentStatusValue) => {
    // Zaktualizuj status w state bezpośrednio
    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === bookingId
          ? { ...booking, payment_status: newStatus }
          : booking
      )
    );
  };

  const filteredBookings = bookings;

  const columns = useMemo<ColumnDef<BookingWithTrip>[]>(
    () => [
      {
        accessorKey: "booking_ref",
        header: "Numer rezerwacji",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.booking_ref}</span>
        ),
      },
      {
        id: "trip",
        header: "Wycieczka",
        cell: ({ row }) =>
          row.original.trips ? (
            <Link
              href={`/admin/trips/${row.original.trip_id}/bookings`}
              className="text-primary hover:underline"
            >
              {row.original.trips.title}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "contact",
        header: "Kontakt",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="text-sm">
              {row.original.contact_email ?? "—"}
            </div>
            {row.original.contact_phone && (
              <div className="text-xs text-muted-foreground">
                {row.original.contact_phone}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "payment_status",
        header: "Status płatności",
        cell: ({ row }) => {
          const booking = row.original;
          const createdAtLabel = booking.created_at
            ? dateFormatter.format(new Date(booking.created_at))
            : "—";

          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "border text-xs font-medium uppercase",
                    getPaymentStatusBadgeClass(booking.payment_status),
                  )}
                >
                  {getPaymentStatusLabel(booking.payment_status)}
                </Badge>
                <PaymentStatusSelectWithRefresh
                  key={`${booking.id}-${booking.payment_status}`}
                  bookingId={booking.id}
                  initialStatus={booking.payment_status}
                  onStatusChange={handlePaymentStatusChange}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                Utworzono: {createdAtLabel}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Akcje",
        cell: ({ row }) => (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/trips/${row.original.trip_id}/bookings`}>
              Szczegóły
            </Link>
          </Button>
        ),
      },
    ],
    []
  );

  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      <ReusableTable
        columns={columns}
        data={filteredBookings}
        searchable={true}
        searchPlaceholder="Szukaj po numerze rezerwacji lub emailu..."
        searchColumn="booking_ref"
        onAdd={() => router.push("/admin/bookings")}
        addButtonLabel="Dodaj płatność"
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak płatności"
      />
    </div>
  );
}

