"use client"

import { useEffect, useState } from "react"
import { useTrip } from "@/contexts/trip-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X } from "lucide-react"

const generateId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`

export default function TripFormPage() {
  const { selectedTrip, tripFullData, isLoadingTripData, invalidateTripCache } = useTrip()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [registrationMode, setRegistrationMode] = useState<
    "individual" | "company" | "both"
  >("both")
  const [showAdditionalServices, setShowAdditionalServices] = useState<boolean>(false)
  const [companyParticipantsInfo, setCompanyParticipantsInfo] = useState<string>("")
  const [requiredParticipantFields, setRequiredParticipantFields] = useState<{
    pesel: boolean
    document: boolean
    gender: boolean
    phone: boolean
  }>({
    pesel: false,
    document: false,
    gender: false,
    phone: false,
  })
  const [additionalAttractions, setAdditionalAttractions] = useState<
    { 
      id: string; 
      title: string; 
      description: string; 
      price_cents: number | null;
      include_in_contract?: boolean;
      currency?: "PLN" | "EUR";
    }[]
  >([])
  const [diets, setDiets] = useState<
    { 
      id: string; 
      title: string; 
      description: string; 
      price_cents: number | null;
      variants?: { id: string; title: string; price_cents: number | null }[];
    }[]
  >([])
  const [extraInsurances, setExtraInsurances] = useState<
    { 
      id: string; 
      title: string; 
      description: string; 
      owu_url: string;
      variants?: { id: string; title: string; price_cents: number | null }[];
    }[]
  >([])

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
      setRegistrationMode(
        trip.registration_mode === "individual" ||
          trip.registration_mode === "company"
          ? trip.registration_mode
          : "both"
      )
      setShowAdditionalServices(
        typeof trip.form_show_additional_services === "boolean" 
          ? trip.form_show_additional_services 
          : false
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
      setRequiredParticipantFields(
        trip.form_required_participant_fields &&
        typeof trip.form_required_participant_fields === "object" &&
        !Array.isArray(trip.form_required_participant_fields)
          ? {
              pesel: Boolean(
                (trip.form_required_participant_fields as { pesel?: boolean })
                  .pesel
              ),
              document: Boolean(
                (trip.form_required_participant_fields as { document?: boolean })
                  .document
              ),
              gender: Boolean(
                (trip.form_required_participant_fields as { gender?: boolean })
                  .gender
              ),
              phone: Boolean(
                (trip.form_required_participant_fields as { phone?: boolean })
                  .phone
              ),
            }
          : {
              pesel: false,
              document: false,
              gender: false,
              phone: false,
            }
      )
      setLoading(false)
    } else if (isLoadingTripData) {
      // Czekaj na załadowanie danych
      setLoading(true)
      return
    }
  }, [selectedTrip, tripFullData, isLoadingTripData])

  const handleSave = async () => {
    if (!selectedTrip) return

    try {
      setSaving(true)

      const res = await fetch(`/api/trips/${selectedTrip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_mode: registrationMode,
          form_show_additional_services: showAdditionalServices,
          company_participants_info: companyParticipantsInfo || null,
          form_additional_attractions: additionalAttractions,
          form_diets: diets,
          form_extra_insurances: extraInsurances,
          form_required_participant_fields: requiredParticipantFields,
        }),
      })

      if (!res.ok) {
        toast.error("Nie udało się zapisać zmian")
        return
      }

      // Invaliduj cache, żeby dane zostały przeładowane
      invalidateTripCache()
      toast.success("Ustawienia formularza zostały zapisane")
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
        Wczytywanie ustawień formularza...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Card className="p-3 space-y-2">
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
          </div>

          {(registrationMode === "individual" || registrationMode === "both") && (
            <div className="grid gap-2 mt-4 border rounded-md p-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Wymagane pola uczestników
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Wybierz które pola są obowiązkowe w formularzu rezerwacji dla uczestników. Imię i nazwisko są zawsze wymagane.
                </p>
              </div>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between rounded-lg border p-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium cursor-pointer">
                      PESEL
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Numer PESEL uczestnika
                    </p>
                  </div>
                  <Switch
                    checked={requiredParticipantFields.pesel}
                    onCheckedChange={(checked) =>
                      setRequiredParticipantFields((prev) => ({
                        ...prev,
                        pesel: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium cursor-pointer">
                      Dokument tożsamości / Paszport
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Typ dokumentu i numer
                    </p>
                  </div>
                  <Switch
                    checked={requiredParticipantFields.document}
                    onCheckedChange={(checked) =>
                      setRequiredParticipantFields((prev) => ({
                        ...prev,
                        document: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium cursor-pointer">
                      Płeć
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Płeć uczestnika
                    </p>
                  </div>
                  <Switch
                    checked={requiredParticipantFields.gender}
                    onCheckedChange={(checked) =>
                      setRequiredParticipantFields((prev) => ({
                        ...prev,
                        gender: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium cursor-pointer">
                      Telefon
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Numer telefonu uczestnika
                    </p>
                  </div>
                  <Switch
                    checked={requiredParticipantFields.phone}
                    onCheckedChange={(checked) =>
                      setRequiredParticipantFields((prev) => ({
                        ...prev,
                        phone: checked,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="grid gap-1 mt-4">
            <Label className="text-xs">Krok usługi dodatkowe</Label>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer">
                  Pokaż krok "Usługi dodatkowe" w formularzu
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Jeśli włączone, w formularzu pojawi się krok umożliwiający wybór usług dodatkowych dla uczestników
                </p>
              </div>
              <Switch
                checked={showAdditionalServices}
                onCheckedChange={setShowAdditionalServices}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="h-8 text-xs"
            >
              {saving ? "Zapisywanie..." : "Zapisz zmiany"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {registrationMode !== "individual" && (
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
            <div className="flex justify-end gap-2 pt-1">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="h-8 text-xs"
              >
                {saving ? "Zapisywanie..." : "Zapisz zmiany"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showAdditionalServices && (
        <>
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
                <span className="font-semibold"> Tak / Nie</span>. Atrakcje w EUR nie są wliczane do umowy.
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
                      <Label className="text-[11px]">Cena</Label>
                      <div className="flex gap-2">
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
                          className="h-8 text-xs flex-1"
                        />
                        <Select
                          value={item.currency || "PLN"}
                          onValueChange={(value: "PLN" | "EUR") => {
                            setAdditionalAttractions((prev) =>
                              prev.map((attraction, i) =>
                                i === index
                                  ? { ...attraction, currency: value }
                                  : attraction
                              )
                            )
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PLN">PLN</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        id={`include-in-contract-${index}`}
                        checked={item.include_in_contract ?? true}
                        onCheckedChange={(checked) =>
                          setAdditionalAttractions((prev) =>
                            prev.map((attraction, i) =>
                              i === index
                                ? { ...attraction, include_in_contract: Boolean(checked) }
                                : attraction
                            )
                          )
                        }
                        className="h-4 w-4"
                      />
                      <Label
                        htmlFor={`include-in-contract-${index}`}
                        className="text-[11px] cursor-pointer"
                      >
                        Wliczać do ceny w umowie (tylko dla PLN)
                      </Label>
                    </div>
                    {item.currency === "EUR" && (
                      <p className="text-[10px] text-muted-foreground">
                        Atrakcje w EUR nie są wliczane do umowy
                      </p>
                    )}
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
                        include_in_contract: true,
                        currency: "PLN",
                      },
                    ])
                  }
                >
                  Dodaj atrakcję
                </Button>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="sm"
                  className="h-8 text-xs"
                >
                  {saving ? "Zapisywanie..." : "Zapisz zmiany"}
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
                    {(!item.variants || item.variants.length === 0) && (
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
                        <p className="text-[10px] text-muted-foreground">
                          Jeśli dieta ma warianty, użyj sekcji poniżej zamiast tego pola.
                        </p>
                      </div>
                    )}
                    <div className="border-t pt-2 mt-2">
                      <Label className="text-[11px] font-semibold">Warianty diety (opcjonalne)</Label>
                      <p className="text-[10px] text-muted-foreground mb-2">
                        Jeśli dieta ma kilka wariantów (np. wegetariańska bezpłatna, wegańska odpłatna), dodaj je tutaj. Jeśli nie ma wariantów, zostaw puste i ustaw cenę powyżej.
                      </p>
                      <div className="space-y-2">
                        {(item.variants || []).map((variant, variantIndex) => (
                          <div key={variant.id || variantIndex} className="flex gap-2 items-end border rounded p-1.5">
                            <div className="flex-1 grid gap-1">
                              <Label className="text-[10px]">Nazwa wariantu</Label>
                              <Input
                                value={variant.title}
                                onChange={(e) => {
                                  const value = e.target.value
                                  setDiets((prev) =>
                                    prev.map((diet, i) =>
                                      i === index
                                        ? {
                                            ...diet,
                                            variants: (diet.variants || []).map((v, vi) =>
                                              vi === variantIndex ? { ...v, title: value } : v
                                            ),
                                          }
                                        : diet
                                    )
                                  )
                                }}
                                className="h-7 text-xs"
                                placeholder="np. Wegetariańska"
                              />
                            </div>
                            <div className="w-24 grid gap-1">
                              <Label className="text-[10px]">Cena (PLN)</Label>
                              <Input
                                type="number"
                                value={
                                  variant.price_cents != null
                                    ? (variant.price_cents / 100).toFixed(2)
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
                                        ? {
                                            ...diet,
                                            variants: (diet.variants || []).map((v, vi) =>
                                              vi === variantIndex ? { ...v, price_cents: cents } : v
                                            ),
                                          }
                                        : diet
                                    )
                                  )
                                }}
                                className="h-7 text-xs"
                                placeholder="0.00"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() =>
                                setDiets((prev) =>
                                  prev.map((diet, i) =>
                                    i === index
                                      ? {
                                          ...diet,
                                          variants: (diet.variants || []).filter((_, vi) => vi !== variantIndex),
                                        }
                                      : diet
                                  )
                                )
                              }
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const newVariant = {
                              id: generateId(),
                              title: "",
                              price_cents: null,
                            }
                            setDiets((prev) =>
                              prev.map((diet, i) =>
                                i === index
                                  ? {
                                      ...diet,
                                      variants: [...(diet.variants || []), newVariant],
                                    }
                                  : diet
                              )
                            )
                          }}
                        >
                          Dodaj wariant
                        </Button>
                      </div>
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
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="sm"
                  className="h-8 text-xs"
                >
                  {saving ? "Zapisywanie..." : "Zapisz zmiany"}
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
                    <div className="border-t pt-2 mt-2">
                      <Label className="text-[11px] font-semibold">Warianty ubezpieczenia (opcjonalne)</Label>
                      <p className="text-[10px] text-muted-foreground mb-2">
                        Jeśli ubezpieczenie ma kilka wariantów, dodaj je tutaj. Jeśli nie, uczestnik wybierze tylko Tak/Nie.
                      </p>
                      <div className="space-y-2">
                        {(item.variants || []).map((variant, variantIndex) => (
                          <div key={variant.id || variantIndex} className="flex gap-2 items-end border rounded p-1.5">
                            <div className="flex-1 grid gap-1">
                              <Label className="text-[10px]">Nazwa wariantu</Label>
                              <Input
                                value={variant.title}
                                onChange={(e) => {
                                  const value = e.target.value
                                  setExtraInsurances((prev) =>
                                    prev.map((insurance, i) =>
                                      i === index
                                        ? {
                                            ...insurance,
                                            variants: (insurance.variants || []).map((v, vi) =>
                                              vi === variantIndex ? { ...v, title: value } : v
                                            ),
                                          }
                                        : insurance
                                    )
                                  )
                                }}
                                className="h-7 text-xs"
                                placeholder="np. Podstawowy"
                              />
                            </div>
                            <div className="w-24 grid gap-1">
                              <Label className="text-[10px]">Cena (PLN)</Label>
                              <Input
                                type="number"
                                value={
                                  variant.price_cents != null
                                    ? (variant.price_cents / 100).toFixed(2)
                                    : ""
                                }
                                onChange={(e) => {
                                  const value = e.target.value
                                  const cents =
                                    value.trim() === ""
                                      ? null
                                      : Math.round(parseFloat(value) * 100)
                                  setExtraInsurances((prev) =>
                                    prev.map((insurance, i) =>
                                      i === index
                                        ? {
                                            ...insurance,
                                            variants: (insurance.variants || []).map((v, vi) =>
                                              vi === variantIndex ? { ...v, price_cents: cents } : v
                                            ),
                                          }
                                        : insurance
                                    )
                                  )
                                }}
                                className="h-7 text-xs"
                                placeholder="0.00"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() =>
                                setExtraInsurances((prev) =>
                                  prev.map((insurance, i) =>
                                    i === index
                                      ? {
                                          ...insurance,
                                          variants: (insurance.variants || []).filter((_, vi) => vi !== variantIndex),
                                        }
                                      : insurance
                                  )
                                )
                              }
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const newVariant = {
                              id: generateId(),
                              title: "",
                              price_cents: null,
                            }
                            setExtraInsurances((prev) =>
                              prev.map((insurance, i) =>
                                i === index
                                  ? {
                                      ...insurance,
                                      variants: [...(insurance.variants || []), newVariant],
                                    }
                                  : insurance
                              )
                            )
                          }}
                        >
                          Dodaj wariant
                        </Button>
                      </div>
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
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="sm"
                  className="h-8 text-xs"
                >
                  {saving ? "Zapisywanie..." : "Zapisz zmiany"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
