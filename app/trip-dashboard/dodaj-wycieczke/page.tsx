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

type Coordinator = {
  id: string
  full_name: string | null
}

export default function DodajWycieczkePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [tripTitle, setTripTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [price, setPrice] = useState("")
  const [seats, setSeats] = useState("")
  const [category, setCategory] = useState("")
  const [location, setLocation] = useState("")
  const [paymentSplitEnabled, setPaymentSplitEnabled] = useState(true)
  const [paymentSplitFirstPercent, setPaymentSplitFirstPercent] = useState("30")
  const [paymentSplitSecondPercent, setPaymentSplitSecondPercent] = useState("70")
  const [paymentReminderEnabled, setPaymentReminderEnabled] = useState(false)
  const [paymentReminderDaysBefore, setPaymentReminderDaysBefore] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [publicSlug, setPublicSlug] = useState("")

  const [coordinators, setCoordinators] = useState<Coordinator[]>([])
  const [availableCoordinators, setAvailableCoordinators] = useState<Coordinator[]>([])
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState("")
  const [loadingCoordinators, setLoadingCoordinators] = useState(true)

  const effectivePublicSlug = isPublic ? (publicSlug || slug) : ""

  // Wczytaj dane z localStorage jeśli istnieją (gdy użytkownik wraca)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedData = localStorage.getItem("tripCreation_step1")
      if (savedData) {
        try {
          const data = JSON.parse(savedData)
          setTripTitle(data.tripTitle || "")
          setSlug(data.slug || "")
          setDescription(data.description || "")
          setStartDate(data.startDate || "")
          setEndDate(data.endDate || "")
          setPrice(data.price || "")
          setSeats(data.seats || "")
          setCategory(data.category || "")
          setLocation(data.location || "")
          setIsPublic(data.isPublic || false)
          setPublicSlug(data.publicSlug || "")
          setPaymentSplitEnabled(data.paymentSplitEnabled !== undefined ? data.paymentSplitEnabled : true)
          setPaymentSplitFirstPercent(data.paymentSplitFirstPercent || "30")
          setPaymentSplitSecondPercent(data.paymentSplitSecondPercent || "70")
          setPaymentReminderEnabled(data.paymentReminderEnabled || false)
          setPaymentReminderDaysBefore(data.paymentReminderDaysBefore || "")
        } catch (e) {
          console.error("Error loading saved data:", e)
        }
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
    if (!tripTitle || !slug) {
      toast.error("Tytuł i slug są wymagane")
      return
    }

    // Walidacja sumy procentów
    if (paymentSplitEnabled) {
      const firstPercent = parseInt(paymentSplitFirstPercent, 10)
      const secondPercent = parseInt(paymentSplitSecondPercent, 10)
      if (firstPercent + secondPercent !== 100) {
        toast.error("Suma procentów musi równać się 100%")
        return
      }
    }

    try {
      setSaving(true)

      // Zapisz tylko podstawowe informacje do localStorage
      const step1Data = {
        tripTitle,
        slug,
        description,
        startDate,
        endDate,
        price,
        seats,
        category,
        location,
        isPublic,
        publicSlug,
        paymentSplitEnabled,
        paymentSplitFirstPercent,
        paymentSplitSecondPercent,
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
              <Label className="text-xs">Slug *</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="np. magiczna-wycieczka-wlochy"
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
              <Label className="text-xs">Kategoria</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="np. Wycieczki górskie"
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
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                placeholder="0"
                className="h-8 text-xs"
              />
            </div>

            {/* Podział płatności */}
            <div className="col-span-2 grid gap-2 border rounded-md p-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="payment-split-enabled"
                  checked={paymentSplitEnabled}
                  onCheckedChange={(checked) =>
                    setPaymentSplitEnabled(Boolean(checked))
                  }
                  className="h-4 w-4"
                />
                <Label
                  htmlFor="payment-split-enabled"
                  className="text-xs cursor-pointer font-semibold"
                >
                  Płatność podzielona
                </Label>
              </div>
              {paymentSplitEnabled && (
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <div className="grid gap-1">
                    <Label className="text-xs">
                      Pierwsza płatność (zaliczka) %
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={paymentSplitFirstPercent}
                      onChange={(e) => {
                        setPaymentSplitFirstPercent(e.target.value)
                        // Automatycznie oblicz drugi procent
                        const first = parseInt(e.target.value, 10) || 0
                        if (first >= 0 && first <= 100) {
                          setPaymentSplitSecondPercent(String(100 - first))
                        }
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">
                      Druga płatność (reszta) %
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={paymentSplitSecondPercent}
                      onChange={(e) => {
                        setPaymentSplitSecondPercent(e.target.value)
                        // Automatycznie oblicz pierwszy procent
                        const second = parseInt(e.target.value, 10) || 0
                        if (second >= 0 && second <= 100) {
                          setPaymentSplitFirstPercent(String(100 - second))
                        }
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                  {parseInt(paymentSplitFirstPercent, 10) +
                    parseInt(paymentSplitSecondPercent, 10) !==
                    100 && (
                    <p className="col-span-2 text-[10px] text-destructive">
                      Suma procentów musi równać się 100%
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 pl-6">
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
                <div className="grid gap-1 pl-12">
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
              disabled={saving || !tripTitle.trim() || !slug.trim()}
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
