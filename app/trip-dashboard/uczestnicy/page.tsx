"use client"

import React, { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTrip } from "@/contexts/trip-context"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronDown, Banknote, Loader2, Mail, Save, Trash2, FileText, FileDown } from "lucide-react"
import { toast } from "sonner"
import {
  getPaymentStatusBadgeClass,
} from "@/lib/payment-status"
import type { PaymentStatusValue } from "@/lib/payment-status"
import { cn } from "@/lib/utils"
import { formatAgreementNumber } from "@/lib/agreements/format-agreement-number"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ParticipantAdditionalServicesEditor } from "./participant-additional-services-editor"

// Wartości muszą odpowiadać PARTICIPANT_REPORT_TYPES z lib/reports/participants-report.ts
// (nie importujemy stamtąd — moduł używa jsPDF/fs i jest przeznaczony na serwer).
const PARTICIPANT_REPORT_OPTIONS = [
  { value: "participants_list", label: "Lista uczestników" },
  { value: "diets", label: "Raport diet" },
  { value: "attractions", label: "Raport atrakcji" },
  { value: "documents", label: "Lista uczestników z dokumentami" },
  { value: "global", label: "Lista globalna (z danymi umowy)" },
] as const

type ParticipantReportTypeValue = (typeof PARTICIPANT_REPORT_OPTIONS)[number]["value"]

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
  agreement_seq: number | null
  updated_at?: string | null
  generated_at?: string | null
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
    created_at: string | null
    company_name: string | null
    contact_first_name: string | null
    contact_last_name: string | null
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
      reservation_number?: string | null
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

