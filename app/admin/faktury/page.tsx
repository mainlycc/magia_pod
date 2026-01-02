"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { ReusableTable } from "@/components/reusable-table";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type InvoiceStatus = "wystawiona" | "wysłana" | "opłacona";

type InvoiceWithBooking = {
  id: string;
  invoice_number: string;
  amount_cents: number;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
  booking_id: string;
  saldeo_invoice_id: string | null;
  saldeo_error: string | null;
  bookings: {
    id: string;
    booking_ref: string;
    contact_email: string | null;
    trip_id: string;
    trips: {
      id: string;
      title: string;
      price_cents: number | null;
    } | null;
  } | null;
  participants_count?: number;
  searchable_text?: string; // Pole do wyszukiwania
};

type BookingOption = {
  id: string;
  booking_ref: string;
  contact_email: string | null;
  trip_title: string;
  price_cents: number | null;
  participants_count: number;
};

// Funkcje pomocnicze
const formatAmount = (cents: number): string => {
  const zl = Math.floor(cents / 100);
  const gr = cents % 100;
  return `${zl},${gr.toString().padStart(2, "0")} zł`;
};

const getInvoiceStatusLabel = (status: InvoiceStatus): string => {
  const labels: Record<InvoiceStatus, string> = {
    wystawiona: "Wystawiona",
    wysłana: "Wysłana",
    opłacona: "Opłacona",
  };
  return labels[status] || status;
};

