"use client"

import React, { useEffect, useState, useMemo } from "react"
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
import { ChevronDown, Banknote, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import {
  getPaymentStatusBadgeClass,
} from "@/app/admin/trips/[id]/bookings/payment-status"
import type { PaymentStatusValue } from "@/app/admin/trips/[id]/bookings/payment-status"
import { cn } from "@/lib/utils"

type RequiredFields = {
  pesel?: boolean
  document?: boolean
  gender?: boolean
  phone?: boolean
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

// Funkcje pomocnicze
const formatCurrency = (cents: number | null | undefined): string => {
  if (cents === null || cents === undefined) return "0.00 zł"
  return `${(cents / 100).toFixed(2)} zł`
}

const formatDate = (date: string | null | undefined): string => {
  if (!date) return "-"
  return new Date(date).toLocaleDateString("pl-PL")
}

export default function UczestnicyPage() {
  const { selectedTrip, tripFullData } = useTrip()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [updatingPayment, setUpdatingPayment] = useState<string | null>(null)
  // Lokalne wartości inputów kwot wpłat (bookingId -> wartość w zł jako string)
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({})

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

      // Mapuj dane, aby bookings było pojedynczym obiektem zamiast tablicy
      const mappedParticipants = (data || []).map((participant: any) => ({
        ...participant,
        bookings: Array.isArray(participant.bookings)
          ? participant.bookings[0] || null
          : participant.bookings,
      }))

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

  // Zapisz wpłatę (kwota w groszach)
  const savePayment = async (bookingId: string, amountCents: number) => {
    setUpdatingPayment(bookingId)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid_amount_cents: amountCents }),
      })
      if (!res.ok) {
        throw new Error("Nie udało się zapisać wpłaty")
      }
      const result = await res.json()

      // Zaktualizuj lokalny stan uczestników
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.bookings?.id === bookingId) {
            return {
              ...p,
              bookings: {
                ...p.bookings!,
                paid_amount_cents: amountCents,
                payment_status: result.payment_status ?? p.bookings!.payment_status,
                first_payment_status: result.first_payment_status ?? p.bookings!.first_payment_status,
                second_payment_status: result.second_payment_status ?? p.bookings!.second_payment_status,
              },
            }
          }
          return p
        })
      )
      toast.success(`Zapisano wpłatę: ${(amountCents / 100).toFixed(2)} zł`)
    } catch (err) {
      console.error(err)
      toast.error("Nie udało się zapisać wpłaty")
    } finally {
      setUpdatingPayment(null)
    }
  }

  // Pomocnicza: pobierz wartość inputu lub aktualną kwotę z bookingu
  const getPaymentInputValue = (bookingId: string, currentPaidCents: number): string => {
    if (paymentInputs[bookingId] !== undefined) return paymentInputs[bookingId]
    return currentPaidCents > 0 ? (currentPaidCents / 100).toFixed(2) : ""
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

                    return (
                      <React.Fragment key={participant.id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => toggleRow(participant.id)}
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

                                      {/* Input kwoty wpłaty */}
                                      <div className="flex items-center gap-2 rounded-md border p-2 bg-background">
                                        <span className="text-sm font-medium whitespace-nowrap">Kwota wpłaty:</span>
                                        <div className="relative flex-1 max-w-[200px]">
                                          <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={getPaymentInputValue(booking.id, paidAmount)}
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
                                          disabled={updatingPayment === booking.id}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            const inputVal = paymentInputs[booking.id]
                                            const val = inputVal !== undefined
                                              ? inputVal
                                              : paidAmount > 0
                                                ? (paidAmount / 100).toFixed(2)
                                                : "0"
                                            const cents = Math.round(parseFloat(val || "0") * 100)
                                            if (isNaN(cents) || cents < 0) {
                                              toast.error("Podaj poprawną kwotę")
                                              return
                                            }
                                            savePayment(booking.id, cents)
                                          }}
                                        >
                                          {updatingPayment === booking.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Save className="mr-1 h-3 w-3" />
                                              Zapisz
                                            </>
                                          )}
                                        </Button>
                                        {/* Szybkie przyciski na podstawie harmonogramu — tyle ile rat */}
                                        {paymentSchedule.map((item, idx) => (
                                          <Button
                                            key={idx}
                                            size="sm"
                                            variant="outline"
                                            className="shrink-0 h-8 text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              // Suma rat od 1 do idx+1
                                              const sumCents = paymentSchedule
                                                .slice(0, idx + 1)
                                                .reduce((s, r) => s + r.amount, 0)
                                              setPaymentInputs((prev) => ({
                                                ...prev,
                                                [booking.id]: (sumCents / 100).toFixed(2),
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
                                          </Button>
                                        ))}
                                      </div>
                                    </div>
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
    </div>
  )
}
