"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTrip } from "@/contexts/trip-context"
import { ColumnDef } from "@tanstack/react-table"
import { createClient } from "@/lib/supabase/client"
import { ReusableTable } from "@/components/reusable-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Participant = {
  id: string
  first_name: string
  last_name: string
  pesel: string | null
  email: string | null
  phone: string | null
  booking_id: string
  bookings: {
    id: string
    booking_ref: string
    trip_id: string
  } | null
}

export default function UczestnicyPage() {
  const router = useRouter()
  const { selectedTrip } = useTrip()
  const [participants, setParticipants] = useState<Participant[]>([])
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

      // Pobierz uczestników dla wybranej wycieczki
      const { data, error } = await supabase
        .from("participants")
        .select(
          `
          id,
          first_name,
          last_name,
          pesel,
          email,
          phone,
          booking_id,
          bookings:bookings!inner(id, booking_ref, trip_id)
        `
        )
        .eq("bookings.trip_id", selectedTrip.id)

      if (error) {
        throw error
      }

      // Mapuj dane, aby bookings było pojedynczym obiektem zamiast tablicy
      const mappedParticipants = (data || []).map((participant: any) => ({
        ...participant,
        bookings: Array.isArray(participant.bookings) ? participant.bookings[0] || null : participant.bookings,
      }))

      setParticipants(mappedParticipants)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const columns = useMemo<ColumnDef<Participant>[]>(
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
        cell: ({ row }) => row.original.pesel || <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) =>
          row.original.email || <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "phone",
        header: "Telefon",
        cell: ({ row }) =>
          row.original.phone || <span className="text-muted-foreground">—</span>,
      },
      {
        id: "booking",
        header: "Rezerwacja",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.bookings?.booking_ref || "—"}</span>
        ),
      },
      {
        id: "actions",
        header: "Akcje",
        cell: ({ row }) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/admin/uczestnicy/${row.original.id}`)}
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
        data={participants}
        searchable={true}
        searchPlaceholder="Szukaj po imieniu, nazwisku lub PESEL..."
        searchColumn="first_name"
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak uczestników dla tej wycieczki"
      />
    </div>
  )
}

