"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTrip } from "@/contexts/trip-context"
import { createClient } from "@/lib/supabase/client"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ReusableTable } from "@/components/reusable-table"
import {
  getPaymentStatusBadgeClass,
  getPaymentStatusLabel,
  type PaymentStatusValue,
} from "@/app/admin/trips/[id]/bookings/payment-status"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type BookingWithTrip = {
  id: string
  booking_ref: string
  contact_email: string | null
  contact_phone: string | null
  status: "pending" | "confirmed" | "cancelled"
  payment_status: PaymentStatusValue
  source?: string | null
  created_at: string | null
  trip_id: string
  trips: {
    id: string
    title: string
    slug: string
    start_date: string | null
    end_date: string | null
  } | null
  agreements?: {
    id: string
    status: "generated" | "sent" | "signed"
  }[]
}

const getBookingStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "Wstępna",
    confirmed: "Potwierdzona",
    cancelled: "Anulowana",
  }
  return labels[status] || status
}

const getAgreementStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    generated: "Wygenerowana",
    sent: "Wysłana",
    signed: "Podpisana",
  }
  return labels[status] || status
}

export default function RezerwacjePage() {
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
      const supabase = createClient()

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
        .eq("trip_id", selectedTrip.id)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      // Mapuj dane, aby trips było pojedynczym obiektem zamiast tablicy
      const mappedBookings = (bookingsData || []).map((booking: any) => ({
        ...booking,
        trips: Array.isArray(booking.trips) ? booking.trips[0] || null : booking.trips,
      }))

      setBookings(mappedBookings)
    } catch (err) {
      toast.error("Nie udało się wczytać rezerwacji")
      console.error(err)
    } finally {
      setLoading(false)
    }
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
            <div className="text-sm">{row.original.contact_email ?? "—"}</div>
            {row.original.contact_phone && (
              <div className="text-xs text-muted-foreground">
                {row.original.contact_phone}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="outline">
            {getBookingStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "payment_status",
        header: "Status płatności",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={getPaymentStatusBadgeClass(row.original.payment_status)}
          >
            {getPaymentStatusLabel(row.original.payment_status)}
          </Badge>
        ),
      },
      {
        id: "agreement",
        header: "Umowa",
        cell: ({ row }) => {
          const agreements = row.original.agreements || []
          if (agreements.length === 0) {
            return <span className="text-muted-foreground">—</span>
          }
          const lastAgreement = agreements[agreements.length - 1]
          return (
            <Badge variant="secondary">
              {getAgreementStatusLabel(lastAgreement.status)}
            </Badge>
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
      <div className="text-sm text-muted-foreground">
        Wycieczka: <span className="font-medium">{selectedTrip.title}</span>
      </div>
      <ReusableTable
        columns={columns}
        data={bookings}
        searchable={true}
        searchPlaceholder="Szukaj po numerze rezerwacji lub emailu..."
        searchColumn="booking_ref"
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak rezerwacji dla tej wycieczki"
      />
    </div>
  )
}

