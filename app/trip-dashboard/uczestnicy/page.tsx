"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTrip } from "@/contexts/trip-context"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronDown, Banknote, Loader2, Save, Trash2, FileText } from "lucide-react"
import { toast } from "sonner"
import {
  getPaymentStatusBadgeClass,
} from "@/app/admin/trips/[id]/bookings/payment-status"
import type { PaymentStatusValue } from "@/app/admin/trips/[id]/bookings/payment-status"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ParticipantAdditionalServicesEditor } from "./participant-additional-services-editor"

type RequiredFields = {
  pesel?: boolean
  document?: boolean
  gender?: boolean
  phone?: boolean
}

type BookingAgreement = {
  id: string
  status: string
  pdf_url: string | null
  sent_at: string | null
  signed_at: string | null
}

type Participant = {
  id: string
  first_name: string
  last_name: string
  pesel: string | null
  email: string | null
  phone: string | null
  birth_date: string | null
  address: any
  document_type: string | null
  document_number: string | null
  document_issue_date: string | null
  document_expiry_date: string | null
  gender_code: string | null
  booking_id: string
  selected_services: unknown
  bookings: {
    id: string
    booking_ref: string
    trip_id: string
    company_name: string | null
    payment_status: PaymentStatusValue
    first_payment_status: string | null
    second_payment_status: string | null
    first_payment_amount_cents: number | null
    second_payment_amount_cents: number | null
    paid_amount_cents: number
    contact_email: string
    contact_phone: string | null
    agreements?: BookingAgreement[]
    trips: {
      id: string
      title: string
      price_cents: number | null
      payment_split_enabled: boolean | null
      payment_split_first_percent: number | null
      payment_split_second_percent: number | null
      start_date: string | null
    } | null
  } | null
}

type PaymentHistoryEntry = {
  id: string
  booking_id: string
  amount_cents: number
  payment_date: string
  payment_method: string | null
  notes: string | null
  created_at: string
  created_by: string | null
  invoice: {
    id: string
    invoice_number: string
    fakturownia_invoice_id: string | null
    invoice_provider_error: string | null
  } | null
}

// Funkcje pomocnicze
const formatCurrency = (cents: number | null | undefined): string => {
  if (cents === null || cents === undefined) return "0.00 zł"
  return `${(cents / 100).toFixed(2)} zł`
}

const formatDate = (date: string | null | undefined): string => {
  if (!date) return "-"
  return new Date(date).toLocaleDateString("pl-PL")
}

const getAgreementStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    generated: "Wygenerowana",
    sent: "Wysłana",
    signed: "Podpisana",
  }
  return labels[status] || status
}

