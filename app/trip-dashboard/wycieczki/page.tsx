"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { ReusableTable } from "@/components/reusable-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTrip } from "@/contexts/trip-context"
import { clearTripsListCache } from "@/lib/trips-list-cache"
import { toast } from "sonner"
import {
  Archive,
  Copy,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react"

type TripRow = {
  id: string
  title: string
  slug: string
  start_date: string | null
  end_date: string | null
  price_cents: number | null
  seats_total: number | null
  seats_reserved: number | null
  is_active: boolean | null
  created_at: string
}

type StatusFilter = "all" | "active" | "inactive" | "archived"

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "—"
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return fmt(start)
  return end ? fmt(end) : "—"
}

function formatPrice(cents: number | null): string {
  if (cents == null) return "—"
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(cents / 100)
}

function isPastTrip(trip: Pick<TripRow, "end_date" | "start_date">): boolean {
  const tripDate = trip.end_date ?? trip.start_date
  if (!tripDate) return false

  const endOfTripDay = new Date(tripDate)
  endOfTripDay.setHours(23, 59, 59, 999)
  return endOfTripDay.getTime() < Date.now()
}

function isArchivedTrip(trip: Pick<TripRow, "is_active" | "end_date" | "start_date">): boolean {
  return !trip.is_active && isPastTrip(trip)
}

