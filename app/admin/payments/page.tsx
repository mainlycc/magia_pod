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
import { Loader2Icon, RefreshCwIcon, CheckCircle2Icon } from "lucide-react";

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
    console.log("[Admin Payments] Component mounted, loading data...");
    loadData();

    // Subskrybuj zmiany w tabeli bookings, aby automatycznie odświeżać dane
    const supabase = createClient();
    const channel = supabase
      .channel("bookings-payment-status-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
        },
        (payload) => {
          console.log("[Admin Payments] Realtime: Booking updated:", {
            event: payload.eventType,
            table: payload.table,
            new: payload.new,
            old: payload.old,
            timestamp: new Date().toISOString(),
          });
          // Odśwież dane po zmianie w rezerwacji
          loadData();
        }
      )
      .subscribe();

    // Odśwież dane przy powrocie na stronę (focus okna)
    const handleFocus = () => {
      loadData();
    };
    window.addEventListener("focus", handleFocus);

    // Polling jako fallback dla Realtime - odświeżaj dane co 5 sekund
    // To zapewnia, że nawet jeśli Realtime nie działa, dane będą aktualne
    const pollingInterval = setInterval(() => {
      console.log(`[Admin Payments] Polling: odświeżanie danych płatności... (${new Date().toISOString()})`);
      loadData();
    }, 5000); // 5 sekund - częstsze odświeżanie dla lepszej aktualności danych

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", handleFocus);
      clearInterval(pollingInterval);
    };
  }, []);

  const loadData = async () => {
    try {
      console.log("[Admin Payments] loadData called");
      setLoading(true);
      // Pobierz wszystkie rezerwacje z wycieczkami
      await loadBookings(null);
    } catch (err) {
      toast.error("Nie udało się wczytać danych");
      console.error("[Admin Payments] Error in loadData:", err);
    } finally {
      setLoading(false);
      console.log("[Admin Payments] loadData finished");
    }
  };

  const loadBookings = async (tripId: string | null) => {
    try {
      // Użyj API endpointu z admin clientem, który omija RLS
      // Dodaj timestamp do URL, aby wymusić pobranie nowych danych (bypass cache)
      const timestamp = Date.now();
      const url = tripId 
        ? `/api/admin/bookings?trip_id=${encodeURIComponent(tripId)}&_t=${timestamp}`
        : `/api/admin/bookings?_t=${timestamp}`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store", // Wyłącz cache, aby zawsze pobierać najnowsze dane
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("[Admin Payments] API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorData?.error || `fetch_failed: ${response.status}`);
      }

      const bookingsData: BookingWithTrip[] = await response.json();

      console.log(`[Admin Payments] Received ${bookingsData?.length || 0} bookings from API at ${new Date().toISOString()}`);

      if (bookingsData && Array.isArray(bookingsData)) {
        // Loguj statusy płatności dla debugowania
        const paymentStatusCounts = bookingsData.reduce((acc, b) => {
          acc[b.payment_status] = (acc[b.payment_status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log(`[Admin Payments] Payment status counts:`, paymentStatusCounts);
        
        // Loguj przykładowe bookings z statusem "paid"
        const paidBookings = bookingsData.filter(b => b.payment_status === "paid");
        if (paidBookings.length > 0) {
          console.log(`[Admin Payments] Found ${paidBookings.length} paid bookings:`, paidBookings.slice(0, 3).map(b => ({
            id: b.id,
            booking_ref: b.booking_ref,
            payment_status: b.payment_status,
          })));
        }
        
        console.log(`[Admin Payments] Setting ${bookingsData.length} bookings to state`);
        setBookings(bookingsData);
      } else {
        console.warn("[Admin Payments] Invalid bookings data format:", bookingsData);
        setBookings([]);
      }
    } catch (err) {
      toast.error("Nie udało się wczytać płatności");
      console.error("[Admin Payments] Error loading bookings:", err);
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

  const handleCheckPaynowStatus = async (bookingRef: string) => {
    try {
      toast.info("Sprawdzanie statusu płatności w Paynow...");
      const response = await fetch("/api/payments/paynow/check-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ booking_ref: bookingRef }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "check_failed");
      }

      if (data.success) {
        toast.success(data.message || "Status płatności został zaktualizowany");
        // Odśwież dane natychmiast po sprawdzeniu statusu
        await loadData();
        // Dodatkowo odśwież po krótkim opóźnieniu, aby upewnić się że zmiany są widoczne
        setTimeout(() => {
          loadData();
        }, 500);
        // Jeszcze jedno odświeżenie po dłuższym opóźnieniu dla pewności
        setTimeout(() => {
          loadData();
        }, 2000);
      } else {
        toast.error(data.message || "Nie udało się sprawdzić statusu płatności");
      }
    } catch (error) {
      console.error("Error checking Paynow status:", error);
      toast.error("Nie udało się sprawdzić statusu płatności");
    }
  };

  const filteredBookings = bookings;
  
  // Debug: loguj stan bookings
  useEffect(() => {
    console.log(`[Admin Payments] Current bookings state: ${bookings.length} bookings`);
    if (bookings.length > 0) {
      console.log("[Admin Payments] Sample booking:", bookings[0]);
    }
  }, [bookings]);

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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCheckPaynowStatus(booking.booking_ref)}
                  title="Sprawdź status płatności w Paynow"
                >
                  <CheckCircle2Icon className="size-4" />
                </Button>
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

  const handleCheckAllPaynowStatuses = async () => {
    try {
      toast.info("Sprawdzanie statusów wszystkich płatności w Paynow...");
      setLoading(true);
      
      // Pobierz wszystkie bookings z statusem unpaid lub partial
      const unpaidBookings = bookings.filter(
        b => b.payment_status === "unpaid" || b.payment_status === "partial"
      );
      
      console.log(`[Admin Payments] Checking ${unpaidBookings.length} unpaid/partial bookings in Paynow...`);
      
      // Sprawdź status każdej płatności
      let updatedCount = 0;
      for (const booking of unpaidBookings) {
        try {
          const response = await fetch("/api/payments/paynow/check-status", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ booking_ref: booking.booking_ref }),
          });

          const data = await response.json();
          if (data.success && data.payment_status === "paid") {
            updatedCount++;
            console.log(`[Admin Payments] Updated booking ${booking.booking_ref} to paid`);
          }
        } catch (error) {
          console.error(`[Admin Payments] Error checking status for ${booking.booking_ref}:`, error);
        }
      }
      
      // Odśwież dane po sprawdzeniu wszystkich płatności
      await loadData();
      
      if (updatedCount > 0) {
        toast.success(`Zaktualizowano ${updatedCount} płatności`);
      } else {
        toast.info("Nie znaleziono nowych płatności do zaktualizowania");
      }
    } catch (error) {
      console.error("[Admin Payments] Error checking all Paynow statuses:", error);
      toast.error("Nie udało się sprawdzić statusów płatności");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {bookings.length > 0 && (
            <span>
              Łącznie rezerwacji: {bookings.length} | 
              Opłacone: {bookings.filter(b => b.payment_status === "paid").length} | 
              Nieopłacone: {bookings.filter(b => b.payment_status === "unpaid").length} | 
              Częściowe: {bookings.filter(b => b.payment_status === "partial").length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckAllPaynowStatuses}
            disabled={loading}
          >
            <CheckCircle2Icon className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Sprawdź wszystkie w Paynow
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            disabled={loading}
          >
            <RefreshCwIcon className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Odśwież
          </Button>
        </div>
      </div>
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

