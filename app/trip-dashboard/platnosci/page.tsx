"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTrip } from "@/contexts/trip-context"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ReusableTable } from "@/components/reusable-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  getPaymentStatusBadgeClass,
  getPaymentStatusLabel,
  type PaymentStatusValue,
} from "@/app/admin/trips/[id]/bookings/payment-status"
import { toast } from "sonner"
import { useTransition } from "react"
import { Loader2Icon, RefreshCwIcon, CheckCircle2Icon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type BookingWithTrip = {
  id: string
  booking_ref: string
  contact_email: string | null
  contact_phone: string | null
  payment_status: PaymentStatusValue
  created_at: string | null
  trip_id: string
  trips: {
    id: string
    title: string
    slug: string
  } | null
}

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
})

function PaymentStatusSelectWithRefresh({
  bookingId,
  initialStatus,
  onStatusChange,
}: {
  bookingId: string
  initialStatus: PaymentStatusValue
  onStatusChange?: (bookingId: string, newStatus: PaymentStatusValue) => void
}) {
  const [value, setValue] = useState<PaymentStatusValue>(initialStatus)
  const [isPending, startTransition] = useTransition()

  const handleChange = (nextStatus: PaymentStatusValue) => {
    if (nextStatus === value) return

    const previous = value
    setValue(nextStatus)

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/bookings/${bookingId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ payment_status: nextStatus }),
          })

          if (!response.ok) {
            const data = await response.json().catch(() => null)
            throw new Error(data?.error ?? "update_failed")
          }

          toast.success("Status płatności zaktualizowany")
          onStatusChange?.(bookingId, nextStatus)
        } catch (error) {
          setValue(previous)
          toast.error("Nie udało się zapisać statusu płatności")
          console.error(error)
        }
      })()
    })
  }

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
  )
}

export default function PlatnosciPage() {
  const router = useRouter()
  const { selectedTrip } = useTrip()
  const [bookings, setBookings] = useState<BookingWithTrip[]>([])
  const [loading, setLoading] = useState(true)

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
      const timestamp = Date.now()
      const url = `/api/admin/bookings?trip_id=${encodeURIComponent(selectedTrip.id)}&_t=${timestamp}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("fetch_failed")
      }

      const bookingsData: BookingWithTrip[] = await response.json()
      setBookings(bookingsData || [])
    } catch (err) {
      toast.error("Nie udało się wczytać płatności")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentStatusChange = (
    bookingId: string,
    newStatus: PaymentStatusValue
  ) => {
    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === bookingId
          ? { ...booking, payment_status: newStatus }
          : booking
      )
    )
  }

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
          const booking = row.original
          const createdAtLabel = booking.created_at
            ? dateFormatter.format(new Date(booking.created_at))
            : "—"

          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "border text-xs font-medium uppercase",
                    getPaymentStatusBadgeClass(booking.payment_status)
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
              </div>
              <span className="text-xs text-muted-foreground">
                Utworzono: {createdAtLabel}
              </span>
            </div>
          )
        },
      },
      {
        id: "actions",
        header: "Akcje",
        cell: ({ row }) => (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/bookings/${row.original.id}`}>
              Szczegóły
            </Link>
          </Button>
        ),
      },
    ],
    []
  )

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <div className="mb-1">
            Wycieczka:{" "}
            <span className="font-medium">{selectedTrip.title}</span>
          </div>
          {bookings.length > 0 && (
            <span>
              Łącznie rezerwacji: {bookings.length} | Opłacone:{" "}
              {bookings.filter((b) => b.payment_status === "paid").length} |
              Nieopłacone:{" "}
              {bookings.filter((b) => b.payment_status === "unpaid").length} |
              Częściowe:{" "}
              {bookings.filter((b) => b.payment_status === "partial").length}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading}>
          <RefreshCwIcon
            className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Odśwież
        </Button>
      </div>
      <ReusableTable
        columns={columns}
        data={bookings}
        searchable={true}
        searchPlaceholder="Szukaj po numerze rezerwacji lub emailu..."
        searchColumn="booking_ref"
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak płatności dla tej wycieczki"
      />
    </div>
  )
}

