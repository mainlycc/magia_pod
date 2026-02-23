"use client"

import { useEffect, useState } from "react"
import { useTrip } from "@/contexts/trip-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X } from "lucide-react"
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor"
import { PaymentScheduleItem } from "@/contexts/trip-context"

type Coordinator = {
  id: string
  full_name: string | null
}

const generateId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`

export default function TripGeneralInfoPage() {
  const { selectedTrip, tripFullData, isLoadingTripData, invalidateTripCache } = useTrip()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [price, setPrice] = useState("")
  const [seatsTotal, setSeatsTotal] = useState("")
  const [location, setLocation] = useState("")
  const [paymentReminderEnabled, setPaymentReminderEnabled] = useState(false)
  const [paymentReminderDaysBefore, setPaymentReminderDaysBefore] = useState("")
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>([])

  const [coordinators, setCoordinators] = useState<Coordinator[]>([])
  const [availableCoordinators, setAvailableCoordinators] = useState<
    Coordinator[]
  >([])
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState("")
  const [loadingCoordinators, setLoadingCoordinators] = useState(true)

  // Użyj cache'owanych danych z kontekstu
  useEffect(() => {
    if (!selectedTrip) {
      setLoading(false)
      return
    }

    if (!selectedTrip.id) {
      setLoading(false)
      toast.error("Brak ID wybranej wycieczki")
      return
    }

    // Jeśli dane są już załadowane w cache, użyj ich
    if (tripFullData && tripFullData.id === selectedTrip.id) {
      const trip = tripFullData
      setTitle(trip.title || "")
      setDescription(trip.description || "")
      setStartDate(
        trip.start_date
          ? new Date(trip.start_date).toISOString().split("T")[0]
          : ""
      )
      setEndDate(
        trip.end_date
          ? new Date(trip.end_date).toISOString().split("T")[0]
          : ""
      )
      setPrice(
        typeof trip.price_cents === "number"
          ? (trip.price_cents / 100).toFixed(2)
          : ""
      )
      setSeatsTotal(
        typeof trip.seats_total === "number" ? String(trip.seats_total) : ""
      )
      setLocation(trip.location || "")
      setPaymentReminderEnabled(
        typeof trip.payment_reminder_enabled === "boolean"
          ? trip.payment_reminder_enabled
          : false
      )
      setPaymentReminderDaysBefore(
        typeof trip.payment_reminder_days_before === "number"
          ? String(trip.payment_reminder_days_before)
          : ""
      )
      // Załaduj harmonogram płatności
      if (trip.payment_schedule && Array.isArray(trip.payment_schedule)) {
        setPaymentSchedule(trip.payment_schedule)
      } else {
        // Fallback: utwórz harmonogram z starych danych lub domyślny
        const firstPercent = trip.payment_split_first_percent ?? 30
        const secondPercent = trip.payment_split_second_percent ?? 70
        const defaultDate1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
        const defaultDate2 = trip.start_date
          ? new Date(
              new Date(trip.start_date).getTime() - 14 * 24 * 60 * 60 * 1000
            )
              .toISOString()
              .split("T")[0]
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0]
        setPaymentSchedule([
          {
            installment_number: 1,
            percent: firstPercent,
            due_date: defaultDate1,
          },
          {
            installment_number: 2,
            percent: secondPercent,
            due_date: defaultDate2,
          },
        ])
      }
      setLoading(false)
    } else if (isLoadingTripData) {
      // Czekaj na załadowanie danych
      setLoading(true)
      return
    }

    // Wczytaj koordynatorów (to nie jest cache'owane, więc zawsze fetch)
    const loadCoordinators = async () => {
      try {
        setLoadingCoordinators(true)
        const [assignedRes, allRes] = await Promise.all([
          fetch(`/api/trips/${selectedTrip.id}/coordinators`),
          fetch(`/api/coordinators`),
        ])

        if (assignedRes.ok) {
          const assigned = await assignedRes.json()
          setCoordinators(assigned)
        }

        if (allRes.ok) {
          const all = await allRes.json()
          setAvailableCoordinators(all)
        }
      } catch {
        toast.error("Nie udało się wczytać koordynatorów")
      } finally {
        setLoadingCoordinators(false)
      }
    }

    void loadCoordinators()
  }, [selectedTrip, tripFullData, isLoadingTripData])

  const handleSave = async () => {
    if (!selectedTrip) return

    try {
      setSaving(true)
      const priceNumber =
        price.trim() === "" ? null : Math.round(parseFloat(price) * 100)
      const seatsNumber =
        seatsTotal.trim() === "" ? null : parseInt(seatsTotal, 10)

      // Walidacja harmonogramu płatności
      const totalPercent = paymentSchedule.reduce(
        (sum, item) => sum + item.percent,
        0
      )
      if (totalPercent !== 100) {
        toast.error("Suma procentów w harmonogramie musi równać się 100%")
        return
      }
      if (paymentSchedule.length === 0) {
        toast.error("Musisz dodać przynajmniej jedną ratę")
        return
      }

      const res = await fetch(`/api/trips/${selectedTrip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          start_date: startDate || null,
          end_date: endDate || null,
          price_cents: priceNumber,
          seats_total: seatsNumber,
          location: location || null,
          payment_schedule: paymentSchedule,
          payment_reminder_enabled: paymentReminderEnabled,
          payment_reminder_days_before: paymentReminderEnabled
            ? (paymentReminderDaysBefore.trim()
                ? parseInt(paymentReminderDaysBefore, 10)
                : null)
            : null,
        }),
      })

      if (!res.ok) {
        toast.error("Nie udało się zapisać zmian")
        return
      }

      // Invaliduj cache, żeby dane zostały przeładowane
      invalidateTripCache()
      toast.success("Informacje zostały zapisane")
    } catch (err) {
      toast.error("Nie udało się zapisać zmian")
    } finally {
      setSaving(false)
    }
  }

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
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Wczytywanie informacji o wycieczce...
      </div>
    )
  }

  const unassignedCoordinators = availableCoordinators.filter(
    (c) => !coordinators.some((assigned) => assigned.id === c.id)
  )

  const assignCoordinator = async () => {
    if (!selectedCoordinatorId || !selectedTrip) return

    try {
      const res = await fetch(`/api/trips/${selectedTrip.id}/coordinators`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinator_id: selectedCoordinatorId,
          action: "assign",
        }),
      })

      if (res.ok) {
        toast.success("Koordynator został przypisany")
        setSelectedCoordinatorId("")
        // odśwież listę przypisanych
        const assignedRes = await fetch(
          `/api/trips/${selectedTrip.id}/coordinators`
        )
        if (assignedRes.ok) {
          const assigned = await assignedRes.json()
          setCoordinators(assigned)
        }
      } else {
        toast.error("Nie udało się przypisać koordynatora")
      }
    } catch {
      toast.error("Błąd podczas przypisywania koordynatora")
    }
  }

  const unassignCoordinator = async (coordinatorId: string) => {
    if (!selectedTrip) return

    try {
      const res = await fetch(`/api/trips/${selectedTrip.id}/coordinators`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinator_id: coordinatorId,
          action: "unassign",
        }),
      })

      if (res.ok) {
        toast.success("Koordynator został odpięty")
        const assignedRes = await fetch(
          `/api/trips/${selectedTrip.id}/coordinators`
        )
        if (assignedRes.ok) {
          const assigned = await assignedRes.json()
          setCoordinators(assigned)
        }
      } else {
        toast.error("Nie udało się odpiąć koordynatora")
      }
    } catch {
      toast.error("Błąd podczas odpinania koordynatora")
    }
  }

  return (
    <div className="space-y-2">
          <Card className="p-3 space-y-2">
            <CardContent className="px-0 pb-0 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="grid gap-1">
                  <Label className="text-xs">Nazwa *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nazwa wycieczki"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs">Opis</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Opis wycieczki"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs">Data rozpoczęcia</Label>
                  <Input
                    type="date"
                    value={startDate || ""}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Data zakończenia</Label>
                  <Input
                    type="date"
                    value={endDate || ""}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs">Trasa/Kraj</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="np. Islandia"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs">Cena (PLN)</Label>
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Liczba miejsc</Label>
                  <Input
                    type="number"
                    value={seatsTotal}
                    onChange={(e) => setSeatsTotal(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs"
                  />
                </div>

                {/* Harmonogram płatności */}
                <div className="col-span-2 border rounded-md p-2">
                  <PaymentScheduleEditor
                    schedule={paymentSchedule}
                    onChange={setPaymentSchedule}
                    tripStartDate={startDate}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Checkbox
                      id="payment-reminder-enabled"
                      checked={paymentReminderEnabled}
                      onCheckedChange={(checked) =>
                        setPaymentReminderEnabled(Boolean(checked))
                      }
                      className="h-4 w-4"
                    />
                    <Label
                      htmlFor="payment-reminder-enabled"
                      className="text-xs cursor-pointer"
                    >
                      Automatyczne przypomnienia o płatności
                    </Label>
                  </div>
                  {paymentReminderEnabled && (
                    <div className="grid gap-1 mt-2">
                      <Label className="text-xs">
                        Dni przed wycieczką (wysyłka maila)
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={paymentReminderDaysBefore}
                        onChange={(e) =>
                          setPaymentReminderDaysBefore(e.target.value)
                        }
                        placeholder="np. 7"
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>

              <Separator className="my-2" />

              {/* Koordynatorzy */}
              <div className="space-y-1.5">
                <h2 className="text-xs font-semibold">Koordynatorzy</h2>

                {loadingCoordinators ? (
                  <div className="text-xs text-muted-foreground">
                    Ładowanie koordynatorów...
                  </div>
                ) : (
                  <>
                    {coordinators.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {coordinators.map((coordinator) => (
                          <Badge
                            key={coordinator.id}
                            variant="secondary"
                            className="text-[10px] px-2 py-0.5"
                          >
                            {coordinator.full_name || "Brak imienia i nazwiska"}
                            <button
                              onClick={() => unassignCoordinator(coordinator.id)}
                              className="ml-1.5 hover:bg-destructive/20 rounded-full p-0.5"
                              aria-label="Usuń koordynatora"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Brak przypisanych koordynatorów
                      </div>
                    )}

                    {unassignedCoordinators.length > 0 && (
                      <div className="flex gap-1.5 items-end w-1/2">
                        <div className="flex-1 grid gap-1">
                          <Label className="text-xs">Przypisz koordynatora</Label>
                          <Select
                            value={selectedCoordinatorId}
                            onValueChange={setSelectedCoordinatorId}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Wybierz koordynatora" />
                            </SelectTrigger>
                            <SelectContent>
                              {unassignedCoordinators.map((coordinator) => (
                                <SelectItem
                                  key={coordinator.id}
                                  value={coordinator.id}
                                >
                                  {coordinator.full_name ||
                                    "Brak imienia i nazwiska"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={assignCoordinator}
                          disabled={!selectedCoordinatorId}
                          size="sm"
                          className="h-8 text-xs"
                        >
                          Przypisz
                        </Button>
                      </div>
                    )}

                    {unassignedCoordinators.length === 0 &&
                      coordinators.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Wszyscy dostępni koordynatorzy są już przypisani do tej
                          wycieczki
                        </div>
                      )}
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  size="sm"
                  className="h-8 text-xs"
                >
                  {saving ? "Zapisywanie..." : "Zapisz zmiany"}
                </Button>
              </div>
            </CardContent>
          </Card>
                </div>
  )
}