const getInvoiceStatusBadgeVariant = (status: InvoiceStatus): "default" | "secondary" | "outline" => {
  const variants: Record<InvoiceStatus, "default" | "secondary" | "outline"> = {
    wystawiona: "outline",
    wysłana: "secondary",
    opłacona: "default",
  };
  return variants[status] || "outline";
};

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithBooking[]>([]);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Pobierz faktury z joinem do bookings i trips
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select(
          `
          id,
          invoice_number,
          amount_cents,
          status,
          created_at,
          updated_at,
          booking_id,
          bookings:bookings!inner(
            id,
            booking_ref,
            contact_email,
            trip_id,
            trips:trips!inner(
              id,
              title,
              price_cents
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (invoicesError) {
        throw invoicesError;
      }

      // Pobierz liczbę uczestników dla każdej faktury
      if (invoicesData) {
        const invoiceIds = invoicesData.map((inv) => inv.booking_id);
        const { data: participantsData } = await supabase
          .from("participants")
          .select("booking_id")
          .in("booking_id", invoiceIds);

        const participantsCountMap = new Map<string, number>();
        participantsData?.forEach((p) => {
          const count = participantsCountMap.get(p.booking_id) || 0;
          participantsCountMap.set(p.booking_id, count + 1);
        });

        const mapped = invoicesData.map((invoice: any) => {
          const booking = Array.isArray(invoice.bookings) && invoice.bookings.length > 0
            ? invoice.bookings[0]
            : null;
          return {
            ...invoice,
            bookings: booking,
            participants_count: participantsCountMap.get(invoice.booking_id) || 0,
            searchable_text: `${invoice.invoice_number} ${booking?.contact_email || ""} ${booking?.booking_ref || ""}`.toLowerCase(),
          };
        });

        setInvoices(mapped);
      }

      // Pobierz rezerwacje bez faktur dla formularza dodawania
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(
          `
          id,
          booking_ref,
          contact_email,
          trip_id,
          trips:trips!inner(
            id,
            title,
            price_cents
          )
        `
        )
        .order("created_at", { ascending: false });

      if (bookingsError) {
        throw bookingsError;
      }

      // Pobierz faktury, żeby wykluczyć rezerwacje które już mają faktury
      const { data: existingInvoices } = await supabase
        .from("invoices")
        .select("booking_id");

      const existingBookingIds = new Set(
        existingInvoices?.map((inv) => inv.booking_id) || []
      );

      // Pobierz liczbę uczestników dla rezerwacji
      if (bookingsData) {
        const bookingIds = bookingsData.map((b) => b.id);
        const { data: participantsData } = await supabase
          .from("participants")
          .select("booking_id")
          .in("booking_id", bookingIds);

        const participantsCountMap = new Map<string, number>();
        participantsData?.forEach((p) => {
          const count = participantsCountMap.get(p.booking_id) || 0;
          participantsCountMap.set(p.booking_id, count + 1);
        });

        const bookingsOptions = bookingsData
          .filter((booking: any) => !existingBookingIds.has(booking.id))
          .map((booking: any) => ({
            id: booking.id,
            booking_ref: booking.booking_ref,
            contact_email: booking.contact_email,
            trip_title: Array.isArray(booking.trips) && booking.trips.length > 0
              ? booking.trips[0].title
              : booking.trips?.title || "",
            price_cents: Array.isArray(booking.trips) && booking.trips.length > 0
              ? booking.trips[0].price_cents
              : booking.trips?.price_cents || null,
            participants_count: participantsCountMap.get(booking.id) || 0,
          }));

        setBookings(bookingsOptions);
      }
    } catch (err) {
      toast.error("Nie udało się wczytać faktur");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo<ColumnDef<InvoiceWithBooking>[]>(
    () => [
      {
        accessorKey: "invoice_number",
        header: "Nr faktury",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.invoice_number}</div>
        ),
        enableSorting: true,
      },
      {
        id: "client",
        header: "Klient",
        cell: ({ row }) => (
          <div className="font-medium">
            {row.original.bookings?.contact_email || "-"}
          </div>
        ),
        enableSorting: false,
      },
      {
        id: "booking",
        header: "Rezerwacja",
        cell: ({ row }) => (
          <div>{row.original.bookings?.booking_ref || "-"}</div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "amount_cents",
        header: "Kwota",
        cell: ({ row }) => (
          <div className="font-medium">
            {formatAmount(row.original.amount_cents)}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={getInvoiceStatusBadgeVariant(row.original.status)}>
            {getInvoiceStatusLabel(row.original.status)}
          </Badge>
        ),
        enableSorting: true,
      },
    ],
    []
  );

  const handleConfirmAdd = async (formData: Record<string, string>) => {
    if (!formData.booking_id) {
      toast.error("Wybierz rezerwację");
      return;
    }

    try {
      const supabase = createClient();
      const booking = bookings.find((b) => b.id === formData.booking_id);

      if (!booking) {
        toast.error("Nie znaleziono rezerwacji");
        return;
      }

      // Oblicz kwotę: price_cents * liczba uczestników
      const amountCents = (booking.price_cents || 0) * booking.participants_count;

      if (amountCents <= 0) {
        toast.error("Nie można utworzyć faktury - brak kwoty");
        return;
      }

      const { data, error } = await supabase
        .from("invoices")
        .insert({
          booking_id: formData.booking_id,
          amount_cents: amountCents,
          status: (formData.status as InvoiceStatus) || "wystawiona",
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast.success("Faktura została utworzona");
      await loadData();
    } catch (err) {
      toast.error("Nie udało się utworzyć faktury");
      console.error(err);
    }
  };

  const handleConfirmDelete = async (selectedRows: InvoiceWithBooking[]) => {
    try {
      const supabase = createClient();
      const ids = selectedRows.map((row) => row.id);

      const { error } = await supabase
        .from("invoices")
        .delete()
        .in("id", ids);

      if (error) {
        throw error;
      }

      toast.success(`Usunięto ${ids.length} faktur`);
      await loadData();
    } catch (err) {
      toast.error("Nie udało się usunąć faktur");
      console.error(err);
    }
  };

  const addFormFields = (
    formData: Record<string, string>,
    setFormData: (data: Record<string, string>) => void
  ) => {
    return (
      <>
        <div className="grid gap-2">
          <Label htmlFor="booking_id">Rezerwacja *</Label>
          <Select
            value={formData.booking_id || ""}
            onValueChange={(value) => setFormData({ ...formData, booking_id: value })}
          >
            <SelectTrigger id="booking_id" className="w-full">
              <SelectValue placeholder="Wybierz rezerwację" />
            </SelectTrigger>
            <SelectContent>
              {bookings.length === 0 ? (
                <SelectItem value="no-bookings" disabled>
                  Brak dostępnych rezerwacji
                </SelectItem>
              ) : (
                bookings.map((booking) => (
                  <SelectItem key={booking.id} value={booking.id}>
                    {booking.booking_ref} - {booking.trip_title} (
                    {booking.contact_email}) -{" "}
                    {formatAmount((booking.price_cents || 0) * booking.participants_count)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status || "wystawiona"}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wystawiona">Wystawiona</SelectItem>
              <SelectItem value="wysłana">Wysłana</SelectItem>
              <SelectItem value="opłacona">Opłacona</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  };

  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      <ReusableTable
        columns={columns}
        data={invoices}
        searchable={true}
        searchPlaceholder="Szukaj po numerze faktury, emailu klienta..."
        searchColumn="searchable_text"
        enableRowSelection={true}
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak faktur"
        enableAddDialog={true}
        enableDeleteDialog={true}
        onConfirmAdd={handleConfirmAdd}
        onConfirmDelete={handleConfirmDelete}
        addButtonLabel="Dodaj fakturę"
        deleteButtonLabel="Usuń"
        addDialogTitle="Dodaj nową fakturę"
        addDialogDescription="Wybierz rezerwację, dla której chcesz utworzyć fakturę. Kwota zostanie obliczona automatycznie."
        addFormFields={addFormFields}
      />
    </div>
  );
}

