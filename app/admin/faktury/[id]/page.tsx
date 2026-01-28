"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, FileText, Download, Mail, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type InvoiceStatus = "wystawiona" | "wysłana" | "opłacona";

type Invoice = {
  id: string;
  invoice_number: string;
  amount_cents: number;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
  booking_id: string;
  saldeo_invoice_id: string | null;
  saldeo_error: string | null;
  pdf_url: string | null;
  bookings: {
    id: string;
    booking_ref: string;
    contact_email: string | null;
    contact_phone: string | null;
    address: any;
    trip_id: string;
    created_at: string;
    trips: {
      id: string;
      title: string;
      start_date: string | null;
      end_date: string | null;
      price_cents: number | null;
    } | null;
  } | null;
  participants?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  }>;
};

const formatAmount = (cents: number): string => {
  const zl = Math.floor(cents / 100);
  const gr = cents % 100;
  return `${zl},${gr.toString().padStart(2, "0")} zł`;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString("pl-PL", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getInvoiceStatusLabel = (status: InvoiceStatus): string => {
  const labels: Record<InvoiceStatus, string> = {
    wystawiona: "Wystawiona",
    wysłana: "Wysłana",
    opłacona: "Opłacona",
  };
  return labels[status] || status;
};

const getInvoiceStatusBadgeVariant = (
  status: InvoiceStatus
): "default" | "secondary" | "outline" => {
  const variants: Record<InvoiceStatus, "default" | "secondary" | "outline"> = {
    wystawiona: "outline",
    wysłana: "secondary",
    opłacona: "default",
  };
  return variants[status] || "outline";
};

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingStatus, setChangingStatus] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  useEffect(() => {
    if (invoice?.saldeo_invoice_id) {
      loadPdfUrl();
    }
  }, [invoice?.saldeo_invoice_id]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      const { data: invoiceData, error: invoiceError } = await supabase
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
          saldeo_invoice_id,
          saldeo_error,
          pdf_url,
          bookings:bookings!inner(
            id,
            booking_ref,
            contact_email,
            contact_phone,
            address,
            trip_id,
            created_at,
            trips:trips!inner(
              id,
              title,
              start_date,
              end_date,
              price_cents
            )
          )
        `
        )
        .eq("id", invoiceId)
        .single();

      if (invoiceError) {
        throw invoiceError;
      }

      // Pobierz uczestników rezerwacji
      const { data: participantsData } = await supabase
        .from("participants")
        .select("id, first_name, last_name, email")
        .eq("booking_id", invoiceData.booking_id);

      // Normalizuj dane bookings (i powiązane trips) do pojedynczych obiektów
      const rawBooking = Array.isArray(invoiceData.bookings)
        ? invoiceData.bookings[0]
        : invoiceData.bookings;

      const normalizedBooking =
        rawBooking && Array.isArray((rawBooking as any).trips)
          ? {
              ...rawBooking,
              trips: (rawBooking as any).trips[0] ?? null,
            }
          : rawBooking;

      const invoiceWithData: Invoice = {
        ...(invoiceData as any),
        bookings: normalizedBooking,
        participants: (participantsData || []) as Invoice["participants"],
      };

      setInvoice(invoiceWithData as any);

      // Jeśli mamy pdf_url w bazie, ustaw go
      if (invoiceData.pdf_url) {
        setPdfUrl(invoiceData.pdf_url);
      }
    } catch (err) {
      toast.error("Nie udało się wczytać faktury");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPdfUrl = async () => {
    if (!invoice) return;

    try {
      setLoadingPdf(true);
      const response = await fetch(`/api/saldeo/invoice/${invoice.id}/pdf`);
      const data = await response.json();

      if (data.success && data.pdfUrl) {
        setPdfUrl(data.pdfUrl);
      } else {
        console.error("Nie udało się pobrać URL do PDF:", data.error);
      }
    } catch (err) {
      console.error("Błąd podczas pobierania PDF:", err);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice) return;

    try {
      setChangingStatus(true);
      const supabase = createClient();

      const { error } = await supabase
        .from("invoices")
        .update({ status: newStatus })
        .eq("id", invoice.id);

      if (error) {
        throw error;
      }

      toast.success("Status faktury został zaktualizowany");
      await loadInvoice();
    } catch (err) {
      toast.error("Nie udało się zaktualizować statusu faktury");
      console.error(err);
    } finally {
      setChangingStatus(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!pdfUrl) {
      toast.error("Brak URL do PDF faktury");
      return;
    }

    // Otwórz PDF w nowej karcie (automatycznie pobierze lub wyświetli w zależności od przeglądarki)
    window.open(pdfUrl, "_blank");
  };

  const handleSendEmail = async () => {
    if (!invoice) return;

    toast.info("Wysyłanie faktury...");
    // TODO: Implementacja wysyłania faktury emailem
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Ładowanie...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Nie znaleziono faktury</div>
      </div>
    );
  }

  const booking = invoice.bookings;
  const trip = booking?.trips;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/admin/faktury")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Faktura {invoice.invoice_number}</h1>
            <p className="text-muted-foreground">
              Wystawiona {formatDateTime(invoice.created_at)}
            </p>
          </div>
        </div>
        <Badge variant={getInvoiceStatusBadgeVariant(invoice.status)}>
          {getInvoiceStatusLabel(invoice.status)}
        </Badge>
      </div>

      {/* Błąd Saldeo - jeśli wystąpił */}
      {invoice.saldeo_error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Błąd integracji z Saldeo</AlertTitle>
          <AlertDescription>{invoice.saldeo_error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lewa kolumna - Szczegóły faktury */}
        <div className="md:col-span-2 space-y-6">
          {/* Podstawowe informacje */}
          <Card>
            <CardHeader>
              <CardTitle>Szczegóły faktury</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Numer faktury</p>
                  <p className="font-medium">{invoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kwota</p>
                  <p className="font-medium text-2xl">
                    {formatAmount(invoice.amount_cents)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data wystawienia</p>
                  <p className="font-medium">{formatDate(invoice.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={getInvoiceStatusBadgeVariant(invoice.status)}>
                    {getInvoiceStatusLabel(invoice.status)}
                  </Badge>
                </div>
              </div>

              {invoice.saldeo_invoice_id && (
                <div>
                  <p className="text-sm text-muted-foreground">ID w systemie Saldeo</p>
                  <p className="font-medium font-mono text-sm">
                    {invoice.saldeo_invoice_id}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informacje o rezerwacji */}
          {booking && (
            <Card>
              <CardHeader>
                <CardTitle>Rezerwacja</CardTitle>
                <CardDescription>
                  Informacje o rezerwacji powiązanej z tą fakturą
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Numer rezerwacji</p>
                    <Button
                      variant="link"
                      className="p-0 h-auto font-medium"
                      onClick={() => router.push(`/admin/bookings/${booking.id}`)}
                    >
                      {booking.booking_ref}
                    </Button>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data rezerwacji</p>
                    <p className="font-medium">{formatDate(booking.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email kontaktowy</p>
                    <p className="font-medium">{booking.contact_email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefon</p>
                    <p className="font-medium">{booking.contact_phone || "-"}</p>
                  </div>
                </div>

                {booking.address && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Adres</p>
                    <div className="text-sm">
                      <p>{booking.address.street}</p>
                      <p>
                        {booking.address.postal_code} {booking.address.city}
                      </p>
                      {booking.address.country && <p>{booking.address.country}</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Informacje o wycieczce */}
          {trip && (
            <Card>
              <CardHeader>
                <CardTitle>Wycieczka</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nazwa wycieczki</p>
                  <p className="font-medium text-lg">{trip.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {trip.start_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Data rozpoczęcia</p>
                      <p className="font-medium">{formatDate(trip.start_date)}</p>
                    </div>
                  )}
                  {trip.end_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Data zakończenia</p>
                      <p className="font-medium">{formatDate(trip.end_date)}</p>
                    </div>
                  )}
                </div>
                {trip.price_cents !== null && (
                  <div>
                    <p className="text-sm text-muted-foreground">Cena za osobę</p>
                    <p className="font-medium">{formatAmount(trip.price_cents)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Uczestnicy */}
          {invoice.participants && invoice.participants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Uczestnicy</CardTitle>
                <CardDescription>
                  Lista uczestników ({invoice.participants.length})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {invoice.participants.map((participant, index) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {index + 1}. {participant.first_name} {participant.last_name}
                        </p>
                        {participant.email && (
                          <p className="text-sm text-muted-foreground">
                            {participant.email}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Prawa kolumna - Podgląd PDF i Akcje */}
        <div className="space-y-6">
          {/* Podgląd PDF */}
          {pdfUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Podgląd faktury</CardTitle>
                <CardDescription>PDF faktury z systemu Saldeo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[600px] border rounded-lg overflow-hidden">
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full"
                    title="Podgląd faktury PDF"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {loadingPdf && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Ładowanie PDF...</p>
              </CardContent>
            </Card>
          )}

          {!pdfUrl && !loadingPdf && invoice?.saldeo_invoice_id && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>PDF w trakcie generowania</AlertTitle>
              <AlertDescription>
                Po wystawieniu faktury w Saldeo, PDF jest generowany przez około 30
                sekund. Spróbuj odświeżyć stronę za chwilę.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Akcje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                variant="outline"
                onClick={handleDownloadPDF}
                disabled={!pdfUrl || loadingPdf}
              >
                <Download className="mr-2 h-4 w-4" />
                {loadingPdf ? "Ładowanie..." : "Pobierz PDF"}
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={handleSendEmail}
                disabled={!booking?.contact_email || !invoice.saldeo_invoice_id}
              >
                <Mail className="mr-2 h-4 w-4" />
                Wyślij emailem
              </Button>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Zmień status</p>
                <Button
                  className="w-full"
                  variant={invoice.status === "wystawiona" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusChange("wystawiona")}
                  disabled={changingStatus || invoice.status === "wystawiona"}
                >
                  Wystawiona
                </Button>
                <Button
                  className="w-full"
                  variant={invoice.status === "wysłana" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusChange("wysłana")}
                  disabled={changingStatus || invoice.status === "wysłana"}
                >
                  Wysłana
                </Button>
                <Button
                  className="w-full"
                  variant={invoice.status === "opłacona" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusChange("opłacona")}
                  disabled={changingStatus || invoice.status === "opłacona"}
                >
                  Opłacona
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Utworzono</p>
                <p className="text-sm">{formatDateTime(invoice.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ostatnia modyfikacja</p>
                <p className="text-sm">{formatDateTime(invoice.updated_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