export default function WycieczkiPage() {
  const router = useRouter()
  const { setSelectedTrip, refreshTrips } = useTrip()
  const [trips, setTrips] = useState<TripRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tripToDelete, setTripToDelete] = useState<TripRow | null>(null)
  const [tripsToBulkDelete, setTripsToBulkDelete] = useState<TripRow[]>([])
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [selectedTrips, setSelectedTrips] = useState<TripRow[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadTrips = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true)
      const res = await fetch("/api/trips")
      if (!res.ok) {
        toast.error("Nie udało się wczytać wycieczek")
        return
      }
      const data = (await res.json()) as TripRow[]
      setTrips(
        data.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      )
    } catch {
      toast.error("Błąd podczas ładowania wycieczek")
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTrips()
  }, [loadTrips])

  const filteredTrips = useMemo(() => {
    if (statusFilter === "active") {
      return trips.filter((t) => t.is_active)
    }
    if (statusFilter === "archived") {
      return trips.filter((t) => isArchivedTrip(t))
    }
    if (statusFilter === "inactive") {
      return trips.filter((t) => !t.is_active && !isArchivedTrip(t))
    }
    return trips
  }, [trips, statusFilter])

  const afterMutation = useCallback(async () => {
    clearTripsListCache()
    await refreshTrips({ loadProfile: false })
    await loadTrips({ silent: true })
  }, [refreshTrips, loadTrips])

  const handleOpen = useCallback(
    (trip: TripRow) => {
      setSelectedTrip({
        id: trip.id,
        title: trip.title,
        slug: trip.slug,
        start_date: trip.start_date,
        end_date: trip.end_date,
      })
      router.push("/trip-dashboard/informacje")
    },
    [setSelectedTrip, router],
  )

  const handleSelectTrip = useCallback(
    (trip: TripRow) => {
      setSelectedTrip({
        id: trip.id,
        title: trip.title,
        slug: trip.slug,
        start_date: trip.start_date,
        end_date: trip.end_date,
      })
      toast.success(`Ustawiono wycieczkę: ${trip.title}`)
    },
    [setSelectedTrip],
  )

  const handleDuplicate = useCallback(
    async (trip: TripRow) => {
      setActionLoading(trip.id)
      try {
        const res = await fetch(`/api/trips/${trip.id}/duplicate`, {
          method: "POST",
        })
        if (!res.ok) {
          toast.error("Nie udało się zduplikować wycieczki")
          return
        }
        const result = (await res.json()) as { title: string }
        toast.success(`Utworzono kopię: ${result.title}`)
        await afterMutation()
      } catch {
        toast.error("Błąd podczas duplikowania wycieczki")
      } finally {
        setActionLoading(null)
      }
    },
    [afterMutation],
  )

  const handleToggleActive = useCallback(
    async (trip: TripRow) => {
      setActionLoading(trip.id)
      try {
        const res = await fetch(`/api/trips/${trip.id}/toggle-active`, {
          method: "POST",
        })
        if (!res.ok) {
          toast.error("Nie udało się zmienić statusu wycieczki")
          return
        }
        const result = (await res.json()) as { is_active: boolean }
        toast.success(
          result.is_active
            ? "Wycieczka została aktywowana"
            : "Wycieczka została dezaktywowana",
        )
        await afterMutation()
      } catch {
        toast.error("Błąd podczas zmiany statusu wycieczki")
      } finally {
        setActionLoading(null)
      }
    },
    [afterMutation],
  )

  const handleArchive = useCallback(
    async (trip: TripRow) => {
      if (!trip.is_active) {
        toast.error("Ta wycieczka jest już nieaktywna")
        return
      }
      if (!isPastTrip(trip)) {
        toast.error("Do archiwum można przenieść tylko zakończone wycieczki")
        return
      }

      setActionLoading(trip.id)
      try {
        const res = await fetch(`/api/trips/${trip.id}/toggle-active`, {
          method: "POST",
        })
        if (!res.ok) {
          toast.error("Nie udało się przenieść wycieczki do archiwum")
          return
        }
        toast.success("Wycieczka została przeniesiona do archiwum")
        await afterMutation()
      } catch {
        toast.error("Błąd podczas archiwizacji wycieczki")
      } finally {
        setActionLoading(null)
      }
    },
    [afterMutation],
  )

  const deleteTrips = useCallback(
    async (tripsToRemove: TripRow[]) => {
      if (tripsToRemove.length === 0) return

      setActionLoading(tripsToRemove.length === 1 ? tripsToRemove[0].id : "bulk")
      try {
        const results = await Promise.all(
          tripsToRemove.map(async (trip) => {
            const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" })
            return { ok: res.ok, title: trip.title }
          }),
        )
        const failed = results.filter((r) => !r.ok)
        const succeeded = results.length - failed.length

        if (succeeded === 1) {
          toast.success("Wycieczka została usunięta")
        } else if (succeeded > 1) {
          toast.success(`Usunięto ${succeeded} wycieczek`)
        }
        if (failed.length > 0) {
          toast.error(
            `Nie udało się usunąć: ${failed.map((f) => f.title).join(", ")}`,
          )
        }

        if (succeeded > 0) {
          const removedIds = new Set(
            tripsToRemove
              .filter((_, index) => results[index]?.ok)
              .map((trip) => trip.id),
          )
          setTrips((prev) => prev.filter((trip) => !removedIds.has(trip.id)))
          setSelectedTrips((prev) =>
            prev.filter((trip) => !removedIds.has(trip.id)),
          )
          setDeleteDialogOpen(false)
          setTripToDelete(null)
          setBulkDeleteDialogOpen(false)
          setTripsToBulkDelete([])
          await afterMutation()
        }
      } catch {
        toast.error("Błąd podczas usuwania wycieczek")
      } finally {
        setActionLoading(null)
      }
    },
    [afterMutation],
  )

  const handleDelete = useCallback(async () => {
    if (!tripToDelete) return
    await deleteTrips([tripToDelete])
  }, [tripToDelete, deleteTrips])

  const handleBulkDeleteConfirm = useCallback(async () => {
    await deleteTrips(tripsToBulkDelete)
  }, [tripsToBulkDelete, deleteTrips])

  const columns = useMemo<ColumnDef<TripRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Tytuł",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title}</span>
        ),
      },
      {
        id: "dates",
        accessorFn: (row) => {
          const date = row.end_date ?? row.start_date
          return date ? new Date(date).getTime() : 0
        },
        header: "Daty",
        enableSorting: true,
        cell: ({ row }) => {
          const past = isPastTrip(row.original)
          return (
            <span
              className={
                past
                  ? "text-sm whitespace-nowrap text-muted-foreground"
                  : "text-sm whitespace-nowrap"
              }
            >
              {formatDateRange(row.original.start_date, row.original.end_date)}
            </span>
          )
        },
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => {
          if (row.original.is_active) {
            return <Badge variant="default">Aktywna</Badge>
          }
          if (isArchivedTrip(row.original)) {
            return <Badge variant="outline">Archiwalna</Badge>
          }
          return <Badge variant="secondary">Nieaktywna</Badge>
        },
      },
      {
        id: "seats",
        header: "Miejsca",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.seats_reserved ?? 0}/{row.original.seats_total ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "price_cents",
        header: "Cena",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatPrice(row.original.price_cents)}
          </span>
        ),
      },
      {
        accessorKey: "slug",
        header: "Slug",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground font-mono">
            {row.original.slug}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Akcje",
        cell: ({ row }) => {
          const trip = row.original
          const isLoading = actionLoading === trip.id
          const canArchive = trip.is_active && isPastTrip(trip)
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isLoading}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpen(trip)
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Otwórz
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDuplicate(trip)
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplikuj
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleActive(trip)
                  }}
                >
                  {trip.is_active ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-2" />
                      Dezaktywuj
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Aktywuj
                    </>
                  )}
                </DropdownMenuItem>
                {canArchive && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleArchive(trip)
                    }}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Przenieś do archiwum
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setTripToDelete(trip)
                    setDeleteDialogOpen(true)
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Usuń
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [actionLoading, handleOpen, handleDuplicate, handleToggleActive],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Zarządzaj wszystkimi wycieczkami — aktywuj, duplikuj lub usuń.
      </p>

      <ReusableTable
        columns={columns}
        data={filteredTrips}
        cardClassName="border-0 shadow-none bg-transparent"
        searchable={true}
        searchPlaceholder="Szukaj po tytule lub slugu..."
        searchColumn="title"
        getRowId={(row) => row.id}
        customGlobalFilterFn={(trip: TripRow, filterValue) => {
          const query = filterValue.toLowerCase()
          return (
            trip.title.toLowerCase().includes(query) ||
            trip.slug.toLowerCase().includes(query)
          )
        }}
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak wycieczek"
        onRowClick={handleSelectTrip}
        enableRowSelection={true}
        onSelectionChange={setSelectedTrips}
        customToolbarButtons={() => (
          <>
            <Button
              size="sm"
              variant="destructive"
              disabled={selectedTrips.length === 0 || actionLoading === "bulk"}
              onClick={() => {
                setTripsToBulkDelete(selectedTrips)
                setBulkDeleteDialogOpen(true)
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Usuń
              {selectedTrips.length > 0 ? ` (${selectedTrips.length})` : ""}
            </Button>
            <Button asChild size="sm">
              <Link href="/trip-dashboard/dodaj-wycieczke">Dodaj wycieczkę</Link>
            </Button>
          </>
        )}
        filters={
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="active">Aktywne</SelectItem>
              <SelectItem value="inactive">Nieaktywne</SelectItem>
              <SelectItem value="archived">Archiwalne</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuń wycieczkę</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Czy na pewno chcesz usunąć wycieczkę{" "}
                  <strong>{tripToDelete?.title}</strong>
                  {tripToDelete?.start_date && (
                    <> ({formatDateRange(tripToDelete.start_date, tripToDelete.end_date)})</>
                  )}
                  ?
                </p>
                <p>
                  Usunięcie jest nieodwracalne. Zostaną usunięte wszystkie
                  rezerwacje, uczestnicy i powiązane dane.
                </p>
                {(tripToDelete?.seats_reserved ?? 0) > 0 && (
                  <p className="text-destructive font-medium">
                    Ta wycieczka ma {tripToDelete?.seats_reserved} zajętych
                    miejsc — wszystkie rezerwacje zostaną trwale usunięte.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setTripToDelete(null)
              }}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading === tripToDelete?.id}
            >
              {actionLoading === tripToDelete?.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Usuń wycieczkę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuń zaznaczone wycieczki</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Czy na pewno chcesz usunąć{" "}
                  <strong>{tripsToBulkDelete.length}</strong>{" "}
                  {tripsToBulkDelete.length === 1 ? "wycieczkę" : "wycieczek"}?
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {tripsToBulkDelete.slice(0, 8).map((trip) => (
                    <li key={trip.id}>
                      <strong>{trip.title}</strong>
                      {trip.start_date && (
                        <> ({formatDateRange(trip.start_date, trip.end_date)})</>
                      )}
                    </li>
                  ))}
                  {tripsToBulkDelete.length > 8 && (
                    <li>…i {tripsToBulkDelete.length - 8} więcej</li>
                  )}
                </ul>
                <p>
                  Usunięcie jest nieodwracalne. Zostaną usunięte wszystkie
                  rezerwacje, uczestnicy i powiązane dane.
                </p>
                {tripsToBulkDelete.some((t) => (t.seats_reserved ?? 0) > 0) && (
                  <p className="text-destructive font-medium">
                    Część zaznaczonych wycieczek ma zajęte miejsca — powiązane
                    rezerwacje zostaną trwale usunięte.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkDeleteDialogOpen(false)
                setTripsToBulkDelete([])
              }}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDeleteConfirm}
              disabled={actionLoading === "bulk"}
            >
              {actionLoading === "bulk" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Usuń zaznaczone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
