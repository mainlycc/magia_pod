"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { TripCreationProgress } from "@/components/trip-creation-progress"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor"
import { PaymentScheduleItem } from "@/contexts/trip-context"

type Coordinator = {
  id: string
  full_name: string | null
}

export default function DodajWycieczkePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [tripTitle, setTripTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [price, setPrice] = useState("")
  const [seats, setSeats] = useState("")
  const [location, setLocation] = useState("")
  const [paymentReminderEnabled, setPaymentReminderEnabled] = useState(false)
  const [paymentReminderDaysBefore, setPaymentReminderDaysBefore] = useState("")
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [publicSlug, setPublicSlug] = useState("")

  const [coordinators, setCoordinators] = useState<Coordinator[]>([])
  const [availableCoordinators, setAvailableCoordinators] = useState<Coordinator[]>([])
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState("")
  const [loadingCoordinators, setLoadingCoordinators] = useState(true)

  const effectivePublicSlug = isPublic ? publicSlug : ""

  // Wczytaj dane z localStorage jeśli istnieją (gdy użytkownik wraca)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedData = localStorage.getItem("tripCreation_step1")
      if (savedData) {
        try {
          const data = JSON.parse(savedData)
          setTripTitle(data.tripTitle || "")
          setDescription(data.description || "")
          setStartDate(data.startDate || "")
          setEndDate(data.endDate || "")
          setPrice(data.price || "")
          setSeats(data.seats || "")
          setLocation(data.location || "")
          setIsPublic(data.isPublic || false)
          setPublicSlug(data.publicSlug || "")
          setPaymentReminderEnabled(data.paymentReminderEnabled || false)
          setPaymentReminderDaysBefore(data.paymentReminderDaysBefore || "")
          if (data.paymentSchedule && Array.isArray(data.paymentSchedule)) {
            setPaymentSchedule(data.paymentSchedule)
          } else {
            // Domyślny harmonogram: 2 raty
            const defaultDate1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0]
            const defaultDate2 = data.startDate
              ? new Date(
                  new Date(data.startDate).getTime() - 14 * 24 * 60 * 60 * 1000
                )
                  .toISOString()
                  .split("T")[0]
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0]
            setPaymentSchedule([
              {
                installment_number: 1,
                percent: 30,
                due_date: defaultDate1,
              },
              {
                installment_number: 2,
                percent: 70,
                due_date: defaultDate2,
              },
            ])
          }
        } catch (e) {
          console.error("Error loading saved data:", e)
        }
      } else {
        // Domyślny harmonogram jeśli brak zapisanych danych
        const defaultDate1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
        const defaultDate2 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
        setPaymentSchedule([
          {
            installment_number: 1,
            percent: 30,
            due_date: defaultDate1,
          },
          {
            installment_number: 2,
            percent: 70,
            due_date: defaultDate2,
          },
        ])
      }
    }
  }, [])

  // Wczytaj koordynatorów
  useEffect(() => {
    const loadCoordinators = async () => {
      try {
        setLoadingCoordinators(true)
        const res = await fetch("/api/coordinators")
        if (res.ok) {
          const data = await res.json()
          setAvailableCoordinators(data)
        }
      } catch {
        toast.error("Nie udało się wczytać koordynatorów")
      } finally {
        setLoadingCoordinators(false)
      }
    }
    void loadCoordinators()
  }, [])

  const assignCoordinator = async () => {
    if (!selectedCoordinatorId) return

    try {
      const coordinator = availableCoordinators.find((c) => c.id === selectedCoordinatorId)
      if (coordinator) {
        setCoordinators([...coordinators, coordinator])
        setSelectedCoordinatorId("")
        toast.success("Koordynator został dodany")
      }
    } catch {
      toast.error("Nie udało się dodać koordynatora")
    }
  }

  const unassignCoordinator = (coordinatorId: string) => {
    setCoordinators(coordinators.filter((c) => c.id !== coordinatorId))
    toast.success("Koordynator został usunięty")
  }

  const handleSave = async () => {
    if (!tripTitle) {
      toast.error("Tytuł jest wymagany")
      return
    }

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

    try {
      setSaving(true)

      // Zapisz tylko podstawowe informacje do localStorage
      const step1Data = {
        tripTitle,
        description,
        startDate,
        endDate,
        price,
        seats,
        location,
        isPublic,
        publicSlug,
        paymentSchedule,
        paymentReminderEnabled,
        paymentReminderDaysBefore,
        coordinatorIds: coordinators.map((c) => c.id),
      }

      localStorage.setItem("tripCreation_step1", JSON.stringify(step1Data))
      toast.success("Dane zostały zapisane")
      
      // Przekieruj do następnego kroku
      router.push("/trip-dashboard/publiczny-wyglad?mode=create")
    } catch (err) {
      toast.error("Nie udało się zapisać danych")
      setSaving(false)
    }
  }

  const unassignedCoordinators = availableCoordinators.filter(
    (c) => !coordinators.some((assigned) => assigned.id === c.id)
  )

  return (
    <div className="space-y-2">
      <TripCreationProgress currentStep={1} />
      <Card className="p-3 space-y-2">
        <CardContent className="px-0 pb-0 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="grid gap-1">
              <Label className="text-xs">Nazwa *</Label>
              <Input
                value={tripTitle}
                onChange={(e) => setTripTitle(e.target.value)}
                placeholder="Nazwa wycieczki"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">Opis</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opis wycieczki"
                rows={2}
                className="text-xs resize-none"
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
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
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

            <div className="grid gap-1">
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="is-public"
                  checked={isPublic}
                  onCheckedChange={(checked) => setIsPublic(Boolean(checked))}
                  className="h-4 w-4"
                />
                <Label
                  htmlFor="is-public"
                  className="text-xs cursor-pointer"
                >
                  Publiczna strona wycieczki
                </Label>
              </div>
              {isPublic && (
                <div className="grid gap-1 pl-6">
                  <Input
                    placeholder="np. magicka-wycieczka-wlochy"
                    value={publicSlug}
                    onChange={(e) => setPublicSlug(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    URL:{" "}
                    <span className="font-mono">
                      /trip/{effectivePublicSlug || "twoj-slug"}
                    </span>
                  </p>
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
                  <div className="flex gap-1.5 items-end">
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
            <Button variant="outline" onClick={() => router.back()}>
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !tripTitle.trim()}
              size="sm"
              className="h-8 text-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                "Zapisz i przejdź dalej"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