function getSelectedServicesTotalCents(selectedServices: unknown): number {
  if (!selectedServices || typeof selectedServices !== "object") return 0
  const o = selectedServices as Record<string, unknown>

  const sumPriceCents = (items: unknown[], opts?: { currencyKey?: string }): number =>
    items.reduce<number>((sum, item) => {
      if (!item || typeof item !== "object") return sum
      const i = item as Record<string, unknown>
      const price = i.price_cents
      if (typeof price !== "number" || !Number.isFinite(price)) return sum

      if (opts?.currencyKey) {
        const currency = i[opts.currencyKey]
        if (currency && typeof currency === "string" && currency.toUpperCase() !== "PLN") return sum
      }

      return sum + Math.round(price)
    }, 0)

  const diets = Array.isArray(o.diets) ? o.diets : []
  const insurances = Array.isArray(o.insurances) ? o.insurances : []
  const attractions = Array.isArray(o.attractions) ? o.attractions : []

  return (
    sumPriceCents(diets) +
    sumPriceCents(insurances) +
    sumPriceCents(attractions, { currencyKey: "currency" })
  )
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
  const arr = Array.isArray(raw) ? raw : [raw]
  // Supabase join nie gwarantuje kolejności; sortujemy malejąco po updated_at / generated_at
  return arr.sort((a, b) => {
    const aKey = a.updated_at ?? a.generated_at ?? a.sent_at ?? a.signed_at ?? null
    const bKey = b.updated_at ?? b.generated_at ?? b.sent_at ?? b.signed_at ?? null
    const aTs = aKey ? Date.parse(aKey) : 0
    const bTs = bKey ? Date.parse(bKey) : 0
    return bTs - aTs
  })
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
  const { selectedTrip, tripFullData, isLoadingTripData, role } = useTrip()
  // Koordynator: tabela tylko do odczytu — bez rozwijania szczegółów,
  // edycji, wpłat i raportów.
  const isCoordinator = role === "coordinator"
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [expandedAgreementPreviewByBookingId, setExpandedAgreementPreviewByBookingId] = useState<Set<string>>(
    new Set(),
  )
  const [updatingPayment, setUpdatingPayment] = useState<string | null>(null)
  const [generatingAgreementForBookingId, setGeneratingAgreementForBookingId] = useState<
    string | null
  >(null)
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
  const [generatingReportType, setGeneratingReportType] = useState<ParticipantReportTypeValue | null>(null)
  // Wiadomość grupowa do uczestników (tak samo jak u koordynatora)
  const [messageDialogOpen, setMessageDialogOpen] = useState(false)
  const [messageSubject, setMessageSubject] = useState("")
  const [messageBody, setMessageBody] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)

  const sendGroupMessage = async () => {
    if (!selectedTrip) return
    setSendingMessage(true)
    try {
      const res = await fetch(`/api/trips/${selectedTrip.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: messageSubject, body: messageBody }),
      })
      if (!res.ok) {
        toast.error("Nie udało się wysłać wiadomości")
        return
      }
      toast.success("Wiadomość została wysłana")
      setMessageDialogOpen(false)
      setMessageSubject("")
      setMessageBody("")
    } catch (e) {
      console.error(e)
      toast.error("Nie udało się wysłać wiadomości")
    } finally {
      setSendingMessage(false)
    }
  }

  const downloadParticipantsReport = async (reportType: ParticipantReportTypeValue) => {
    if (!selectedTrip) return
    setGeneratingReportType(reportType)
    try {
      const res = await fetch(`/api/trips/${selectedTrip.id}/reports/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        toast.error(
          typeof errJson?.error === "string" ? errJson.error : "Nie udało się wygenerować raportu",
        )
        return
      }

      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition")
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? `raport-${reportType}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Raport został pobrany")
    } catch (e) {
      console.error(e)
      toast.error("Błąd pobierania raportu")
    } finally {
      setGeneratingReportType(null)
    }
  }

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

      // Zsynchronizuj sumy wpłat z historią (Paynow itd. mogły dodać wpisy bez aktualizacji bookings)
      try {
        const syncRes = await fetch(`/api/trips/${selectedTrip.id}/reconcile-payments`, {
          method: "POST",
        })
        if (!syncRes.ok) {
          console.warn("reconcile-payments:", await syncRes.text())
        }
      } catch (e) {
        console.warn("reconcile-payments fetch failed:", e)
      }

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
            created_at,
            company_name,
            contact_first_name,
            contact_last_name,
            payment_status,
            first_payment_status,
            second_payment_status,
            first_payment_amount_cents,
            second_payment_amount_cents,
            paid_amount_cents,
            contact_email,
            contact_phone,
            agreements:agreements(id, status, pdf_url, sent_at, signed_at, agreement_seq, updated_at, generated_at),
            trips:trips(
              id,
              title,
              price_cents,
              payment_split_enabled,
              payment_split_first_percent,
              payment_split_second_percent,
              start_date,
              reservation_number
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

  const toggleAgreementPreview = (bookingId: string) => {
    setExpandedAgreementPreviewByBookingId((prev) => {
      const next = new Set(prev)
      if (next.has(bookingId)) next.delete(bookingId)
      else next.add(bookingId)
      return next
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

  const generateAgreement = async (bookingId: string) => {
    setGeneratingAgreementForBookingId(bookingId)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => null as any)

      if (!res.ok || !data?.success) {
        const msg =
          data?.error ||
          data?.message ||
          data?.details ||
          "Nie udało się wygenerować umowy"
        toast.error(msg)
        return
      }

      toast.success("Umowa została wygenerowana")
      await loadData()
    } catch (err) {
      console.error(err)
      toast.error("Nie udało się wygenerować umowy")
    } finally {
      setGeneratingAgreementForBookingId(null)
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

  // Ile osób jest podpiętych do danej rezerwacji (booking).
  // Wpłaty są zapisywane na poziomie booking, ale w tabeli uczestników
  // pokazujemy je "per osoba" (podział po równo).
  const participantCountByBookingId = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of participants) {
      // Kluczujemy po `bookings.id` jeśli jest, bo to jest faktyczny identyfikator rezerwacji
      // używany do historii płatności. Fallback do `participants.booking_id` na wypadek braków.
      const bookingId = p.bookings?.id ?? p.booking_id
      if (!bookingId) continue
      map.set(bookingId, (map.get(bookingId) ?? 0) + 1)
    }
    return map
  }, [participants])

  const getBookingParticipantCount = (p: Participant): number => {
    const bookingId = p.bookings?.id ?? p.booking_id
    if (!bookingId) return 1
    return participantCountByBookingId.get(bookingId) ?? 1
  }

  // "Pierwszy uczestnik" w danej umowie/rezerwacji (booking).
  // Tylko na nim można dodawać wpłaty ręcznie, ale kwota i tak jest wspólna dla booking,
  // więc reszta uczestników dostaje ją automatycznie (w UI dzielimy po równo).
  const primaryParticipantIdByBookingId = useMemo(() => {
    const map = new Map<string, string>()
    const groups = new Map<string, Participant[]>()

    for (const p of participants) {
      const bookingId = p.bookings?.id ?? p.booking_id
      if (!bookingId) continue
      const arr = groups.get(bookingId) ?? []
      arr.push(p)
      groups.set(bookingId, arr)
    }

    for (const [bookingId, group] of groups.entries()) {
      const sorted = [...group].sort((a: any, b: any) => {
        const at = a?.created_at ? new Date(a.created_at).getTime() : Number.POSITIVE_INFINITY
        const bt = b?.created_at ? new Date(b.created_at).getTime() : Number.POSITIVE_INFINITY
        if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt
        return String(a.id).localeCompare(String(b.id))
      })
      if (sorted[0]?.id) map.set(bookingId, sorted[0].id)
    }

    return map
  }, [participants])

  const canManuallyAddPaymentForParticipant = (p: Participant): boolean => {
    const bookingId = p.bookings?.id ?? p.booking_id
    if (!bookingId) return true
    const count = participantCountByBookingId.get(bookingId) ?? 1
    if (count <= 1) return true
    const primaryId = primaryParticipantIdByBookingId.get(bookingId)
    return !primaryId || primaryId === p.id
  }

  // Suma do zapłaty za całą umowę (booking) — suma ceny + usług dodatkowych wszystkich uczestników w booking.
  const totalDueCentsByBookingId = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of participants) {
      const bookingId = p.bookings?.id ?? p.booking_id
      if (!bookingId) continue
      const base = p.bookings?.trips?.price_cents ?? 0
      const extras = getSelectedServicesTotalCents(p.selected_services)
      map.set(bookingId, (map.get(bookingId) ?? 0) + base + extras)
    }
    return map
  }, [participants])

  // Posortowana lista: zachowujemy kolejność umów jak przyszła z backendu,
  // ale w obrębie każdej umowy pokazujemy "pierwszego uczestnika" zawsze wyżej.
  const sortedParticipants = useMemo(() => {
    const bookingOrderIndex = new Map<string, number>()
    let idx = 0
    for (const p of participants) {
      const bookingId = p.bookings?.id ?? p.booking_id
      if (!bookingId) continue
      if (!bookingOrderIndex.has(bookingId)) bookingOrderIndex.set(bookingId, idx++)
    }

    return [...participants].sort((a: any, b: any) => {
      const aBookingId = a?.bookings?.id ?? a?.booking_id ?? ""
      const bBookingId = b?.bookings?.id ?? b?.booking_id ?? ""

      const aOrder = bookingOrderIndex.get(aBookingId) ?? Number.POSITIVE_INFINITY
      const bOrder = bookingOrderIndex.get(bBookingId) ?? Number.POSITIVE_INFINITY
      if (aOrder !== bOrder) return aOrder - bOrder

      const aPrimaryId = primaryParticipantIdByBookingId.get(aBookingId)
      const bPrimaryId = primaryParticipantIdByBookingId.get(bBookingId)
      const aIsPrimary = Boolean(aPrimaryId && aPrimaryId === a.id)
      const bIsPrimary = Boolean(bPrimaryId && bPrimaryId === b.id)
      if (aIsPrimary !== bIsPrimary) return aIsPrimary ? -1 : 1

      const at = a?.created_at ? new Date(a.created_at).getTime() : Number.POSITIVE_INFINITY
      const bt = b?.created_at ? new Date(b.created_at).getTime() : Number.POSITIVE_INFINITY
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt

      return String(a.id).localeCompare(String(b.id))
    })
  }, [participants, primaryParticipantIdByBookingId])

  const getPaidPerParticipantCents = (p: Participant): number => {
    const paid = p.bookings?.paid_amount_cents ?? 0
    const count = getBookingParticipantCount(p)
    if (count <= 1) return paid
    return Math.round(paid / count)
  }

  // Oblicz statystyki
  const stats = useMemo(() => {
    const totalParticipants = participants.length
    const totalSeats = tripFullData?.seats_total ?? 0

    // Zlicz na podstawie aktualnych wpłat (paid_amount_cents)
    const withAnyPayment = participants.filter(
      (p) => getPaidPerParticipantCents(p) > 0
    ).length
    const fullyPaid = participants.filter((p) => {
      const paid = getPaidPerParticipantCents(p)
      const total = p.bookings?.trips?.price_cents ?? 0
      return total > 0 && paid >= total
    }).length

    // Suma wpłat i suma do zapłaty
    const totalPaidCents = participants.reduce(
      (sum, p) => sum + getPaidPerParticipantCents(p),
      0
    )
    const totalDueCents = participants.reduce(
      (sum, p) =>
        sum +
        (p.bookings?.trips?.price_cents ?? 0) +
        getSelectedServicesTotalCents(p.selected_services),
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
  }, [participants, tripFullData, selectedTrip, participantCountByBookingId])

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

  // Jak w formularzu rezerwacji: pokaż tylko pola faktycznie włączone w konfiguracji
  const showParticipantGender = Boolean(
    (tripFullData?.form_required_participant_fields as { gender?: boolean } | null)?.gender
  )

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

  const additionalServicesTotalAllParticipantsCents = useMemo(() => {
    return participants.reduce((sum, p) => sum + getSelectedServicesTotalCents(p.selected_services), 0)
  }, [participants])

  const averageAdditionalServicesPerPersonCents = useMemo(() => {
    if (participants.length <= 0) return 0
    return Math.round(additionalServicesTotalAllParticipantsCents / participants.length)
  }, [additionalServicesTotalAllParticipantsCents, participants.length])

  const totalCostPerPerson = useMemo(() => {
    const base = tripFullData?.price_cents ?? 0
    return base > 0 ? formatCurrency(base + averageAdditionalServicesPerPersonCents) : "0.00 zł"
  }, [tripFullData, averageAdditionalServicesPerPersonCents])

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
                {averageAdditionalServicesPerPersonCents > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Uwzględniono średnią usług dodatkowych na osobę:{" "}
                    {formatCurrency(averageAdditionalServicesPerPersonCents)} (usługi są per uczestnik).
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Brak harmonogramu płatności</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dolna sekcja - Lista uczestników */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Lista uczestników ({participants.length} os.)</CardTitle>
          {isCoordinator ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/coord/trips/${selectedTrip.id}/message`}>
                <Mail className="mr-2 h-4 w-4" />
                Wyślij wiadomość grupową
              </Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={participants.length === 0}
                onClick={() => setMessageDialogOpen(true)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Wyślij wiadomość grupową
              </Button>
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={participants.length === 0 || generatingReportType !== null}
                >
                  {generatingReportType !== null ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generowanie…
                    </>
                  ) : (
                    <>
                      <FileDown className="mr-2 h-4 w-4" />
                      Generuj raport
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PARTICIPANT_REPORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => downloadParticipantsReport(option.value)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          )}
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
                    <TableHead>Numer umowy</TableHead>
                    <TableHead>Zamawiający</TableHead>
                    <TableHead>Data zgłoszenia</TableHead>
                    <TableHead>Stan wpłaty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedParticipants.map((participant) => {
                    const booking = participant.bookings
                    const isExpanded = !isCoordinator && expandedRows.has(participant.id)
                    const paymentStatus = booking?.payment_status || "unpaid"
                    const paidAmount = getPaidPerParticipantCents(participant)
                    const baseAmount = booking?.trips?.price_cents || 0
                    const additionalServicesAmount = getSelectedServicesTotalCents(participant.selected_services)
                    const totalAmount = baseAmount + additionalServicesAmount
                    const paidPercent = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0
                    const agreementList = booking?.agreements ?? []
                    const { previewAgreement, sentAt, statusBadgeSource } =
                      getAgreementPresentation(agreementList)
                    const previewPdfUrl = previewAgreement?.pdf_url ?? null
                    const agreementSeq =
                      agreementList.find((a) => a.agreement_seq && a.agreement_seq > 0)?.agreement_seq ??
                      null
                    const agreementNumberText = formatAgreementNumber({
                      reservationNumber: booking?.trips?.reservation_number ?? null,
                      agreementSeq,
                    })
                    const agreementNumberUi = agreementNumberText === "-" ? "-" : agreementNumberText.replace(/^#/, "")
                    const canManuallyAddPayment = canManuallyAddPaymentForParticipant(participant)
                    const bookingParticipantCount = getBookingParticipantCount(participant)
                    const bookingTotalPaidCents = booking?.paid_amount_cents ?? 0
                    const bookingTotalDueCents =
                      booking?.id ? (totalDueCentsByBookingId.get(booking.id) ?? 0) : 0
                    const isPrimaryInBooking =
                      booking?.id &&
                      bookingParticipantCount > 1 &&
                      primaryParticipantIdByBookingId.get(booking.id) === participant.id

                    return (
                      <React.Fragment key={participant.id}>
                        <TableRow
                          className={cn(!isCoordinator && "cursor-pointer")}
                          onClick={() => {
                            if (isCoordinator) return
                            if (booking?.id && !isExpanded) {
                              loadPaymentHistory(booking.id)
                            }
                            toggleRow(participant.id)
                          }}
                        >
                          <TableCell className="w-[48px]">
                            {!isCoordinator && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 transition-transform",
                                    isExpanded && "-rotate-90"
                                  )}
                                />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium truncate block">
                              {participant.first_name} {participant.last_name}
                            </span>
                          </TableCell>
                          <TableCell className="truncate">
                            {agreementNumberUi}
                          </TableCell>
                          <TableCell className="truncate">
                            {booking?.company_name ||
                              ([booking?.contact_first_name, booking?.contact_last_name]
                                .filter(Boolean)
                                .join(" ") || "-")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(booking?.created_at)}
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
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30 p-0">
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
                                    {showParticipantGender && (
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
                                      <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                          Brak wygenerowanej umowy dla tej rezerwacji.
                                        </p>
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="h-8 text-xs relative w-[140px]"
                                          disabled={
                                            generatingAgreementForBookingId === booking.id
                                          }
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            generateAgreement(booking.id)
                                          }}
                                        >
                                          <span
                                            className={
                                              generatingAgreementForBookingId === booking.id
                                                ? "opacity-0"
                                                : "opacity-100"
                                            }
                                          >
                                            Wygeneruj umowę
                                          </span>
                                          {generatingAgreementForBookingId === booking.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                                          ) : null}
                                        </Button>
                                      </div>
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

                                        {previewPdfUrl ? (
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
                                                  toggleAgreementPreview(booking.id)
                                                }}
                                              >
                                                {expandedAgreementPreviewByBookingId.has(booking.id)
                                                  ? "Zwiń podgląd"
                                                  : "Pokaż podgląd"}
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  window.open(
                                                    `/api/agreements/${encodeURIComponent(previewPdfUrl)}`,
                                                    "_blank"
                                                  )
                                                }}
                                              >
                                                Otwórz w nowym oknie
                                              </Button>
                                            </div>
                                            {expandedAgreementPreviewByBookingId.has(booking.id) && (
                                              <div className="w-full overflow-hidden rounded-lg border bg-background">
                                                <iframe
                                                  src={`/api/agreements/${encodeURIComponent(previewPdfUrl)}`}
                                                  className="h-[400px] w-full border-0"
                                                  title="Podgląd umowy"
                                                />
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="space-y-2">
                                            <p className="text-sm text-muted-foreground">
                                              Brak pliku PDF umowy do podglądu.
                                            </p>
                                            <Button
                                              type="button"
                                              size="sm"
                                              className="h-8 text-xs relative w-[140px]"
                                              disabled={
                                                generatingAgreementForBookingId === booking.id
                                              }
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                generateAgreement(booking.id)
                                              }}
                                            >
                                              <span
                                                className={
                                                  generatingAgreementForBookingId === booking.id
                                                    ? "opacity-0"
                                                    : "opacity-100"
                                                }
                                              >
                                                Wygeneruj umowę
                                              </span>
                                              {generatingAgreementForBookingId === booking.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                                              ) : null}
                                            </Button>
                                          </div>
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
                                        {additionalServicesAmount > 0 && (
                                          <span className="text-xs text-muted-foreground">
                                            (w tym usługi: {formatCurrency(additionalServicesAmount)})
                                          </span>
                                        )}
                                      </div>
                                      {isPrimaryInBooking && (
                                        <div className="text-xs text-muted-foreground">
                                          Za całą umowę:{" "}
                                          <span className="font-medium text-foreground">
                                            {formatCurrency(bookingTotalPaidCents)}
                                          </span>{" "}
                                          /{" "}
                                          <span className="font-medium text-foreground">
                                            {formatCurrency(bookingTotalDueCents)}
                                          </span>
                                        </div>
                                      )}

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
                                            disabled={!canManuallyAddPayment}
                                            className="h-8 text-sm pr-8"
                                          />
                                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            zł
                                          </span>
                                        </div>
                                        <Button
                                          size="sm"
                                          className="shrink-0 h-8 text-xs"
                                          disabled={
                                            !canManuallyAddPayment ||
                                            updatingPayment === booking.id ||
                                            !paymentInputs[booking.id]
                                          }
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            if (!canManuallyAddPayment) {
                                              toast.error(
                                                "Wpłaty ręczne dodawaj tylko na pierwszym uczestniku tej umowy.",
                                              )
                                              return
                                            }
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
                                              disabled={!canManuallyAddPayment || remainingCents <= 0}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                if (!canManuallyAddPayment) return
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
                                      {!canManuallyAddPayment && bookingParticipantCount > 1 && (
                                        <p className="text-xs text-muted-foreground">
                                          Ta umowa ma {bookingParticipantCount} uczestników. Wpłaty ręczne możesz dodawać
                                          tylko na <span className="font-medium">pierwszym</span> uczestniku — kwota
                                          rozbije się po równo na pozostałych automatycznie.
                                        </p>
                                      )}

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
                                                (paymentHistoryByBookingId[booking.id] ?? []).map((pmt) => {
                                                  const count = getBookingParticipantCount(participant)
                                                  const perParticipantAmountCents =
                                                    count > 1
                                                      ? Math.round(pmt.amount_cents / count)
                                                      : pmt.amount_cents

                                                  return (
                                                    <TableRow key={pmt.id}>
                                                      <TableCell className="whitespace-nowrap">
                                                        {formatDate(pmt.payment_date)}
                                                      </TableCell>
                                                      <TableCell className="whitespace-nowrap">
                                                        {formatPaymentSource(pmt.payment_method)}
                                                      </TableCell>
                                                      <TableCell className="text-right whitespace-nowrap">
                                                        {formatCurrency(perParticipantAmountCents)}
                                                      </TableCell>
                                                      <TableCell>
                                                        {pmt.invoice ? (
                                                          <Button
                                                            variant="link"
                                                            size="sm"
                                                            className="h-auto p-0 text-xs font-medium gap-1"
                                                            onClick={(e) => {
                                                              e.stopPropagation()
                                                              router.push(
                                                                `/trip-dashboard/faktury/${pmt.invoice!.id}`,
                                                              )
                                                            }}
                                                          >
                                                            <FileText className="h-3 w-3" />
                                                            {pmt.invoice.invoice_number || "—"}
                                                          </Button>
                                                        ) : (
                                                          <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            disabled={generatingInvoiceForPaymentId === pmt.id}
                                                            onClick={(e) => {
                                                              e.stopPropagation()
                                                              generateInvoice(booking.id, pmt.id)
                                                            }}
                                                          >
                                                            {generatingInvoiceForPaymentId === pmt.id ? (
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
                                                          disabled={deletingPaymentId === pmt.id}
                                                          onClick={(e) => {
                                                            e.stopPropagation()
                                                            requestDeletePayment(booking.id, pmt.id)
                                                          }}
                                                          aria-label="Usuń płatność"
                                                        >
                                                          {deletingPaymentId === pmt.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                          ) : (
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                          )}
                                                        </Button>
                                                      </TableCell>
                                                    </TableRow>
                                                  )
                                                })
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
                                      bookingId={booking?.id}
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

      <Dialog
        open={messageDialogOpen}
        onOpenChange={(open) => {
          if (sendingMessage) return
          setMessageDialogOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wyślij wiadomość grupową</DialogTitle>
            <DialogDescription>
              Wiadomość e-mail zostanie wysłana do wszystkich zamawiających w tej wycieczce.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="group-message-subject">Temat</Label>
              <Input
                id="group-message-subject"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                disabled={sendingMessage}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-message-body">Wiadomość</Label>
              <Textarea
                id="group-message-body"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={8}
                disabled={sendingMessage}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMessageDialogOpen(false)}
              disabled={sendingMessage}
            >
              Anuluj
            </Button>
            <Button
              disabled={sendingMessage || !messageSubject.trim() || !messageBody.trim()}
              onClick={sendGroupMessage}
            >
              {sendingMessage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wysyłanie…
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Wyślij
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
