"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTrip } from "@/contexts/trip-context"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ReusableTable } from "@/components/reusable-table"
import { toast } from "sonner"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Loader2, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type InvoiceStatus = "wystawiona" | "wysłana" | "opłacona"

type InvoiceWithBooking = {
  id: string
  invoice_number: string
  amount_cents: number
  status: InvoiceStatus
  created_at: string
  updated_at: string
  booking_id: string
  fakturownia_invoice_id: string | null
  invoice_provider_error: string | null
  bookings: {
    id: string
    booking_ref: string
    contact_email: string | null
    trip_id: string
    agreements?: {
      id: string
      status: string
      agreement_seq: number | null
    }[]
    trips: {
      id: string
      title: string
      price_cents: number | null
      reservation_number?: string | null
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

function formatAgreementNumber(opts: {
  reservationNumber?: string | null
  agreementSeq?: number | null
}): string {
  const reservation = (opts.reservationNumber ?? "").trim().replace(/^#+/, "")
  const seq = opts.agreementSeq ?? null
  if (!reservation || !seq || seq <= 0) return "—"
  return `#${reservation.padStart(6, "0")}/${String(seq).padStart(3, "0")}`
}

async function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function FakturyPage() {
  const router = useRouter()
  const { selectedTrip } = useTrip()
  const [invoices, setInvoices] = useState<InvoiceWithBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<InvoiceWithBooking[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)

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
      const response = await fetch(`/api/invoices?trip_id=${selectedTrip.id}`)
      if (!response.ok) {
        throw new Error("Nie udało się wczytać faktur")
      }
      const data: InvoiceWithBooking[] = await response.json()
      setInvoices(data)
      setSelectedRows([])
    } catch (err) {
      toast.error("Nie udało się wczytać faktur")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadSelected = async () => {
    if (!selectedTrip) return

    if (selectedRows.length === 0) {
      toast.error("Zaznacz przynajmniej jedną fakturę")
      return
    }

    try {
      setDownloading(true)
      const response = await fetch("/api/invoices/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: selectedTrip.id,
          ids: selectedRows.map((r) => r.id),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(
          data?.error === "brak_faktur"
            ? "Brak faktur do pobrania"
            : data?.error === "nie_udalo_sie_pobrac_pdf"
              ? "Nie udało się pobrać PDF faktur"
              : data?.error || `HTTP ${response.status}`
        )
      }

      const blob = await response.blob()
      const okCount = Number(response.headers.get("X-Invoices-Ok") || "0")
      const failedCount = Number(
        response.headers.get("X-Invoices-Failed") || "0"
      )
      const safeTitle = selectedTrip.title
        .replace(/[\\/:*?"<>|]+/g, "-")
        .slice(0, 60)
      await triggerBlobDownload(blob, `faktury-${safeTitle}.zip`)

      if (failedCount > 0) {
        toast.warning(
          `Pobrano ZIP (${okCount} faktur), pominięto: ${failedCount}`
        )
      } else {
        toast.success(
          okCount === 1
            ? "Pobrano fakturę w ZIP"
            : `Pobrano ${okCount} faktur w ZIP`
        )
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Nie udało się pobrać zaznaczonych faktur"
      )
      console.error(err)
    } finally {
      setDownloading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (selectedRows.length === 0) return

    try {
      setDeleting(true)
      const response = await fetch("/api/invoices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedRows.map((r) => r.id) }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || "Nie udało się usunąć faktur")
      }

      const deletedCount = data?.deletedCount ?? 0
      const failedCount = data?.failedCount ?? 0

      if (deletedCount > 0 && failedCount === 0) {
        toast.success(
          deletedCount === 1
            ? "Usunięto fakturę"
            : `Usunięto ${deletedCount} faktur`
        )
      } else if (deletedCount > 0) {
        toast.warning(
          `Usunięto ${deletedCount}, nie udało się: ${failedCount}`
        )
      } else {
        toast.error("Nie udało się usunąć faktur")
      }

      setDeleteDialogOpen(false)
      setSelectedRows([])
      await loadData()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Nie udało się usunąć faktur"
      )
      console.error(err)
    } finally {
      setDeleting(false)
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
        cell: ({ row }) => {
          const booking = row.original.bookings
          const rawAgreements = booking?.agreements
          const agreements = Array.isArray(rawAgreements)
            ? rawAgreements
            : rawAgreements
              ? [rawAgreements]
              : []
          const agreementSeq =
            agreements
              .map((a) => a.agreement_seq ?? 0)
              .filter((n) => n > 0)
              .sort((a, b) => b - a)[0] ?? null

          const agreementNumberText = formatAgreementNumber({
            reservationNumber: booking?.trips?.reservation_number ?? null,
            agreementSeq,
          })
          const agreementNumberUi =
            agreementNumberText === "—"
              ? "—"
              : agreementNumberText.replace(/^#/, "")

          return (
            <div className="space-y-1">
              <div className="text-sm font-medium">{agreementNumberUi}</div>
              <div className="text-xs text-muted-foreground">
                {booking?.contact_email ? ` • ${booking.contact_email}` : ""}
              </div>
            </div>
          )
        },
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
          <Badge variant={getInvoiceStatusBadgeVariant(row.original.status)}>
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
        getRowId={(row) => row.id}
        enableRowSelection={true}
        selectAllRows={true}
        onSelectionChange={setSelectedRows}
        onRowClick={(invoice) =>
          router.push(`/trip-dashboard/faktury/${invoice.id}`)
        }
        customToolbarButtons={(selectedCount) => (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSelected}
              disabled={selectedCount === 0 || downloading || deleting}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Pobierz
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={selectedCount === 0 || downloading || deleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Usuń
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
          </>
        )}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usunąć zaznaczone faktury?</DialogTitle>
            <DialogDescription>
              Usuniesz {selectedRows.length}{" "}
              {selectedRows.length === 1 ? "fakturę" : "faktur"} z systemu
              {selectedRows.some((r) => r.fakturownia_invoice_id)
                ? " oraz z Fakturowni"
                : ""}
              . Tej operacji nie można cofnąć.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Usuwanie...
                </>
              ) : (
                "Usuń"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
