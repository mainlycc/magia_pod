"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type Trip = {
  id: string;
  title: string;
  slug: string;
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
  const [bookings, setBookings] = useState<BookingWithTrip[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Pobierz wszystkie wycieczki dla filtrowania
      const { data: tripsData } = await supabase
        .from("trips")
        .select("id, title, slug")
        .order("title", { ascending: true });

      if (tripsData) {
        setTrips(tripsData);
      }

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

  const handleTripFilterChange = (value: string) => {
    const tripId = value === "all" ? null : value;
    setSelectedTripId(tripId);
    loadBookings(tripId);
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

  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Płatności</h1>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <label htmlFor="trip-filter" className="text-sm font-medium">
            Filtruj według wycieczki:
          </label>
          <Select
            value={selectedTripId ?? "all"}
            onValueChange={handleTripFilterChange}
          >
            <SelectTrigger id="trip-filter" className="w-[300px]">
              <SelectValue placeholder="Wybierz wycieczkę" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie wycieczki</SelectItem>
              {trips.map((trip) => (
                <SelectItem key={trip.id} value={trip.id}>
                  {trip.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            Znaleziono: {filteredBookings.length} rezerwacji
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numer rezerwacji</TableHead>
              <TableHead>Wycieczka</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead>Status płatności</TableHead>
              <TableHead>Data utworzenia</TableHead>
              <TableHead>Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Brak płatności
                </TableCell>
              </TableRow>
            ) : (
              filteredBookings.map((booking) => {
                const createdAtLabel = booking.created_at
                  ? dateFormatter.format(new Date(booking.created_at))
                  : "—";

                return (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      {booking.booking_ref}
                    </TableCell>
                    <TableCell>
                      {booking.trips ? (
                        <Link
                          href={`/admin/trips/${booking.trip_id}/bookings`}
                          className="text-primary hover:underline"
                        >
                          {booking.trips.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          {booking.contact_email ?? "—"}
                        </div>
                        {booking.contact_phone && (
                          <div className="text-xs text-muted-foreground">
                            {booking.contact_phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
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
                          onStatusChange={(id, status) => handlePaymentStatusChange(id, status)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {createdAtLabel}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/admin/trips/${booking.trip_id}/bookings`}>
                          Szczegóły
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

