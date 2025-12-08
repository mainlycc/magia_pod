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
          // Nie odświeżamy całej strony - Realtime subscription zaktualizuje dane automatycznie
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
          // Zaktualizuj lokalny stan zamiast przeładowywać wszystkie dane
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            setBookings((prev) =>
              prev.map((booking) =>
                booking.id === payload.new.id
                  ? { ...booking, ...payload.new } as BookingWithTrip
                  : booking
              )
            );
          } else {
            // Fallback: odśwież dane tylko jeśli nie możemy zaktualizować lokalnie
            loadData();
          }
        }
      )
      .subscribe();

    // Odśwież dane przy powrocie na stronę (focus okna) - tylko jeśli strona była nieaktywna dłużej niż 30 sekund
    let lastFocusTime = Date.now();
    const handleFocus = () => {
      const now = Date.now();
      // Odśwież tylko jeśli minęło więcej niż 30 sekund od ostatniego focusu
      if (now - lastFocusTime > 30000) {
        loadData();
        lastFocusTime = now;
      }
    };
    window.addEventListener("focus", handleFocus);

    // Polling usunięty - Realtime subscription wystarczy do aktualizacji danych
    // Jeśli Realtime nie działa, użytkownik może ręcznie odświeżyć stronę

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", handleFocus);
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
        console.log(`[Admin Payments] Payment status counts from API:`, paymentStatusCounts);
        console.log(`[Admin Payments] Total bookings from API: ${bookingsData.length}`);
        
        // Loguj przykładowe bookings z statusem "paid"
        const paidBookings = bookingsData.filter(b => b.payment_status === "paid");
        if (paidBookings.length > 0) {
          console.log(`[Admin Payments] ✓ Found ${paidBookings.length} paid bookings:`, paidBookings.slice(0, 5).map(b => ({
            id: b.id,
            booking_ref: b.booking_ref,
            payment_status: b.payment_status,
            created_at: b.created_at,
          })));
        } else {
          console.warn(`[Admin Payments] ⚠ No paid bookings found in API response!`);
        }
        
        // Loguj wszystkie statusy płatności dla debugowania
        console.log(`[Admin Payments] All payment statuses:`, bookingsData.map(b => ({
          booking_ref: b.booking_ref,
          payment_status: b.payment_status,
        })));
        
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
        // Odśwież dane po sprawdzeniu statusu - Realtime powinien też zaktualizować automatycznie
        await loadData();
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
      const statusCounts = bookings.reduce((acc, b) => {
        acc[b.payment_status] = (acc[b.payment_status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[Admin Payments] Current state payment status counts:`, statusCounts);
      console.log(`[Admin Payments] Paid bookings in state: ${bookings.filter(b => b.payment_status === "paid").length}`);
      console.log("[Admin Payments] Sample booking:", bookings[0]);
      
      // Sprawdź czy są jakieś płatności z statusem "paid"
      const paidInState = bookings.filter(b => b.payment_status === "paid");
      if (paidInState.length > 0) {
        console.log(`[Admin Payments] ✓ Found ${paidInState.length} paid bookings in state:`, paidInState.slice(0, 3).map(b => ({
          booking_ref: b.booking_ref,
          payment_status: b.payment_status,
        })));
      } else {
        console.warn(`[Admin Payments] ⚠ No paid bookings in state!`);
      }
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
      
      // NAJPIERW odśwież dane, żeby mieć najnowsze bookings
      await loadData();
      
      // Pobierz wszystkie bookings z statusem unpaid lub partial
      const unpaidBookings = bookings.filter(
        b => b.payment_status === "unpaid" || b.payment_status === "partial"
      );
      
      console.log(`[Admin Payments] Checking ${unpaidBookings.length} unpaid/partial bookings in Paynow...`);
      console.log(`[Admin Payments] All bookings count: ${bookings.length}`);
      console.log(`[Admin Payments] Paid bookings count: ${bookings.filter(b => b.payment_status === "paid").length}`);
      
      // Sprawdź status każdej płatności
      let updatedCount = 0;
      let checkedCount = 0;
      for (const booking of unpaidBookings) {
        try {
          checkedCount++;
          console.log(`[Admin Payments] Checking booking ${checkedCount}/${unpaidBookings.length}: ${booking.booking_ref}`);
          
          const response = await fetch("/api/payments/paynow/check-status", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ booking_ref: booking.booking_ref }),
          });

          const data = await response.json();
          console.log(`[Admin Payments] Check status response for ${booking.booking_ref}:`, {
            success: data.success,
            payment_status: data.payment_status,
            paynow_status: data.paynow_status,
            message: data.message,
          });
          
          if (data.success && (data.payment_status === "paid" || data.paynow_status === "CONFIRMED")) {
            updatedCount++;
            console.log(`[Admin Payments] ✓ Updated booking ${booking.booking_ref} to paid`);
          }
        } catch (error) {
          console.error(`[Admin Payments] Error checking status for ${booking.booking_ref}:`, error);
        }
      }
      
      console.log(`[Admin Payments] Checked ${checkedCount} bookings, updated ${updatedCount}`);
      
      // Odśwież dane po sprawdzeniu wszystkich płatności - Realtime powinien też zaktualizować automatycznie
      await loadData();
      
      if (updatedCount > 0) {
        toast.success(`Zaktualizowano ${updatedCount} płatności. Odświeżanie danych...`);
      } else {
        toast.info(`Sprawdzono ${checkedCount} płatności. Nie znaleziono nowych płatności do zaktualizowania.`);
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

