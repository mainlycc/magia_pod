"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ColumnDef } from "@tanstack/react-table";
import { ReusableTable } from "@/components/reusable-table";
import {
  getPaymentStatusBadgeClass,
  getPaymentStatusLabel,
  type PaymentStatusValue,
} from "../../trips/[id]/bookings/payment-status";
import { calculatePaymentBalance } from "@/lib/utils/payment-calculator";
import { toast } from "sonner";

type Booking = {
  id: string;
  booking_ref: string;
  contact_email: string;
  contact_phone: string | null;
  address: any;
  status: "pending" | "confirmed" | "cancelled";
  payment_status: PaymentStatusValue;
  source?: string | null;
  internal_notes: any[];
  created_at: string;
  trips: {
    id: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
    price_cents: number | null;
  } | null;
  participants: Array<{
    id: string;
    first_name: string;
    last_name: string;
    pesel: string;
    email: string | null;
    phone: string | null;
    document_type: string | null;
    document_number: string | null;
  }>;
  agreements: Array<{
    id: string;
    status: "generated" | "sent" | "signed";
    pdf_url: string | null;
    sent_at: string | null;
    signed_at: string | null;
  }>;
  payment_history: Array<{
    id: string;
    amount_cents: number;
    payment_date: string;
    payment_method: string | null;
    notes: string | null;
  }>;
};

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [internalNotes, setInternalNotes] = useState("");

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) {
        throw new Error("Nie udało się wczytać rezerwacji");
      }
      const data = await res.json();
      setBooking(data);
      setInternalNotes(
        Array.isArray(data.internal_notes)
          ? data.internal_notes.map((n: any) => n.text || "").join("\n")
          : ""
      );
    } catch (err) {
      toast.error("Nie udało się wczytać rezerwacji");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      const notesArray = internalNotes
        .split("\n")
        .filter((n) => n.trim())
        .map((text) => ({ text: text.trim(), date: new Date().toISOString() }));

      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internal_notes: notesArray }),
      });

      if (res.ok) {
        toast.success("Notatki zapisane");
        await loadBooking();
      } else {
        throw new Error("Nie udało się zapisać notatek");
      }
    } catch (err) {
      toast.error("Błąd podczas zapisywania notatek");
    }
  };

  const handleGenerateAgreement = async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/agreement`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Umowa wygenerowana");
        await loadBooking();
      } else {
        throw new Error("Nie udało się wygenerować umowy");
      }
    } catch (err) {
      toast.error("Błąd podczas generowania umowy");
    }
  };

  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>;
  }

  if (!booking) {
    return <div className="space-y-4">Rezerwacja nie znaleziona</div>;
  }

  const paymentSummary = booking.trips
    ? calculatePaymentBalance(
        booking.trips.price_cents || 0,
        booking.payment_history || []
      )
    : null;

  // Typy pomocnicze dla tabel
  type Participant = Booking["participants"][number];
  type Payment = Booking["payment_history"][number];

  const participantColumns = useMemo<ColumnDef<Participant>[]>(
    () => [
      {
        id: "name",
        header: "Imię i nazwisko",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.first_name} {row.original.last_name}
          </span>
        ),
      },
      {
        accessorKey: "pesel",
        header: "PESEL",
      },
      {
        accessorKey: "email",
        header: "E-mail",
        cell: ({ row }) => row.original.email || "-",
      },
      {
        accessorKey: "phone",
        header: "Telefon",
        cell: ({ row }) => row.original.phone || "-",
      },
      {
        id: "document",
        header: "Dokument",
        cell: ({ row }) =>
          row.original.document_type && row.original.document_number
            ? `${row.original.document_type}: ${row.original.document_number}`
            : "-",
      },
    ],
    []
  );

  const paymentColumns = useMemo<ColumnDef<Payment>[]>(
    () => [
      {
        accessorKey: "payment_date",
        header: "Data",
        cell: ({ row }) =>
          new Date(row.original.payment_date).toLocaleDateString("pl-PL"),
      },
      {
        accessorKey: "amount_cents",
        header: "Kwota",
        cell: ({ row }) => (
          <span className="font-medium">
            {(row.original.amount_cents / 100).toFixed(2)} PLN
          </span>
        ),
      },
      {
        accessorKey: "payment_method",
        header: "Metoda",
        cell: ({ row }) => row.original.payment_method || "-",
      },
      {
        accessorKey: "notes",
        header: "Notatki",
        cell: ({ row }) => row.original.notes || "-",
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Rezerwacja: {booking.booking_ref}
          </h1>
          <p className="text-sm text-muted-foreground">
            Utworzona: {new Date(booking.created_at).toLocaleDateString("pl-PL")}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Wstecz
        </Button>
      </div>

      {/* Dane Klienta */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Dane Klienta</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">Email</Label>
            <div>{booking.contact_email}</div>
          </div>
          <div>
            <Label className="text-muted-foreground">Telefon</Label>
            <div>{booking.contact_phone || "-"}</div>
          </div>
          <div>
            <Label className="text-muted-foreground">Źródło rezerwacji</Label>
            <div className="text-sm text-muted-foreground">
              {booking.source === "public_page"
                ? "Publiczna strona wycieczki"
                : booking.source === "admin_panel"
                ? "Panel administratora"
                : booking.source || "-"}
            </div>
          </div>
          {booking.address && (
            <div className="col-span-2">
              <Label className="text-muted-foreground">Adres</Label>
              <div>
                {booking.address.street}, {booking.address.city} {booking.address.zip}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Lista uczestników */}
      <Card className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">Uczestnicy</h2>
        <ReusableTable
          columns={participantColumns}
          data={booking.participants}
          searchable={false}
          enablePagination={false}
          emptyMessage="Brak uczestników"
        />
      </Card>

      {/* Dane wycieczki */}
      {booking.trips && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Dane wycieczki</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Nazwa</Label>
              <div>{booking.trips.title}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Termin</Label>
              <div>
                {booking.trips.start_date
                  ? new Date(booking.trips.start_date).toLocaleDateString("pl-PL")
                  : "-"}{" "}
                {booking.trips.end_date &&
                  `— ${new Date(booking.trips.end_date).toLocaleDateString("pl-PL")}`}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Cena</Label>
              <div>
                {booking.trips.price_cents
                  ? `${(booking.trips.price_cents / 100).toFixed(2)} PLN`
                  : "-"}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Status rezerwacji</Label>
              <div>
                <Badge variant="outline">
                  {booking.status === "pending"
                    ? "Wstępna"
                    : booking.status === "confirmed"
                    ? "Potwierdzona"
                    : "Anulowana"}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Płatności */}
      <Card className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">Płatności</h2>
        {paymentSummary && (
          <div className="mb-4 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground">Do zapłaty</Label>
                <div className="text-lg font-semibold">
                  {(paymentSummary.totalDue / 100).toFixed(2)} PLN
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Zapłacono</Label>
                <div className="text-lg font-semibold">
                  {(paymentSummary.totalPaid / 100).toFixed(2)} PLN
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Saldo</Label>
                <div
                  className={`text-lg font-semibold ${
                    paymentSummary.balance < 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {(Math.abs(paymentSummary.balance) / 100).toFixed(2)} PLN
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div>
                  <Badge
                    className={getPaymentStatusBadgeClass(booking.payment_status)}
                  >
                    {getPaymentStatusLabel(booking.payment_status)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}
        <ReusableTable
          columns={paymentColumns}
          data={booking.payment_history || []}
          searchable={false}
          enablePagination={false}
          emptyMessage="Brak płatności"
        />
      </Card>

      {/* Umowy */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Umowy / Dokumenty</h2>
        <div className="flex gap-2 mb-4">
          <Button onClick={handleGenerateAgreement}>Wygeneruj umowę PDF</Button>
          {booking.agreements && booking.agreements.length > 0 && (
            <>
              {booking.agreements[0].pdf_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(booking.agreements[0].pdf_url!, "_blank")}
                >
                  Podejrzyj umowę
                </Button>
              )}
              <Button variant="outline">Wyślij umowę e-mailem ponownie</Button>
            </>
          )}
        </div>
        {booking.agreements && booking.agreements.length > 0 && (
          <div className="space-y-2">
            {booking.agreements.map((agreement) => (
              <div key={agreement.id} className="flex items-center gap-2">
                <Badge variant="secondary">
                  {agreement.status === "generated"
                    ? "Wygenerowana"
                    : agreement.status === "sent"
                    ? "Wysłana"
                    : "Podpisana"}
                </Badge>
                {agreement.sent_at && (
                  <span className="text-sm text-muted-foreground">
                    Wysłana: {new Date(agreement.sent_at).toLocaleDateString("pl-PL")}
                  </span>
                )}
                {agreement.signed_at && (
                  <span className="text-sm text-muted-foreground">
                    Podpisana: {new Date(agreement.signed_at).toLocaleDateString("pl-PL")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Notatki wewnętrzne */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Notatki wewnętrzne</h2>
        <div className="space-y-2">
          <Textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Dodaj notatki wewnętrzne (niewidoczne dla klienta)..."
            rows={6}
          />
          <Button onClick={handleSaveNotes}>Zapisz notatki</Button>
        </div>
      </Card>
    </div>
  );
}

