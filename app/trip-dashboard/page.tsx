"use client"

import { useEffect, useMemo, useState } from "react"
import { useTrip } from "@/contexts/trip-context"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TripPublicLink } from "@/components/trip-public-link"
import { createClient } from "@/lib/supabase/client"
import {
  Users,
  CalendarDays,
  Banknote,
  TrendingUp,
  MapPin,
  Clock,
  UserCircle,
  Mail,
} from "lucide-react"

type Coordinator = {
  id: string
  full_name: string | null
  email: string | null
}

type BookingStats = {
  totalParticipants: number
  withAnyPayment: number
  fullyPaid: number
  totalPaidCents: number
  totalDueCents: number
}

const formatCurrency = (cents: number | null | undefined): string => {
  if (cents === null || cents === undefined) return "0,00 zł"
  return `${(cents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

const formatDate = (date: string | null | undefined): string => {
  if (!date) return "-"
  return new Date(date).toLocaleDateString("pl-PL")
}

export default function TripDashboardPage() {
  const { selectedTrip, tripFullData } = useTrip()
  const [bookingStats, setBookingStats] = useState<BookingStats>({
    totalParticipants: 0,
    withAnyPayment: 0,
    fullyPaid: 0,
    totalPaidCents: 0,
    totalDueCents: 0,
  })
  const [loadingStats, setLoadingStats] = useState(false)
  const [coordinators, setCoordinators] = useState<Coordinator[]>([])

  // Załaduj koordynatorów
  useEffect(() => {
    if (!selectedTrip) return
    const loadCoordinators = async () => {
      try {
        const res = await fetch(`/api/trips/${selectedTrip.id}/coordinators`)
        if (res.ok) {
          const data = await res.json()
          setCoordinators(data || [])
        }
      } catch (err) {
        console.error("Failed to load coordinators:", err)
      }
    }
    loadCoordinators()
  }, [selectedTrip])

  // Załaduj statystyki uczestników i płatności
  useEffect(() => {
    if (!selectedTrip) return

    const loadStats = async () => {
      setLoadingStats(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("participants")
          .select(
            `
            id,
            bookings:bookings!inner(
              id,
              paid_amount_cents,
              payment_status,
              trips:trips(price_cents)
            )
          `
          )
          .eq("bookings.trip_id", selectedTrip.id)

        if (error) {
          console.error("Dashboard stats error:", error)
          return
        }

        const participants = (data || []).map((p: any) => ({
          ...p,
          bookings: Array.isArray(p.bookings) ? p.bookings[0] : p.bookings,
        }))

        const totalParticipants = participants.length
        const withAnyPayment = participants.filter(
          (p: any) => (p.bookings?.paid_amount_cents ?? 0) > 0
        ).length
        const fullyPaid = participants.filter((p: any) => {
          const paid = p.bookings?.paid_amount_cents ?? 0
          const total = p.bookings?.trips?.price_cents ?? 0
          return total > 0 && paid >= total
        }).length
        const totalPaidCents = participants.reduce(
          (sum: number, p: any) => sum + (p.bookings?.paid_amount_cents ?? 0),
          0
        )
        const totalDueCents = participants.reduce(
          (sum: number, p: any) => sum + (p.bookings?.trips?.price_cents ?? 0),
          0
        )

        setBookingStats({
          totalParticipants,
          withAnyPayment,
          fullyPaid,
          totalPaidCents,
          totalDueCents,
        })
      } catch (err) {
        console.error("Dashboard stats error:", err)
      } finally {
        setLoadingStats(false)
      }
    }

    loadStats()
  }, [selectedTrip])

  // Harmonogram płatności
  const paymentSchedule = useMemo(() => {
    if (!tripFullData || !tripFullData.price_cents || !selectedTrip) return []

    const schedule: Array<{ date: string; amount: number; label: string; percent: number }> = []

    if (
      tripFullData.payment_schedule &&
      Array.isArray(tripFullData.payment_schedule) &&
      tripFullData.payment_schedule.length > 0
    ) {
      tripFullData.payment_schedule.forEach((installment) => {
        const amount = Math.round(
          (tripFullData.price_cents! * installment.percent) / 100
        )
        schedule.push({
          date: installment.due_date,
          amount,
          label: `Rata ${installment.installment_number}`,
          percent: installment.percent,
        })
      })
    } else if (tripFullData.payment_split_enabled) {
      const firstPercent = tripFullData.payment_split_first_percent ?? 30
      const secondPercent = tripFullData.payment_split_second_percent ?? 70
      const firstAmount = Math.round(
        (tripFullData.price_cents * firstPercent) / 100
      )
      const secondAmount = tripFullData.price_cents - firstAmount

      const depositDate = new Date()
      depositDate.setDate(depositDate.getDate() + 7)
      schedule.push({
        date: depositDate.toISOString().split("T")[0],
        amount: firstAmount,
        label: "Zaliczka",
        percent: firstPercent,
      })

      if (selectedTrip.start_date) {
        const finalDate = new Date(selectedTrip.start_date)
        finalDate.setDate(finalDate.getDate() - 14)
        schedule.push({
          date: finalDate.toISOString().split("T")[0],
          amount: secondAmount,
          label: "Reszta",
          percent: secondPercent,
        })
      }
    } else {
      schedule.push({
        date: selectedTrip.start_date
          ? (() => {
              const d = new Date(selectedTrip.start_date!)
              d.setDate(d.getDate() - 14)
              return d.toISOString().split("T")[0]
            })()
          : "-",
        amount: tripFullData.price_cents,
        label: "Pełna kwota",
        percent: 100,
      })
    }

    return schedule
  }, [tripFullData, selectedTrip])

  const seatsTotal = tripFullData?.seats_total ?? 0
  const seatsReserved = tripFullData?.seats_reserved ?? 0
  const seatsLeft = Math.max(0, seatsTotal - seatsReserved)
  const paidPercent =
    bookingStats.totalDueCents > 0
      ? Math.round(
          (bookingStats.totalPaidCents / bookingStats.totalDueCents) * 100
        )
      : 0

  // Oblicz dni do wyjazdu
  const daysUntilTrip = useMemo(() => {
    if (!selectedTrip?.start_date) return null
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const start = new Date(selectedTrip.start_date)
    start.setHours(0, 0, 0, 0)
    const diff = Math.ceil(
      (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    return diff
  }, [selectedTrip])

  if (!selectedTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Wybierz wycieczkę</CardTitle>
            <CardDescription>
              Wybierz wycieczkę z listy w lewym górnym rogu, aby zobaczyć
              dashboard
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{selectedTrip.title}</h1>
          {tripFullData?.location && (
            <div className="flex items-center gap-1.5 mt-1 text-muted-foreground text-sm">
              <MapPin className="h-4 w-4" />
              <span>{tripFullData.location}</span>
            </div>
          )}
        </div>
        <TripPublicLink />
      </div>

      {/* Górne kafelki z kluczowymi liczbami */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Termin */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Termin</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {formatDate(selectedTrip.start_date)} –{" "}
              {formatDate(selectedTrip.end_date)}
            </div>
            {daysUntilTrip !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                {daysUntilTrip > 0
                  ? `Za ${daysUntilTrip} dni`
                  : daysUntilTrip === 0
                    ? "Dziś!"
                    : `${Math.abs(daysUntilTrip)} dni temu`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Uczestnicy */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uczestnicy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bookingStats.totalParticipants}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / {seatsTotal}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Wolnych miejsc: {seatsLeft}
            </p>
          </CardContent>
        </Card>

        {/* Wpłaty */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wpłaty</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(bookingStats.totalPaidCents)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              z {formatCurrency(bookingStats.totalDueCents)} ({paidPercent}%)
            </p>
          </CardContent>
        </Card>

        {/* Status płatności */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Status płatności
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Opłaconych 100%:</span>
                <span className="font-semibold">{bookingStats.fullyPaid}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Wpłaciło coś:</span>
                <span className="font-semibold">
                  {bookingStats.withAnyPayment}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bez wpłaty:</span>
                <span className="font-semibold">
                  {bookingStats.totalParticipants -
                    bookingStats.withAnyPayment}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dolna sekcja — harmonogram płatności + cena */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Harmonogram płatności */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Harmonogram płatności</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentSchedule.length > 0 ? (
              <>
                {paymentSchedule.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item.label}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({item.percent}%)
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Termin: {formatDate(item.date)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    Łączny koszt za osobę:
                  </span>
                  <span className="text-sm font-semibold text-blue-600">
                    {formatCurrency(tripFullData?.price_cents)}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Brak harmonogramu płatności
              </p>
            )}
          </CardContent>
        </Card>

        {/* Podsumowanie wycieczki */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informacje o wycieczce</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Cena za osobę:</span>
              <span className="font-semibold">
                {formatCurrency(tripFullData?.price_cents)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Miejsca:</span>
              <span className="font-semibold">
                {seatsReserved} / {seatsTotal} zajętych
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Status:</span>
              <Badge
                variant="outline"
                className={
                  tripFullData?.is_active
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                }
              >
                {tripFullData?.is_active ? "Aktywna" : "Nieaktywna"}
              </Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Publiczna:</span>
              <Badge
                variant="outline"
                className={
                  tripFullData?.is_public
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-600"
                    : "border-muted-foreground/30"
                }
              >
                {tripFullData?.is_public ? "Tak" : "Nie"}
              </Badge>
            </div>
            {tripFullData?.category && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Kategoria:</span>
                <span className="font-semibold">{tripFullData.category}</span>
              </div>
            )}
            <Separator />
            {/* Koordynatorzy */}
            <div className="space-y-2">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
                Koordynatorzy
              </span>
              {coordinators.length > 0 ? (
                coordinators.map((coord) => (
                  <div key={coord.id} className="text-sm pl-5">
                    <div className="font-medium">{coord.full_name || "Bez nazwy"}</div>
                    {coord.email && (
                      <a
                        href={`mailto:${coord.email}`}
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {coord.email}
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground pl-5">Brak przypisanych koordynatorów</p>
              )}
            </div>
            <Separator />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Raty:
              </span>
              <span className="font-semibold">{paymentSchedule.length}</span>
            </div>
            {tripFullData?.payment_schedule &&
              tripFullData.payment_schedule.length > 0 && (
                <div className="space-y-1">
                  {tripFullData.payment_schedule.map((item) => (
                    <div
                      key={item.installment_number}
                      className="flex justify-between text-xs text-muted-foreground"
                    >
                      <span>
                        Rata {item.installment_number} ({item.percent}%)
                      </span>
                      <span>do {formatDate(item.due_date)}</span>
                    </div>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
