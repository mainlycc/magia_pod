"use client"

import { useState, useEffect, useMemo } from "react"
import { useTrip } from "@/contexts/trip-context"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { ReusableTable } from "@/components/reusable-table"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type InvoiceStatus = "wystawiona" | "wysłana" | "opłacona"

type InvoiceWithBooking = {
  id: string
  invoice_number: string
  amount_cents: number
  status: InvoiceStatus
  created_at: string
  updated_at: string
  booking_id: string
  bookings: {
    id: string
    booking_ref: string
    contact_email: string | null
    trip_id: string
    trips: {
      id: string
      title: string
      price_cents: number | null
    } | null
  } | null
  participants_count?: number
}

const formatAmount = (cents: number): string => {
  const zl = Math.floor(cents / 100)
  const gr = cents % 100
  return `${zl},${gr.toString().padStart(2, "0")} zł`
}

const getInvoiceStatusLabel = (status: InvoiceStatus): string => {
  const labels: Record<InvoiceStatus, string> = {
    wystawiona: "Wystawiona",
    wysłana: "Wysłana",
    opłacona: "Opłacona",
  }
  return labels[status] || status
}

const getInvoiceStatusBadgeVariant = (
  status: InvoiceStatus
): "default" | "secondary" | "outline" => {
  const variants: Record<InvoiceStatus, "default" | "secondary" | "outline"> = {
    wystawiona: "outline",
    wysłana: "secondary",
    opłacona: "default",
  }
  return variants[status] || "outline"
}

export default function FakturyPage() {
  const { selectedTrip } = useTrip()
  const [invoices, setInvoices] = useState<InvoiceWithBooking[]>([])
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
      const response = await fetch("/api/admin/invoices")
      if (!response.ok) {
        throw new Error("Nie udało się wczytać faktur")
      }
      const data: InvoiceWithBooking[] = await response.json()
      // Filtruj po wybranej wycieczce
      const filtered = data.filter(
        (invoice) => invoice.bookings?.trip_id === selectedTrip.id
      )
      setInvoices(filtered)
    } catch (err) {
      toast.error("Nie udało się wczytać faktur")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const columns = useMemo<ColumnDef<InvoiceWithBooking>[]>(
    () => [
      {
        accessorKey: "invoice_number",
        header: "Numer faktury",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.invoice_number}</span>
        ),
      },
      {
        id: "booking",
        header: "Rezerwacja",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="text-sm">
              {row.original.bookings?.booking_ref ?? "—"}
            </div>
            {row.original.bookings?.contact_email && (
              <div className="text-xs text-muted-foreground">
                {row.original.bookings.contact_email}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "amount_cents",
        header: "Kwota",
        cell: ({ row }) => (
          <span className="font-medium">
            {formatAmount(row.original.amount_cents)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={getInvoiceStatusBadgeVariant(row.original.status)}
          >
            {getInvoiceStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Data wystawienia",
        cell: ({ row }) => {
          const date = new Date(row.original.created_at)
          return date.toLocaleDateString("pl-PL")
        },
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
        data={invoices}
        searchable={true}
        searchPlaceholder="Szukaj po numerze faktury lub rezerwacji..."
        searchColumn="invoice_number"
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak faktur dla tej wycieczki"
      />
    </div>
  )
}

