"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReusableTable } from "@/components/reusable-table";
import {
  getPaymentStatusBadgeClass,
  getPaymentStatusLabel,
  type PaymentStatusValue,
} from "../trips/[id]/bookings/payment-status";
import { toast } from "sonner";

type BookingWithTrip = {
  id: string;
  booking_ref: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: "pending" | "confirmed" | "cancelled";
  payment_status: PaymentStatusValue;
  source?: string | null;
  created_at: string | null;
  trip_id: string;
  trips: {
    id: string;
    title: string;
    slug: string;
    start_date: string | null;
    end_date: string | null;
  } | null;
  agreements?: {
    id: string;
    status: "generated" | "sent" | "signed";
  }[];
};

type Trip = {
  id: string;
  title: string;
};

const getBookingStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "Wstępna",
    confirmed: "Potwierdzona",
    cancelled: "Anulowana",
  };
  return labels[status] || status;
};

const getAgreementStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    generated: "Wygenerowana",
    sent: "Wysłana",
    signed: "Podpisana",
  };
  return labels[status] || status;
};

export default function AdminBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingWithTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select(
          `
          id,
          booking_ref,
          contact_email,
          contact_phone,
          status,
          payment_status,
          source,
          created_at,
          trip_id,
          trips:trips!inner(id, title, slug, start_date, end_date),
          agreements:agreements(id, status)
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (bookingsData) {
        const mapped = bookingsData.map((booking: any) => ({
          ...booking,
          trips: Array.isArray(booking.trips) && booking.trips.length > 0
            ? booking.trips[0]
            : null,
          agreements: booking.agreements || [],
        }));

        setBookings(mapped);
      }
    } catch (err) {
      toast.error("Nie udało się wczytać rezerwacji");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo<ColumnDef<BookingWithTrip>[]>(
    () => [
      {
        accessorKey: "booking_ref",
        header: "Nr rezerwacji",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.booking_ref}</div>
        ),
      },
      {
        id: "client",
        header: "Klient",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.contact_email}</div>
            {row.original.contact_phone && (
              <div className="text-sm text-muted-foreground">
                {row.original.contact_phone}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "trip",
        header: "Wycieczka",
        cell: ({ row }) => (
          <div>{row.original.trips?.title || "-"}</div>
        ),
      },
      {
        id: "trip_dates",
        header: "Termin wyjazdu",
        cell: ({ row }) => {
          const trip = row.original.trips;
          if (!trip?.start_date) return "-";
          const start = new Date(trip.start_date).toLocaleDateString("pl-PL");
          const end = trip.end_date
            ? new Date(trip.end_date).toLocaleDateString("pl-PL")
            : "";
          return <div>{start} {end && `— ${end}`}</div>;
        },
      },
      {
        accessorKey: "source",
        header: "Źródło",
        cell: ({ row }) => {
          const source = row.original.source || "admin_panel";
          const label =
            source === "public_page"
              ? "Strona publiczna"
              : source === "admin_panel"
              ? "Panel admina"
              : source;
          return (
            <span className="text-xs text-muted-foreground">
              {label}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status rezerwacji",
        cell: ({ row }) => (
          <Badge variant="outline">
            {getBookingStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "agreement_status",
        header: "Status umowy",
        cell: ({ row }) => {
          const agreements = row.original.agreements || [];
          if (agreements.length === 0) {
            return <span className="text-sm text-muted-foreground">-</span>;
          }
          const latest = agreements[0];
          return (
            <Badge variant="secondary">
              {getAgreementStatusLabel(latest.status)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "payment_status",
        header: "Status płatności",
        cell: ({ row }) => (
          <Badge
            className={getPaymentStatusBadgeClass(row.original.payment_status)}
          >
            {getPaymentStatusLabel(row.original.payment_status)}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/bookings/${row.original.id}`)}
            >
              Szczegóły
            </Button>
          </div>
        ),
      },
    ],
    [router]
  );


  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      <ReusableTable
        columns={columns}
        data={bookings}
        searchable={true}
        searchPlaceholder="Szukaj po numerze rezerwacji, emailu..."
        searchColumn="booking_ref"
        onAdd={() => router.push("/admin/bookings/new")}
        addButtonLabel="Dodaj rezerwację"
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak rezerwacji"
      />
    </div>
  );
}