function normalizeBookingAgreements(
  raw: BookingAgreement[] | BookingAgreement | null | undefined
): BookingAgreement[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

function getAgreementPresentation(agreements: BookingAgreement[]) {
  const generatedAgreement = agreements.find((a) => a.status !== "signed")
  const signedAgreement = agreements.find((a) => a.status === "signed")
  const previewAgreement = signedAgreement?.pdf_url
    ? signedAgreement
    : generatedAgreement?.pdf_url
      ? generatedAgreement
      : null
  const sentAt =
    generatedAgreement?.sent_at ??
    signedAgreement?.sent_at ??
    agreements.find((a) => a.sent_at)?.sent_at ??
    null
  const statusBadgeSource =
    agreements.length > 0 ? agreements[agreements.length - 1] : null
  return {
    previewAgreement,
    sentAt,
    statusBadgeSource,
  }
}

export default function UczestnicyPage() {
  const router = useRouter()
  const { selectedTrip, tripFullData, isLoadingTripData } = useTrip()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [updatingPayment, setUpdatingPayment] = useState<string | null>(null)
  // Lokalne wartości inputów kwot wpłat (bookingId -> wartość w zł jako string)
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({})
  // Historia wpłat (bookingId -> wpisy)
  const [paymentHistoryByBookingId, setPaymentHistoryByBookingId] = useState<
    Record<string, PaymentHistoryEntry[]>
  >({})
  const [paymentHistoryLoadingByBookingId, setPaymentHistoryLoadingByBookingId] = useState<
    Record<string, boolean>
  >({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{
    bookingId: string
    paymentId: string
  } | null>(null)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
  const [generatingInvoiceForPaymentId, setGeneratingInvoiceForPaymentId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedTrip) {
      setLoading(false)
      return
    }
    loadData()
  }, [selectedTrip])

  const loadData = async () => {
    if (!selectedTrip) return

    try {
      setLoading(true)
      const supabase = createClient()

      // Pobierz uczestników dla wybranej wycieczki z pełnymi danymi
      const { data, error } = await supabase
        .from("participants")
        .select(
          `
          *,
          bookings:bookings!inner(
            id,
            booking_ref,
            trip_id,
            company_name,
            payment_status,
            first_payment_status,
            second_payment_status,
            first_payment_amount_cents,
            second_payment_amount_cents,
            paid_amount_cents,
            contact_email,
            contact_phone,
            agreements:agreements(id, status, pdf_url, sent_at, signed_at),
            trips:trips(
              id,
              title,
              price_cents,
              payment_split_enabled,
              payment_split_first_percent,
              payment_split_second_percent,
              start_date
            )
          )
        `
        )
        .eq("bookings.trip_id", selectedTrip.id)

      if (error) {
        console.error("Supabase participants query error:", JSON.stringify(error, null, 2))
        throw error
      }

      console.log("Participants loaded:", data?.length, "records")

      // Mapuj dane: bookings jako pojedynczy obiekt; agreements zostaje tablicą
      const mappedParticipants = (data || []).map((participant: any) => {
        const rawBooking = participant.bookings
        const b = Array.isArray(rawBooking) ? rawBooking[0] || null : rawBooking
        const bookings = b
          ? {
              ...b,
              trips: Array.isArray(b.trips) ? b.trips[0] || null : b.trips,
              agreements: normalizeBookingAgreements(b.agreements),
            }
          : null
        return { ...participant, bookings }
      })

      setParticipants(mappedParticipants)
    } catch (err: any) {
      console.error("loadData error:", err?.message || err?.code || err)
      toast.error("Nie udało się wczytać uczestników")
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (participantId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(participantId)) {
        newSet.delete(participantId)
      } else {
        newSet.add(participantId)
      }
      return newSet
    })
  }

  const loadPaymentHistory = async (bookingId: string, options?: { force?: boolean }) => {
    const force = options?.force ?? false
    if (!force && paymentHistoryByBookingId[bookingId]) return
    if (paymentHistoryLoadingByBookingId[bookingId]) return

    setPaymentHistoryLoadingByBookingId((prev) => ({ ...prev, [bookingId]: true }))
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payments`)
      if (!res.ok) {
        throw new Error("Nie udało się pobrać historii wpłat")
      }
      const data = (await res.json()) as PaymentHistoryEntry[]
      setPaymentHistoryByBookingId((prev) => ({ ...prev, [bookingId]: Array.isArray(data) ? data : [] }))
    } catch (err) {
      console.error(err)
      toast.error("Nie udało się pobrać historii wpłat")
    } finally {
      setPaymentHistoryLoadingByBookingId((prev) => ({ ...prev, [bookingId]: false }))
    }
  }

  const formatPaymentSource = (paymentMethod: string | null | undefined): string => {
    const normalized = (paymentMethod ?? "").toLowerCase().trim()
    if (!normalized) return "-"
    if (normalized === "manual") return "Ręcznie"
    if (normalized === "paynow") return "Paynow"
    return paymentMethod ?? "-"
  }

  const requestDeletePayment = (bookingId: string, paymentId: string) => {
    setPendingDelete({ bookingId, paymentId })
    setDeleteDialogOpen(true)
  }

  const confirmDeletePayment = async () => {
    if (!pendingDelete) return
    const { bookingId, paymentId } = pendingDelete
    setDeletingPaymentId(paymentId)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: paymentId }),
      })
      if (!res.ok) {
        throw new Error("Nie udało się usunąć płatności")
      }
      toast.success("Usunięto płatność")
      await loadPaymentHistory(bookingId, { force: true })
      // Odśwież też podsumowanie wpłat/status (paid_amount_cents) w tabeli uczestników
      await loadData()
      setDeleteDialogOpen(false)
      setPendingDelete(null)
    } catch (err) {
      console.error(err)
      toast.error("Nie udało się usunąć płatności")
    } finally {
      setDeletingPaymentId(null)
    }
  }

  const generateInvoice = async (bookingId: string, paymentId: string) => {
    setGeneratingInvoiceForPaymentId(paymentId)
    try {
      const res = await fetch("/api/fakturownia/invoice/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, payment_id: paymentId }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.message || "Nie udało się wygenerować faktury")
        return
      }
      toast.success("Faktura została wygenerowana")
      await loadPaymentHistory(bookingId, { force: true })
    } catch (err) {
      console.error(err)
      toast.error("Nie udało się wygenerować faktury")
    } finally {
      setGeneratingInvoiceForPaymentId(null)
    }
  }

  // Zapisz wpłatę — addedCents to kwota DODAWANA do istniejącej sumy
  const savePayment = async (bookingId: string, addedCents: number, currentPaidCents: number) => {
    setUpdatingPayment(bookingId)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: addedCents,
          payment_method: "manual",
        }),
      })
      if (!res.ok) {
        throw new Error("Nie udało się zapisać wpłaty")
      }
      await res.json()

      // Zaktualizuj lokalny stan uczestników
      // Wyczyść input po zapisaniu
      setPaymentInputs((prev) => {
        const next = { ...prev }
        delete next[bookingId]
        return next
      })
      toast.success(`Dodano wpłatę: ${(addedCents / 100).toFixed(2)} zł`)
      await loadPaymentHistory(bookingId, { force: true })
      await loadData()
    } catch (err) {
      console.error(err)
      toast.error("Nie udało się zapisać wpłaty")
    } finally {
      setUpdatingPayment(null)
    }
  }

  // Pomocnicza: pobierz wartość inputu (domyślnie pusty — wpisujemy kwotę do DODANIA)
  const getPaymentInputValue = (bookingId: string): string => {
    return paymentInputs[bookingId] ?? ""
  }

  // Oblicz statystyki
  const stats = useMemo(() => {
    const totalParticipants = participants.length
    const totalSeats = tripFullData?.seats_total ?? 0

    // Zlicz na podstawie aktualnych wpłat (paid_amount_cents)
    const withAnyPayment = participants.filter(
      (p) => (p.bookings?.paid_amount_cents ?? 0) > 0
    ).length
    const fullyPaid = participants.filter((p) => {
      const paid = p.bookings?.paid_amount_cents ?? 0
      const total = p.bookings?.trips?.price_cents ?? 0
      return total > 0 && paid >= total
    }).length

    // Suma wpłat i suma do zapłaty
    const totalPaidCents = participants.reduce(
      (sum, p) => sum + (p.bookings?.paid_amount_cents ?? 0),
      0
    )
    const totalDueCents = participants.reduce(
      (sum, p) => sum + (p.bookings?.trips?.price_cents ?? 0),
      0
    )

    return {
      totalParticipants,
      totalSeats,
      withAnyPayment,
      fullyPaid,
      totalPaidCents,
      totalDueCents,
    }
  }, [participants, tripFullData, selectedTrip])

  // Konfiguracja wymaganych pól z formularza
  const requiredFields = useMemo<RequiredFields>(() => {
    const fields = tripFullData?.form_required_participant_fields
    if (fields && typeof fields === "object" && !Array.isArray(fields)) {
      const f = fields as RequiredFields
      return {
        pesel: Boolean(f.pesel),
        document: Boolean(f.document),
        gender: Boolean(f.gender),
        phone: Boolean(f.phone),
      }
    }
    return { pesel: false, document: false, gender: false, phone: false }
  }, [tripFullData])

  // Oblicz harmonogram płatności na podstawie danych wycieczki
  const paymentSchedule = useMemo(() => {
    if (!tripFullData || !tripFullData.price_cents || !selectedTrip) return []
    
    const schedule: Array<{ date: string; amount: number; label: string }> = []
    
    // Użyj harmonogramu płatności jeśli dostępny
    if (tripFullData.payment_schedule && Array.isArray(tripFullData.payment_schedule) && tripFullData.payment_schedule.length > 0) {
      tripFullData.payment_schedule.forEach((installment) => {
        const amount = Math.round(((tripFullData.price_cents ?? 0) * installment.percent) / 100)
        schedule.push({
          date: installment.due_date,
          amount: amount,
          label: `Rata ${installment.installment_number} (${installment.percent}%)`,
        })
      })
    } else if (tripFullData.payment_split_enabled) {
      // Fallback: użyj starego systemu
      const firstPercent = tripFullData.payment_split_first_percent ?? 30
      const secondPercent = tripFullData.payment_split_second_percent ?? 70
      const firstAmount = Math.round((tripFullData.price_cents * firstPercent) / 100)
      const secondAmount = tripFullData.price_cents - firstAmount

      // Zaliczka
      const depositDate = new Date()
      depositDate.setDate(depositDate.getDate() + 7)
      schedule.push({
        date: depositDate.toISOString().split("T")[0],
        amount: firstAmount,
        label: `Zaliczka (${firstPercent}%)`,
      })

      // Reszta
      if (selectedTrip.start_date) {
        const finalDate = new Date(selectedTrip.start_date)
        finalDate.setDate(finalDate.getDate() - 14)
        schedule.push({
          date: finalDate.toISOString().split("T")[0],
          amount: secondAmount,
          label: `Reszta (${secondPercent}%)`,
        })
      } else {
        schedule.push({
          date: depositDate.toISOString().split("T")[0],
          amount: secondAmount,
          label: `Reszta (${secondPercent}%)`,
        })
      }
    } else {
      // Jedna płatność
      const finalDate = selectedTrip.start_date
        ? (() => {
            const date = new Date(selectedTrip.start_date)
            date.setDate(date.getDate() - 14)
            return date.toISOString().split("T")[0]
          })()
        : new Date().toISOString().split("T")[0]
      
      schedule.push({
        date: finalDate,
        amount: tripFullData.price_cents,
        label: "Pełna kwota",
      })
    }

    return schedule
  }, [tripFullData, selectedTrip])

  const totalCostPerPerson = useMemo(() => {
    return tripFullData?.price_cents
      ? formatCurrency(tripFullData.price_cents)
      : "0.00 zł"
  }, [tripFullData])

  if (!selectedTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Wybierz wycieczkę</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>
  }

  return (
    <div className="space-y-6">
      {/* Górna sekcja - Uczestnicy i Harmonogram płatności */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Karta: Uczestnicy (statystyki) */}
        <Card>
          <CardHeader>
            <CardTitle>Uczestnicy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Zapisanych:</span>
              <span className="text-sm font-semibold">{stats.totalParticipants} / {stats.totalSeats} miejsc</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Wpłacono (częściowo lub całość):</span>
              <span className="text-sm font-semibold">{stats.withAnyPayment}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Opłaconych w 100%:</span>
              <span className="text-sm font-semibold">{stats.fullyPaid}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Suma wpłat:</span>
              <span className="text-sm font-semibold text-emerald-600">{formatCurrency(stats.totalPaidCents)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Łącznie do zapłaty:</span>
              <span className="text-sm font-semibold">{formatCurrency(stats.totalDueCents)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Karta: Harmonogram płatności */}
        <Card>
          <CardHeader>
            <CardTitle>Harmonogram płatności</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentSchedule.length > 0 ? (
              <>
                {paymentSchedule.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{formatDate(item.date)}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                    <p className="text-sm font-medium">{formatCurrency(item.amount)}</p>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Łączny koszt za osobę:</span>
                  <span className="text-sm font-semibold text-blue-600">
                    {totalCostPerPerson}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Brak harmonogramu płatności</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dolna sekcja - Lista uczestników */}
      <Card>
        <CardHeader>
          <CardTitle>Lista uczestników ({participants.length} os.)</CardTitle>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Brak uczestników dla tej wycieczki
            </p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[48px]"></TableHead>
                    <TableHead>Uczestnik</TableHead>
                    <TableHead>ID zamówienia</TableHead>
                    <TableHead>Zamawiający</TableHead>
                    <TableHead>Stan wpłaty</TableHead>
                    <TableHead>Nazwa usługi</TableHead>
                    <TableHead className="w-[120px]">Cena usługi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => {
                    const booking = participant.bookings
                    const isExpanded = expandedRows.has(participant.id)
                    const paymentStatus = booking?.payment_status || "unpaid"
                    const paidAmount = booking?.paid_amount_cents ?? 0
                    const totalAmount = booking?.trips?.price_cents || 0
                    const paidPercent = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0
                    const agreementList = booking?.agreements ?? []
                    const { previewAgreement, sentAt, statusBadgeSource } =
                      getAgreementPresentation(agreementList)

                    return (
                      <React.Fragment key={participant.id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => {
                            if (booking?.id && !isExpanded) {
                              loadPaymentHistory(booking.id)
                            }
                            toggleRow(participant.id)
                          }}
                        >
                          <TableCell className="w-[48px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  isExpanded && "rotate-180"
                                )}
                              />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium truncate block">
                              {participant.first_name} {participant.last_name}
                            </span>
                          </TableCell>
                          <TableCell className="truncate">
                            {booking?.booking_ref || "-"}
                          </TableCell>
                          <TableCell className="truncate">
                            {booking?.company_name ||
                              `${participant.first_name} ${participant.last_name}`}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs whitespace-nowrap",
                                getPaymentStatusBadgeClass(paymentStatus)
                              )}
                            >
                              {formatCurrency(paidAmount)} / {formatCurrency(totalAmount)} ({paidPercent}%)
                            </Badge>
                          </TableCell>
                          <TableCell className="truncate">
                            {booking?.trips?.title || "Główna usługa"}
                          </TableCell>
                          <TableCell className="w-[120px]">
                            {formatCurrency(booking?.trips?.price_cents)}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/30 p-0">
                              <div className="p-4 space-y-4">
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">
                                    Dane osobowe
                                  </h4>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    {/* Zawsze widoczne */}
                                    <div>
                                      <span className="text-muted-foreground">Imię i nazwisko:</span>{" "}
                                      {participant.first_name} {participant.last_name}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Data urodzenia:</span>{" "}
                                      {formatDate(participant.birth_date)}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Email:</span>{" "}
                                      {participant.email || "-"}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Adres:</span>{" "}
                                      {participant.address
                                        ? (() => {
                                            const a = participant.address as any
                                            return [a.street, a.zip, a.city]
                                              .filter(Boolean)
                                              .join(", ") || "-"
                                          })()
                                        : "-"}
                                    </div>

                                    {/* Warunkowo na podstawie konfiguracji formularza */}
                                    {requiredFields.pesel && (
                                      <div>
                                        <span className="text-muted-foreground">PESEL:</span>{" "}
                                        {participant.pesel || "-"}
                                      </div>
                                    )}
                                    {requiredFields.phone && (
                                      <div>
                                        <span className="text-muted-foreground">Telefon:</span>{" "}
                                        {participant.phone || "-"}
                                      </div>
                                    )}
                                    {requiredFields.gender && (
                                      <div>
                                        <span className="text-muted-foreground">Płeć:</span>{" "}
                                        {participant.gender_code === "F"
                                          ? "Kobieta"
                                          : participant.gender_code === "M"
                                            ? "Mężczyzna"
                                            : "-"}
                                      </div>
                                    )}
                                    {requiredFields.document && (
                                      <>
                                        <div>
                                          <span className="text-muted-foreground">Dokument:</span>{" "}
                                          {participant.document_type === "ID"
                                            ? "Dowód osobisty"
                                            : participant.document_type === "PASSPORT"
                                              ? "Paszport"
                                              : "-"}
                                          {participant.document_number && ` ${participant.document_number}`}
                                        </div>
                                        {(participant.document_issue_date || participant.document_expiry_date) && (
                                          <div>
                                            <span className="text-muted-foreground">Ważność:</span>{" "}
                                            {participant.document_issue_date
                                              ? formatDate(participant.document_issue_date)
                                              : "-"}{" "}
                                            –{" "}
                                            {participant.document_expiry_date
                                              ? formatDate(participant.document_expiry_date)
                                              : "-"}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                                {booking && (
                                  <div>
                                    <h4 className="font-semibold text-sm mb-2">Umowa</h4>
                                    {agreementList.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">
                                        Brak wygenerowanej umowy dla tej rezerwacji.
                                      </p>
                                    ) : (
                                      <div className="space-y-3 text-sm">
                                        <div className="flex flex-wrap items-center gap-2">
                                          {statusBadgeSource && (
                                            <Badge variant="secondary">
                                              {getAgreementStatusLabel(statusBadgeSource.status)}
                                            </Badge>
                                          )}
                                          {sentAt ? (
                                            <span className="text-muted-foreground">
                                              Wysłano e-mailem: {formatDate(sentAt)}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground">
                                              Nie wysłano e-mailem
                                            </span>
                                          )}
                                        </div>
                                        {previewAgreement?.pdf_url ? (
                                          <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="text-xs font-medium uppercase text-muted-foreground">
                                                Podgląd umowy
                                              </span>
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  window.open(
                                                    `/api/agreements/${previewAgreement.pdf_url}`,
                                                    "_blank"
                                                  )
                                                }}
                                              >
                                                Otwórz w nowym oknie
                                              </Button>
                                            </div>
                                            <div className="w-full overflow-hidden rounded-lg border bg-background">
                                              <iframe
                                                src={`/api/agreements/${previewAgreement.pdf_url}`}
                                                className="h-[400px] w-full border-0"
                                                title="Podgląd umowy"
                                              />
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">
                                            Brak pliku PDF umowy do podglądu.
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <Separator />
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">
                                    Płatności
                                  </h4>
                                  {booking && (
                                    <div className="text-sm space-y-3">
                                      {/* Podsumowanie: wpłacono / do zapłaty */}
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Banknote className="h-4 w-4 text-muted-foreground" />
                                        <span>Wpłacono:</span>
                                        <span className="font-semibold">
                                          {formatCurrency(paidAmount)}
                                        </span>
                                        <span className="text-muted-foreground">/</span>
                                        <span>{formatCurrency(totalAmount)}</span>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-xs",
                                            getPaymentStatusBadgeClass(paymentStatus)
                                          )}
                                        >
                                          {paidPercent}%
                                        </Badge>
                                      </div>

                                      {/* Raty - informacje */}
                                      {(booking.first_payment_amount_cents ?? 0) > 0 && (
                                        <div className="text-xs text-muted-foreground space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span>Rata 1 (zaliczka): {formatCurrency(booking.first_payment_amount_cents)}</span>
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                "text-[10px] px-1.5 py-0",
                                                booking.first_payment_status === "paid"
                                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                                                  : "border-destructive/40 bg-destructive/10 text-destructive"
                                              )}
                                            >
                                              {booking.first_payment_status === "paid" ? "✓" : "✗"}
                                            </Badge>
                                          </div>
                                          {(booking.second_payment_amount_cents ?? 0) > 0 && (
                                            <div className="flex items-center gap-2">
                                              <span>Rata 2 (reszta): {formatCurrency(booking.second_payment_amount_cents)}</span>
                                              <Badge
                                                variant="outline"
                                                className={cn(
                                                  "text-[10px] px-1.5 py-0",
                                                  booking.second_payment_status === "paid"
                                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                                                    : "border-destructive/40 bg-destructive/10 text-destructive"
                                                )}
                                              >
                                                {booking.second_payment_status === "paid" ? "✓" : "✗"}
                                              </Badge>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Input kwoty wpłaty — dodaje do istniejącej sumy */}
                                      <div className="flex items-center gap-2 rounded-md border p-2 bg-background flex-wrap">
                                        <span className="text-sm font-medium whitespace-nowrap">Dodaj wpłatę:</span>
                                        <div className="relative flex-1 max-w-[200px]">
                                          <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={getPaymentInputValue(booking.id)}
                                            onChange={(e) => {
                                              setPaymentInputs((prev) => ({
                                                ...prev,
                                                [booking.id]: e.target.value,
                                              }))
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-8 text-sm pr-8"
                                          />
                                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            zł
                                          </span>
                                        </div>
                                        <Button
                                          size="sm"
                                          className="shrink-0 h-8 text-xs"
                                          disabled={updatingPayment === booking.id || !paymentInputs[booking.id]}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            const inputVal = paymentInputs[booking.id] ?? "0"
                                            const addedCents = Math.round(parseFloat(inputVal || "0") * 100)
                                            if (isNaN(addedCents) || addedCents <= 0) {
                                              toast.error("Podaj poprawną kwotę do dodania")
                                              return
                                            }
                                            savePayment(booking.id, addedCents, paidAmount)
                                          }}
                                        >
                                          {updatingPayment === booking.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Save className="mr-1 h-3 w-3" />
                                              Dodaj
                                            </>
                                          )}
                                        </Button>
                                        {/* Szybkie przyciski — wstawiają brakującą kwotę do osiągnięcia danej raty */}
                                        {paymentSchedule.map((item, idx) => {
                                          // Suma rat od 1 do idx+1 (cel do osiągnięcia)
                                          const targetCents = paymentSchedule
                                            .slice(0, idx + 1)
                                            .reduce((s, r) => s + r.amount, 0)
                                          // Ile brakuje do tego celu
                                          const remainingCents = Math.max(0, targetCents - paidAmount)
                                          return (
                                            <Button
                                              key={idx}
                                              size="sm"
                                              variant="outline"
                                              className="shrink-0 h-8 text-xs"
                                              disabled={remainingCents <= 0}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setPaymentInputs((prev) => ({
                                                  ...prev,
                                                  [booking.id]: (remainingCents / 100).toFixed(2),
                                                }))
                                              }}
                                            >
                                              {paymentSchedule.length === 1
                                                ? "Całość"
                                                : idx === 0
                                                  ? "I rata"
                                                  : idx === 1
                                                    ? "II rata"
                                                    : `${idx + 1} rata`}
                                              {remainingCents > 0 && (
                                                <span className="ml-1 text-muted-foreground">
                                                  ({(remainingCents / 100).toFixed(2)})
                                                </span>
                                              )}
                                            </Button>
                                          )
                                        })}
                                      </div>

                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium">Historia wpłat</span>
                                          {paymentHistoryLoadingByBookingId[booking.id] && (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                              Wczytywanie…
                                            </span>
                                          )}
                                        </div>

                                        <div className="rounded-md border bg-background overflow-hidden">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Termin</TableHead>
                                                <TableHead>Źródło</TableHead>
                                                <TableHead className="text-right">Kwota</TableHead>
                                                <TableHead>Faktura</TableHead>
                                                <TableHead className="w-[44px]"></TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {(paymentHistoryByBookingId[booking.id] ?? []).length === 0 &&
                                              !paymentHistoryLoadingByBookingId[booking.id] ? (
                                                <TableRow>
                                                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                                                    Brak wpłat w historii.
                                                  </TableCell>
                                                </TableRow>
                                              ) : (
                                                (paymentHistoryByBookingId[booking.id] ?? []).map((p) => (
                                                  <TableRow key={p.id}>
                                                    <TableCell className="whitespace-nowrap">
                                                      {formatDate(p.payment_date)}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap">
                                                      {formatPaymentSource(p.payment_method)}
                                                    </TableCell>
                                                    <TableCell className="text-right whitespace-nowrap">
                                                      {formatCurrency(p.amount_cents)}
                                                    </TableCell>
                                                    <TableCell>
                                                      {p.invoice ? (
                                                        <Button
                                                          variant="link"
                                                          size="sm"
                                                          className="h-auto p-0 text-xs font-medium gap-1"
                                                          onClick={(e) => {
                                                            e.stopPropagation()
                                                            router.push(`/trip-dashboard/faktury/${p.invoice!.id}`)
                                                          }}
                                                        >
                                                          <FileText className="h-3 w-3" />
                                                          {p.invoice.invoice_number || "—"}
                                                        </Button>
                                                      ) : (
                                                        <Button
                                                          variant="outline"
                                                          size="sm"
                                                          className="h-7 text-xs"
                                                          disabled={generatingInvoiceForPaymentId === p.id}
                                                          onClick={(e) => {
                                                            e.stopPropagation()
                                                            generateInvoice(booking.id, p.id)
                                                          }}
                                                        >
                                                          {generatingInvoiceForPaymentId === p.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                          ) : (
                                                            "Wygeneruj fakturę"
                                                          )}
                                                        </Button>
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        disabled={deletingPaymentId === p.id}
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          requestDeletePayment(booking.id, p.id)
                                                        }}
                                                        aria-label="Usuń płatność"
                                                      >
                                                        {deletingPaymentId === p.id ? (
                                                          <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                          <Trash2 className="h-4 w-4 text-destructive" />
                                                        )}
                                                      </Button>
                                                    </TableCell>
                                                  </TableRow>
                                                ))
                                              )}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <Separator />
                                <div onClick={(e) => e.stopPropagation()}>
                                  {isLoadingTripData && !tripFullData ? (
                                    <div className="text-sm text-muted-foreground py-2">
                                      Wczytywanie katalogu usług…
                                    </div>
                                  ) : (
                                    <ParticipantAdditionalServicesEditor
                                      participantId={participant.id}
                                      tripFullData={tripFullData}
                                      initialSelectedServices={participant.selected_services}
                                      onSaved={loadData}
                                    />
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setPendingDelete(null)
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Usunąć płatność?</DialogTitle>
            <DialogDescription>
              Tej operacji nie można cofnąć. Wpis z historii wpłat zostanie usunięty.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setPendingDelete(null)
              }}
              disabled={!!deletingPaymentId}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeletePayment}
              disabled={!pendingDelete || !!deletingPaymentId}
            >
              Usuń
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
