"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTrip } from "@/contexts/trip-context"
import { ColumnDef } from "@tanstack/react-table"
import { ReusableTable } from "@/components/reusable-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type InsuranceSubmission = {
  id: string
  trip_id: string
  booking_id: string | null
  participants_count: number
  submission_date: string
  status:
    | "pending"
    | "calculating"
    | "registered"
    | "sent"
    | "issued"
    | "accepted"
    | "error"
    | "cancelled"
    | "manual_check_required"
  error_message: string | null
  policy_number: string | null
  external_policy_number: string | null
  policy_status_code: string | null
  created_at: string
  updated_at: string
  trips: {
    id: string
    title: string
    start_date: string | null
    end_date: string | null
  } | null
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "Oczekujące",
    calculating: "Kalkulacja",
    registered: "Zarejestrowane",
    sent: "Wysłane",
    issued: "Wystawione",
    accepted: "Zaakceptowane",
    error: "Błąd",
    cancelled: "Anulowane",
    manual_check_required: "Wymaga kontroli",
  }
  return labels[status] || status
}

const getStatusBadgeVariant = (
  status: string
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "accepted":
      return "default"
    case "sent":
      return "secondary"
    case "error":
      return "destructive"
    case "pending":
    default:
      return "outline"
  }
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "-"
  const date = new Date(dateString)
  return date.toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export default function UbezpieczeniaPage() {
  const router = useRouter()
  const { selectedTrip } = useTrip()
  const [submissions, setSubmissions] = useState<InsuranceSubmission[]>([])
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
      const res = await fetch(
        `/api/insurance/submissions?trip_id=${encodeURIComponent(selectedTrip.id)}`
      )
      if (!res.ok) {
        throw new Error("Nie udało się wczytać zgłoszeń")
      }
      const data = await res.json()
      setSubmissions(data)
    } catch (err) {
      toast.error("Nie udało się wczytać zgłoszeń ubezpieczeniowych")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const columns = useMemo<ColumnDef<InsuranceSubmission>[]>(
    () => [
      {
        id: "submission_date",
        header: "Data zgłoszenia",
        cell: ({ row }) => formatDate(row.original.submission_date),
      },
      {
        id: "participants_count",
        header: "Liczba uczestników",
        cell: ({ row }) => row.original.participants_count,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={getStatusBadgeVariant(row.original.status)}>
            {getStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "policy_number",
        header: "Numer polisy",
        cell: ({ row }) =>
          row.original.policy_number || row.original.external_policy_number || (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "error_message",
        header: "Błąd",
        cell: ({ row }) =>
          row.original.error_message ? (
            <span className="text-destructive text-sm">
              {row.original.error_message}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "Akcje",
        cell: ({ row }) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              router.push(`/admin/insurance/${row.original.id}`)
            }
          >
            Szczegóły
          </Button>
        ),
      },
    ],
    [router]
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
        data={submissions}
        searchable={true}
        searchPlaceholder="Szukaj po numerze polisy..."
        searchColumn="policy_number"
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak zgłoszeń ubezpieczeniowych dla tej wycieczki"
      />
    </div>
  )
}

