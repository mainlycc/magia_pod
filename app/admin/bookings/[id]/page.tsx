"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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

type Invoice = {
  id: string;
  invoice_number: string;
  amount_cents: number;
  status: "wystawiona" | "wysłana" | "opłacona";
  created_at: string;
  saldeo_invoice_id: string | null;
  saldeo_error: string | null;
};

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [agreementTab, setAgreementTab] = useState<"generated" | "signed">(
    "generated"
  );

  useEffect(() => {
    loadBooking();
    loadInvoice();
  }, [bookingId]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) {
        throw new Error("Nie udało się wczytać rezerwacji");
      }
      const data = await res.json();
      // Upewnij się, że payment_history jest tablicą
      if (data && !Array.isArray(data.payment_history)) {
        data.payment_history = [];
      }
      setBooking(data);
      const hasSigned = data?.agreements?.some(
        (agreement: any) => agreement.status === "signed"
      );
      setAgreementTab(hasSigned ? "signed" : "generated");
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

  const loadInvoice = async () => {
    try {
      // Pobierz fakturę dla tej rezerwacji
      const res = await fetch(`/api/admin/invoices`);
      if (res.ok) {
        const invoices: Invoice[] = await res.json();
        const bookingInvoice = invoices.find((inv: any) => inv.booking_id === bookingId);
        setInvoice(bookingInvoice || null);
      }
    } catch (err) {
      console.error("Błąd podczas ładowania faktury:", err);
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      setGeneratingInvoice(true);
      
      // Sprawdź czy istnieje płatność dla tej rezerwacji
      if (!booking?.payment_history || booking.payment_history.length === 0) {
        toast.error("Nie można wygenerować faktury - brak płatności");
        return;
      }

      const lastPayment = booking.payment_history[booking.payment_history.length - 1];
      
      const res = await fetch("/api/saldeo/invoice/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          payment_id: lastPayment.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success === false && data.error === "Invoice already exists for this booking") {
          toast.info("Faktura już istnieje dla tej rezerwacji");
        } else if (data.saldeo_success === false && data.saldeo_error) {
          // Faktura zapisana lokalnie, ale problem z Saldeo
          toast.warning(
            `Faktura zapisana lokalnie (${data.invoice_number}), ale wystąpił problem z Saldeo: ${data.saldeo_error}`,
            { duration: 6000 }
          );
        } else if (data.saldeo_success === true) {
          toast.success(`Faktura ${data.invoice_number} została wygenerowana i wysłana do Saldeo`);
        } else {
          toast.success(`Faktura ${data.invoice_number} została wygenerowana`);
        }
        await loadInvoice();
      } else {
        const errorData = await res.json().catch(() => ({ error: "Nieznany błąd" }));
        toast.error(`Błąd: ${errorData.error || errorData.details || "Nie udało się wygenerować faktury"}`);
      }
    } catch (err) {
      console.error("Error generating invoice:", err);
      toast.error(`Błąd podczas generowania faktury: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    } finally {
      setGeneratingInvoice(false);
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
        let errorData: any = null;
        let rawText = "";
        
        try {
          rawText = await res.text();
          console.log("Raw response text:", rawText ? rawText.substring(0, 500) : "(empty)");
          
          if (rawText && rawText.trim()) {
            try {
              errorData = JSON.parse(rawText);
              console.log("Parsed error data:", errorData);
            } catch (parseError) {
              console.error("JSON parse error:", parseError);
              // Jeśli nie jest JSON, użyj tekstu jako błędu
              errorData = { 
                error: "Nieprawidłowa odpowiedź z serwera", 
                details: rawText.substring(0, 200) 
              };
            }
          } else {
            console.warn("Empty response text");
            errorData = { 
              error: `HTTP ${res.status}: ${res.statusText || "Brak odpowiedzi"}`,
              details: "Serwer zwrócił pustą odpowiedź"
            };
          }
        } catch (textError) {
          console.error("Error reading response text:", textError);
          errorData = { 
            error: `HTTP ${res.status}: ${res.statusText || "Błąd odczytu odpowiedzi"}`,
            details: textError instanceof Error ? textError.message : String(textError)
          };
        }
        
        // Upewnij się, że errorData nie jest null ani pustym obiektem
        if (!errorData || (typeof errorData === 'object' && Object.keys(errorData).length === 0)) {
          errorData = { 
            error: `HTTP ${res.status}: Nie udało się wygenerować umowy`,
            details: "Nieznany błąd - brak szczegółów"
          };
        }
        
        const errorMessage = errorData.details || errorData.error || errorData.message || `HTTP ${res.status}: Nie udało się wygenerować umowy`;
        console.error("Error generating agreement:", { 
          status: res.status, 
          statusText: res.statusText, 
          errorData,
          rawText: rawText ? rawText.substring(0, 200) : "(empty)"
        });
        toast.error(`Błąd: ${errorMessage}`);
      }
    } catch (err) {
      console.error("Error generating agreement:", err);
      toast.error(`Błąd podczas generowania umowy: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    }
  };

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
        cell: ({ row }) => {
          const date = row.original.payment_date;
          if (!date) return "-";
          try {
            return new Date(date).toLocaleDateString("pl-PL");
          } catch {
            return date;
          }
        },
      },
      {
        accessorKey: "amount_cents",
        header: "Kwota",
        cell: ({ row }) => {
          const amount = row.original.amount_cents;
          if (typeof amount !== "number") return "-";
          return (
            <span className="font-medium">
              {(amount / 100).toFixed(2)} PLN
            </span>
          );
        },
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

  const generatedAgreement = booking.agreements?.find(
    (agreement) => agreement.status !== "signed"
  );
  const signedAgreement = booking.agreements?.find(
    (agreement) => agreement.status === "signed"
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
          data={Array.isArray(booking.payment_history) ? booking.payment_history : []}
          searchable={false}
          enablePagination={false}
          enableRowSelection={false}
          emptyMessage="Brak płatności"
        />
      </Card>

      {/* Faktura */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Faktura</h2>
        {invoice ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-muted-foreground">Numer faktury</Label>
                <div className="font-medium">{invoice.invoice_number}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Kwota</Label>
                <div className="font-medium">
                  {(invoice.amount_cents / 100).toFixed(2)} PLN
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div>
                  <Badge
                    variant={
                      invoice.status === "opłacona"
                        ? "default"
                        : invoice.status === "wysłana"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {invoice.status === "wystawiona"
                      ? "Wystawiona"
                      : invoice.status === "wysłana"
                      ? "Wysłana"
                      : "Opłacona"}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Data wystawienia</Label>
                <div>
                  {new Date(invoice.created_at).toLocaleDateString("pl-PL")}
                </div>
              </div>
              {invoice.saldeo_invoice_id && (
                <div className="col-span-2">
                  <Label className="text-muted-foreground">ID Saldeo</Label>
                  <div className="text-sm font-mono">{invoice.saldeo_invoice_id}</div>
                </div>
              )}
              {invoice.saldeo_error && (
                <div className="col-span-2">
                  <Label className="text-muted-foreground text-red-600">Błąd Saldeo</Label>
                  <div className="text-sm text-red-600">{invoice.saldeo_error}</div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.open(`https://saldeo.com`, "_blank")}
              >
                Zobacz w Saldeo
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Faktura nie została jeszcze wygenerowana.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateInvoice}
                disabled={
                  generatingInvoice ||
                  !booking?.payment_history ||
                  booking.payment_history.length === 0
                }
              >
                {generatingInvoice ? "Generowanie..." : "Wygeneruj fakturę"}
              </Button>
              {booking?.payment_history && booking.payment_history.length === 0 && (
                <p className="text-sm text-muted-foreground self-center">
                  Brak płatności - dodaj płatność, aby wygenerować fakturę
                </p>
              )}
            </div>
          </div>
        )}
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
                  onClick={() => window.open(`/api/agreements/${booking.agreements[0].pdf_url}`, "_blank")}
                >
                  Otwórz w nowym oknie
                </Button>
              )}
              <Button variant="outline">Wyślij umowę e-mailem ponownie</Button>
            </>
          )}
        </div>
        {booking.agreements && booking.agreements.length > 0 ? (
          <Tabs
            value={agreementTab}
            onValueChange={(value) =>
              setAgreementTab(value as "generated" | "signed")
            }
            className="space-y-4"
          >
            <TabsList>
              {generatedAgreement && <TabsTrigger value="generated">Wygenerowana</TabsTrigger>}
              {signedAgreement && <TabsTrigger value="signed">Podpisana</TabsTrigger>}
            </TabsList>

            {generatedAgreement && (
              <TabsContent value="generated" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {generatedAgreement.status === "generated"
                      ? "Wygenerowana"
                      : generatedAgreement.status === "sent"
                      ? "Wysłana"
                      : "Podpisana"}
                  </Badge>
                  {generatedAgreement.sent_at && (
                    <span className="text-sm text-muted-foreground">
                      Wysłana:{" "}
                      {new Date(generatedAgreement.sent_at).toLocaleDateString("pl-PL")}
                    </span>
                  )}
                  {generatedAgreement.signed_at && (
                    <span className="text-sm text-muted-foreground">
                      Podpisana:{" "}
                      {new Date(generatedAgreement.signed_at).toLocaleDateString("pl-PL")}
                    </span>
                  )}
                </div>
                {generatedAgreement.pdf_url ? (
                  <div className="mt-2">
                    <h3 className="font-medium text-sm uppercase text-muted-foreground mb-2">
                      Podgląd umowy
                    </h3>
                    <div className="w-full overflow-hidden rounded-lg border">
                      <iframe
                        src={`/api/agreements/${generatedAgreement.pdf_url}`}
                        className="h-[600px] w-full border-0"
                        title="Podgląd umowy wygenerowanej"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Brak pliku PDF dla wygenerowanej umowy.
                  </p>
                )}
              </TabsContent>
            )}

            {signedAgreement && (
              <TabsContent value="signed" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Podpisana</Badge>
                  {signedAgreement.signed_at && (
                    <span className="text-sm text-muted-foreground">
                      Podpisana:{" "}
                      {new Date(signedAgreement.signed_at).toLocaleDateString("pl-PL")}
                    </span>
                  )}
                </div>
                {signedAgreement.pdf_url ? (
                  <div className="mt-2">
                    <h3 className="font-medium text-sm uppercase text-muted-foreground mb-2">
                      Podgląd umowy podpisanej
                    </h3>
                    <div className="w-full overflow-hidden rounded-lg border">
                      <iframe
                        src={`/api/agreements/${signedAgreement.pdf_url}`}
                        className="h-[600px] w-full border-0"
                        title="Podgląd umowy podpisanej"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Brak pliku PDF dla podpisanej umowy.
                  </p>
                )}
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <p className="text-sm text-muted-foreground">
            Brak wygenerowanej umowy. Wygeneruj dokument, aby zobaczyć podgląd.
          </p>
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

