"use client"

import { useEffect, useState } from "react"
import { useTrip } from "@/contexts/trip-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X } from "lucide-react"

type Coordinator = {
  id: string
  full_name: string | null
}

const generateId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`

export default function TripGeneralInfoPage() {
  const { selectedTrip } = useTrip()

  // Debug: loguj selectedTrip
  useEffect(() => {
    console.log("SelectedTrip changed:", selectedTrip)
  }, [selectedTrip])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [price, setPrice] = useState("")
  const [seatsTotal, setSeatsTotal] = useState("")
  const [category, setCategory] = useState("")
  const [location, setLocation] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [publicSlug, setPublicSlug] = useState("")
  const [registrationMode, setRegistrationMode] = useState<
    "individual" | "company" | "both"
  >("both")
  const [requirePesel, setRequirePesel] = useState<boolean>(true)
  const [companyParticipantsInfo, setCompanyParticipantsInfo] = useState<string>("")
  const [additionalAttractions, setAdditionalAttractions] = useState<
    { id: string; title: string; description: string; price_cents: number | null }[]
  >([])
  const [diets, setDiets] = useState<
    { id: string; title: string; description: string; price_cents: number | null }[]
  >([])
  const [extraInsurances, setExtraInsurances] = useState<
    { id: string; title: string; description: string; owu_url: string }[]
  >([])

  const [coordinators, setCoordinators] = useState<Coordinator[]>([])
  const [availableCoordinators, setAvailableCoordinators] = useState<
    Coordinator[]
  >([])
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState("")
  const [loadingCoordinators, setLoadingCoordinators] = useState(true)

  useEffect(() => {
    if (!selectedTrip) {
      console.log("No selectedTrip, setting loading to false")
      setLoading(false)
      return
    }

    if (!selectedTrip.id) {
      console.error("SelectedTrip has no id:", selectedTrip)
      setLoading(false)
      toast.error("Brak ID wybranej wycieczki")
      return
    }

    console.log("Loading trip data for ID:", selectedTrip.id)

    const load = async () => {
      try {
        setLoading(true)
        const url = `/api/trips/${selectedTrip.id}`
        console.log("Fetching from:", url)
        const res = await fetch(url)
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          console.error("Error loading trip:", res.status, errorData)
          toast.error(`Nie udało się wczytać informacji o wycieczce (${res.status})`)
          setLoading(false)
          return
        }

        const trip = await res.json()
        console.log("Loaded trip data:", trip)
        
        if (!trip || !trip.id) {
          console.error("Invalid trip data received:", trip)
          toast.error("Otrzymano nieprawidłowe dane wycieczki")
          setLoading(false)
          return
        }
        setTitle(trip.title || "")
        setDescription(trip.description || "")
        // Formatuj daty dla input type="date" (wymaga formatu YYYY-MM-DD)
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
        setCategory(trip.category || "")
        setLocation(trip.location || "")
        setIsPublic(Boolean(trip.is_public))
        setPublicSlug(trip.public_slug || "")
        setRegistrationMode(
          trip.registration_mode === "individual" ||
            trip.registration_mode === "company"
            ? trip.registration_mode
            : "both"
        )
        setRequirePesel(
          typeof trip.require_pesel === "boolean" ? trip.require_pesel : true
        )
        setCompanyParticipantsInfo(
          trip.company_participants_info ||
            "Dane uczestników wyjazdu należy przekazać organizatorowi na adres mailowy: office@grupa-depl.com najpóźniej 7 dni przed wyjazdem. Lista zawierająca imię i nazwisko oraz datę urodzenia każdego uczestnika."
        )
        setAdditionalAttractions(
          Array.isArray(trip.form_additional_attractions)
            ? trip.form_additional_attractions
            : []
        )
        setDiets(
          Array.isArray(trip.form_diets) ? trip.form_diets : []
        )
        setExtraInsurances(
          Array.isArray(trip.form_extra_insurances)
            ? trip.form_extra_insurances
            : []
        )

        // Wczytaj koordynatorów
        try {
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
      } catch (err) {
        toast.error("Nie udało się wczytać informacji o wycieczce")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [selectedTrip])

  const handleSave = async () => {
    if (!selectedTrip) return

    try {
      setSaving(true)
      const priceNumber =
        price.trim() === "" ? null : Math.round(parseFloat(price) * 100)
      const seatsNumber =
        seatsTotal.trim() === "" ? null : parseInt(seatsTotal, 10)

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
          category: category || null,
          location: location || null,
          is_public: isPublic,
          public_slug: publicSlug || null,
          registration_mode: registrationMode,
          require_pesel: requirePesel,
          company_participants_info: companyParticipantsInfo || null,
          form_additional_attractions: additionalAttractions,
          form_diets: diets,
          form_extra_insurances: extraInsurances,
        }),
      })

      if (!res.ok) {
        toast.error("Nie udało się zapisać zmian")
        return
      }

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

  const effectivePublicSlug = publicSlug || selectedTrip.slug

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
      <Tabs defaultValue="general" className="space-y-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general" className="text-xs">
            Informacje ogólne wycieczka
          </TabsTrigger>
          <TabsTrigger value="form" className="text-xs">
            Formularz
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-2">
          <Card className="p-3 space-y-2">
            <CardHeader className="px-0 pt-0 pb-1">
              <CardTitle className="text-sm font-semibold">
                Informacje ogólne o wycieczce
              </CardTitle>
            </CardHeader>
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
                  <Label className="text-xs">Kategoria</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="np. Wycieczki górskie"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Miejsce</Label>
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
        </TabsContent>

        <TabsContent value="form" className="space-y-2">
          <Card className="p-3 space-y-2">
            <CardHeader className="px-0 pt-0 pb-1">
              <CardTitle className="text-sm font-semibold">
                Ustawienia formularza zgłoszeń
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="grid gap-1">
                  <Label className="text-xs">Dostępne ścieżki zgłoszenia</Label>
                  <Select
                    value={registrationMode}
                    onValueChange={(value: "individual" | "company" | "both") =>
                      setRegistrationMode(value)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Wybierz typ zgłoszenia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">
                        Tylko Osoba Fizyczna
                      </SelectItem>
                      <SelectItem value="company">Tylko Firma</SelectItem>
                      <SelectItem value="both">
                        Obie opcje dostępne (wybór użytkownika)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs">PESEL uczestników</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="require-pesel"
                      checked={requirePesel}
                      onCheckedChange={(checked) =>
                        setRequirePesel(Boolean(checked))
                      }
                      className="h-4 w-4"
                    />
                    <Label
                      htmlFor="require-pesel"
                      className="text-xs cursor-pointer"
                    >
                      PESEL jest wymagany w formularzu uczestników
                    </Label>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Wyłączenie tej opcji spowoduje, że PESEL będzie polem
                    opcjonalnym.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="p-3 space-y-2">
            <CardHeader className="px-0 pt-0 pb-1">
              <CardTitle className="text-sm font-semibold">
                Uczestnicy – zgłoszenia firmowe
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Ten komunikat będzie wyświetlany w formularzu rezerwacji, gdy
                zgłoszenie jest składane jako firma. Zastępuje on formularz
                dodawania uczestników.
              </p>
              <div className="grid gap-1">
                <Label className="text-xs">Treść komunikatu dla firm</Label>
                <Textarea
                  value={companyParticipantsInfo}
                  onChange={(e) => setCompanyParticipantsInfo(e.target.value)}
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="p-3 space-y-2 mt-2">
            <CardHeader className="px-0 pt-0 pb-1">
              <CardTitle className="text-sm font-semibold">
                Dodatkowe atrakcje
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Zdefiniuj opcjonalne atrakcje dostępne w formularzu. Każda może
                mieć tytuł, opis i cenę. W formularzu klient będzie mógł wybrać
                <span className="font-semibold"> Tak / Nie</span>.
              </p>
              <div className="space-y-2">
                {additionalAttractions.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="border rounded-md p-2 space-y-1 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs">
                        Atrakcja {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        onClick={() =>
                          setAdditionalAttractions((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                      >
                        Usuń
                      </Button>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Tytuł</Label>
                      <Input
                        value={item.title}
                        onChange={(e) => {
                          const value = e.target.value
                          setAdditionalAttractions((prev) =>
                            prev.map((attraction, i) =>
                              i === index
                                ? { ...attraction, title: value }
                                : attraction
                            )
                          )
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Opis</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) => {
                          const value = e.target.value
                          setAdditionalAttractions((prev) =>
                            prev.map((attraction, i) =>
                              i === index
                                ? { ...attraction, description: value }
                                : attraction
                            )
                          )
                        }}
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Cena (PLN)</Label>
                      <Input
                        type="number"
                        value={
                          item.price_cents != null
                            ? (item.price_cents / 100).toFixed(2)
                            : ""
                        }
                        onChange={(e) => {
                          const value = e.target.value
                          const cents =
                            value.trim() === ""
                              ? null
                              : Math.round(parseFloat(value) * 100)
                          setAdditionalAttractions((prev) =>
                            prev.map((attraction, i) =>
                              i === index
                                ? { ...attraction, price_cents: cents }
                                : attraction
                            )
                          )
                        }}
                        placeholder="0.00"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    setAdditionalAttractions((prev) => [
                      ...prev,
                      {
                        id: generateId(),
                        title: "",
                        description: "",
                        price_cents: null,
                      },
                    ])
                  }
                >
                  Dodaj atrakcję
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="p-3 space-y-2 mt-2">
            <CardHeader className="px-0 pt-0 pb-1">
              <CardTitle className="text-sm font-semibold">Diety</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Zdefiniuj dostępne warianty diety. Klient wybierze jedną z listy.
                Domyślnie diety są darmowe, ale możesz przypisać cenę, która
                doliczy się do faktury.
              </p>
              <div className="space-y-2">
                {diets.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="border rounded-md p-2 space-y-1 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs">
                        Dieta {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        onClick={() =>
                          setDiets((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        Usuń
                      </Button>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Tytuł</Label>
                      <Input
                        value={item.title}
                        onChange={(e) => {
                          const value = e.target.value
                          setDiets((prev) =>
                            prev.map((diet, i) =>
                              i === index ? { ...diet, title: value } : diet
                            )
                          )
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Opis</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) => {
                          const value = e.target.value
                          setDiets((prev) =>
                            prev.map((diet, i) =>
                              i === index
                                ? { ...diet, description: value }
                                : diet
                            )
                          )
                        }}
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Cena (PLN)</Label>
                      <Input
                        type="number"
                        value={
                          item.price_cents != null
                            ? (item.price_cents / 100).toFixed(2)
                            : ""
                        }
                        onChange={(e) => {
                          const value = e.target.value
                          const cents =
                            value.trim() === ""
                              ? null
                              : Math.round(parseFloat(value) * 100)
                          setDiets((prev) =>
                            prev.map((diet, i) =>
                              i === index
                                ? { ...diet, price_cents: cents }
                                : diet
                            )
                          )
                        }}
                        placeholder="0.00"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    setDiets((prev) => [
                      ...prev,
                      {
                        id: generateId(),
                        title: "",
                        description: "",
                        price_cents: null,
                      },
                    ])
                  }
                >
                  Dodaj dietę
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="p-3 space-y-2 mt-2">
            <CardHeader className="px-0 pt-0 pb-1">
              <CardTitle className="text-sm font-semibold">
                Ubezpieczenia dodatkowe
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Zdefiniuj dodatkowe ubezpieczenia. Każde ma tytuł, opis i link do
                OWU organizatora. W formularzu klient będzie mógł zaznaczyć
                checkbox <span className="font-semibold">Tak</span>.
              </p>
              <div className="space-y-2">
                {extraInsurances.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="border rounded-md p-2 space-y-1 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs">
                        Ubezpieczenie {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        onClick={() =>
                          setExtraInsurances((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                      >
                        Usuń
                      </Button>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Tytuł</Label>
                      <Input
                        value={item.title}
                        onChange={(e) => {
                          const value = e.target.value
                          setExtraInsurances((prev) =>
                            prev.map((insurance, i) =>
                              i === index
                                ? { ...insurance, title: value }
                                : insurance
                            )
                          )
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Opis</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) => {
                          const value = e.target.value
                          setExtraInsurances((prev) =>
                            prev.map((insurance, i) =>
                              i === index
                                ? { ...insurance, description: value }
                                : insurance
                            )
                          )
                        }}
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Link do OWU</Label>
                      <Input
                        value={item.owu_url}
                        onChange={(e) => {
                          const value = e.target.value
                          setExtraInsurances((prev) =>
                            prev.map((insurance, i) =>
                              i === index
                                ? { ...insurance, owu_url: value }
                                : insurance
                            )
                          )
                        }}
                        placeholder="https://..."
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    setExtraInsurances((prev) => [
                      ...prev,
                      {
                        id: generateId(),
                        title: "",
                        description: "",
                        owu_url: "",
                      },
                    ])
                  }
                >
                  Dodaj ubezpieczenie
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


