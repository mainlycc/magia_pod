"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTrip } from "@/contexts/trip-context"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TripCreationProgress } from "@/components/trip-creation-progress"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { BasicSettingsSection } from "@/components/trip-form/sections/basic-settings-section"
import { CompanyParticipantsSection } from "@/components/trip-form/sections/company-participants-section"
import { AttractionsSection } from "@/components/trip-form/sections/attractions-section"
import { DietsSection } from "@/components/trip-form/sections/diets-section"
import { InsurancesSection } from "@/components/trip-form/sections/insurances-section"
import type {
  RegistrationMode,
  RequiredParticipantFields,
  AdditionalAttraction,
  Diet,
  ExtraInsurance,
} from "@/components/trip-form/types"

function TripFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isCreateMode = searchParams.get("mode") === "create"
  const { selectedTrip, tripFullData, tripContentData, isLoadingTripData, invalidateTripCache, setSelectedTrip, setTrips } = useTrip()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("both")
  const [showAdditionalServices, setShowAdditionalServices] = useState<boolean>(false)
  const [companyParticipantsInfo, setCompanyParticipantsInfo] = useState<string>("")
  const [requiredParticipantFields, setRequiredParticipantFields] = useState<RequiredParticipantFields>({
    pesel: false,
    document: false,
    gender: false,
    phone: false,
  })
  const [additionalAttractions, setAdditionalAttractions] = useState<AdditionalAttraction[]>([])
  const [expandedAttractions, setExpandedAttractions] = useState<Set<string>>(new Set())
  const [diets, setDiets] = useState<Diet[]>([])
  const [expandedDiets, setExpandedDiets] = useState<Set<string>>(new Set())
  const [extraInsurances, setExtraInsurances] = useState<ExtraInsurance[]>([])
  const [expandedInsurances, setExpandedInsurances] = useState<Set<string>>(new Set())
  const [reservationInfoText, setReservationInfoText] = useState<string>("")

  // W trybie tworzenia sprawdź czy są dane z kroku 1 i 2
  useEffect(() => {
    if (isCreateMode) {
      if (typeof window !== "undefined") {
        const step1Data = localStorage.getItem("tripCreation_step1")
        const step2Data = localStorage.getItem("tripCreation_step2")
        
        if (!step1Data) {
          toast.error("Najpierw uzupełnij informacje ogólne")
          router.push("/trip-dashboard/dodaj-wycieczke")
          return
        }
        
        if (!step2Data) {
          toast.error("Najpierw uzupełnij publiczny wygląd")
          router.push("/trip-dashboard/publiczny-wyglad?mode=create")
          return
        }
      }
      setLoading(false)
      return
    }
  }, [isCreateMode, router])

  // Użyj cache'owanych danych z kontekstu (tylko w trybie edycji)
  useEffect(() => {
    if (isCreateMode) return
    
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
          ? trip.form_additional_attractions.map((item: any) => ({
              ...item,
              enabled: item.enabled !== undefined ? item.enabled : true,
            }))
          : []
      )
      setDiets(
        Array.isArray(trip.form_diets)
          ? trip.form_diets.map((item: any) => ({
              ...item,
              enabled: item.enabled !== undefined ? item.enabled : true,
            }))
          : []
      )
      setExtraInsurances(
        Array.isArray(trip.form_extra_insurances)
          ? trip.form_extra_insurances.map((item: any) => ({
              ...item,
              enabled: item.enabled !== undefined ? item.enabled : true,
            }))
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

      // Wczytaj tekst informacyjny o rezerwacji z treści wycieczki (content)
      if (tripContentData) {
        setReservationInfoText(tripContentData.reservation_info_text || "")
      } else {
        setReservationInfoText("")
      }

      setLoading(false)
    } else if (isLoadingTripData) {
      // Czekaj na załadowanie danych
      setLoading(true)
      return
    }
  }, [selectedTrip, tripFullData, tripContentData, isLoadingTripData, isCreateMode])

  const handleSave = async () => {
    if (isCreateMode) {
      // W trybie tworzenia utwórz wycieczkę z danymi z wszystkich trzech kroków
      try {
        setSaving(true)

        // Wczytaj dane z localStorage
        const step1DataStr = localStorage.getItem("tripCreation_step1")
        const step2DataStr = localStorage.getItem("tripCreation_step2")
        
        if (!step1DataStr || !step2DataStr) {
          toast.error("Brak danych z poprzednich kroków")
          setSaving(false)
          return
        }

        const step1Data = JSON.parse(step1DataStr)
        const step2Data = JSON.parse(step2DataStr)

        const effectivePublicSlug = step1Data.isPublic ? step1Data.publicSlug : ""

        // 1. Utwórz wycieczkę z danymi z kroku 1
        const tripRes = await fetch("/api/trips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: step1Data.tripTitle,
            description: step1Data.description || null,
            start_date: step1Data.startDate || null,
            end_date: step1Data.endDate || null,
            price_cents: step1Data.price ? Math.round(parseFloat(step1Data.price) * 100) : null,
            seats_total: step1Data.seats ? parseInt(step1Data.seats) : 0,
            is_active: true,
            is_public: step1Data.isPublic,
            public_slug: effectivePublicSlug || null,
            location: step1Data.location || null,
            payment_split_enabled: step1Data.paymentSplitEnabled !== undefined ? step1Data.paymentSplitEnabled : true,
            payment_split_first_percent: step1Data.paymentSplitEnabled
              ? parseInt(step1Data.paymentSplitFirstPercent || "30", 10)
              : null,
            payment_split_second_percent: step1Data.paymentSplitEnabled
              ? parseInt(step1Data.paymentSplitSecondPercent || "70", 10)
              : null,
            payment_reminder_enabled: step1Data.paymentReminderEnabled || false,
            payment_reminder_days_before: step1Data.paymentReminderEnabled
              ? (step1Data.paymentReminderDaysBefore?.trim()
                  ? parseInt(step1Data.paymentReminderDaysBefore, 10)
                  : null)
              : null,
            // Ustaw również wymaganie PESEL na podstawie konfiguracji pól uczestników
            require_pesel: requiredParticipantFields.pesel ?? false,
          }),
        })

        if (!tripRes.ok) {
          const errorData = await tripRes.json().catch(() => ({}))
          toast.error(errorData.error || "Nie udało się utworzyć wycieczki")
          setSaving(false)
          return
        }

        const tripData = await tripRes.json()
        const tripId = tripData.id

        // 2. Zaktualizuj treść wycieczki
        const contentRes = await fetch(`/api/trips/${tripId}/content`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            program_atrakcje: step2Data.programAtrakcje || "",
            dodatkowe_swiadczenia: step2Data.dodatkoweSwiadczenia || "",
            gallery_urls: step2Data.galleryUrls || [],
            intro_text: step2Data.introText || "",
            section_poznaj_title: step2Data.sectionPoznajTitle || "",
            section_poznaj_description: step2Data.sectionPoznajDescription || "",
            trip_info_text: step2Data.tripInfoText || "",
            baggage_text: step2Data.baggageText || "",
            weather_text: step2Data.weatherText || "",
            show_trip_info_card: step2Data.showTripInfoConfigCard ?? true,
            show_baggage_card: step2Data.showBaggageCard ?? true,
            show_weather_card: step2Data.showWeatherCard ?? true,
            show_seats_left: step2Data.showSeatsLeft || false,
            included_in_price_text: step2Data.includedInPriceText || "",
            additional_costs_text: step2Data.additionalCostsText || "",
            additional_service_text: step2Data.additionalServiceText || "",
            reservation_number: step2Data.reservationNumber || "",
            duration_text: step2Data.durationText || "",
            additional_fields: step2Data.additionalFieldSections || [],
            reservation_info_text: reservationInfoText || "",
          }),
        })

        if (!contentRes.ok) {
          toast.error("Wycieczka została utworzona, ale nie udało się zapisać treści")
        }

        // 3. Zaktualizuj ustawienia formularza
        const formRes = await fetch(`/api/trips/${tripId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registration_mode: registrationMode,
            form_show_additional_services: showAdditionalServices,
            company_participants_info: companyParticipantsInfo || null,
            form_additional_attractions: additionalAttractions,
            form_diets: diets,
            form_extra_insurances: extraInsurances,
            // Te pola sterują widocznością i wymaganiem danych uczestników oraz PESEL zgłaszającego
            form_required_participant_fields: requiredParticipantFields,
            require_pesel: requiredParticipantFields.pesel ?? false,
          }),
        })

        if (!formRes.ok) {
          toast.error("Wycieczka została utworzona, ale nie udało się zapisać ustawień formularza")
        }

        // 4. Przypisz koordynatorów z kroku 1
        if (step1Data.coordinatorIds && Array.isArray(step1Data.coordinatorIds) && step1Data.coordinatorIds.length > 0) {
          for (const coordinatorId of step1Data.coordinatorIds) {
            try {
              await fetch(`/api/trips/${tripId}/coordinators`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  coordinator_id: coordinatorId,
                  action: "assign",
                }),
              })
            } catch (err) {
              console.error("Error assigning coordinator:", err)
            }
          }
        }

        // 5. Wyczyść localStorage
        localStorage.removeItem("tripCreation_step1")
        localStorage.removeItem("tripCreation_step2")

        // 6. Odśwież listę wycieczek i ustaw nową wycieczkę jako wybraną
        const tripsRes = await fetch("/api/trips")
        if (tripsRes.ok) {
          const tripsData = await tripsRes.json()
          setTrips(tripsData)
          
          const newTrip = tripsData.find((t: { id: string }) => t.id === tripId)
          if (newTrip) {
            setSelectedTrip(newTrip)
          }
        }

        toast.success("Wycieczka została utworzona")
        router.push("/trip-dashboard")
      } catch (err) {
        toast.error("Nie udało się utworzyć wycieczki")
        setSaving(false)
      }
      return
    }

    // Tryb edycji - zapisz do API
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
          // Te pola sterują widocznością i wymaganiem danych uczestników oraz PESEL zgłaszającego
          form_required_participant_fields: requiredParticipantFields,
          require_pesel: requiredParticipantFields.pesel ?? false,
        }),
      })

      if (!res.ok) {
        toast.error("Nie udało się zapisać zmian")
        return
      }

      // Zapisz tekst informacyjny o rezerwacji w treści wycieczki
      try {
        const contentRes = await fetch(`/api/trips/${selectedTrip.id}/content`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservation_info_text: reservationInfoText || "",
          }),
        })

        if (!contentRes.ok) {
          toast.error("Nie udało się zapisać tekstu informacyjnego o rezerwacji")
        }
      } catch (err) {
        toast.error("Nie udało się zapisać tekstu informacyjnego o rezerwacji")
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

  if (!isCreateMode && !selectedTrip) {
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
      {isCreateMode && <TripCreationProgress currentStep={3} />}
      
      <BasicSettingsSection
        registrationMode={registrationMode}
        setRegistrationMode={setRegistrationMode}
        requiredParticipantFields={requiredParticipantFields}
        setRequiredParticipantFields={setRequiredParticipantFields}
        showAdditionalServices={showAdditionalServices}
        setShowAdditionalServices={setShowAdditionalServices}
      />

      <CompanyParticipantsSection
        companyParticipantsInfo={companyParticipantsInfo}
        setCompanyParticipantsInfo={setCompanyParticipantsInfo}
        registrationMode={registrationMode}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Komunikat w panelu rejestracji</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4 space-y-2">
          <Label htmlFor="reservation-info" className="text-xs font-semibold">
            Tekst informacyjny o rezerwacji
          </Label>
          <Textarea
            id="reservation-info"
            value={reservationInfoText}
            onChange={(e) => setReservationInfoText(e.target.value)}
            placeholder="Ten tekst pojawi się nad formularzem rezerwacji wycieczki na stronie dla klientów."
            className="min-h-[80px] text-xs"
          />
        </div>
      </Card>

      {showAdditionalServices && (
        <>
          <AttractionsSection
            attractions={additionalAttractions}
            setAttractions={setAdditionalAttractions}
            expandedIds={expandedAttractions}
            setExpandedIds={setExpandedAttractions}
          />

          <DietsSection
            diets={diets}
            setDiets={setDiets}
            expandedIds={expandedDiets}
            setExpandedIds={setExpandedDiets}
          />

          <InsurancesSection
            insurances={extraInsurances}
            setInsurances={setExtraInsurances}
            expandedIds={expandedInsurances}
            setExpandedIds={setExpandedInsurances}
          />
        </>
      )}

      {/* Globalny przycisk zapisu */}
      <div className="flex justify-end gap-2 pt-4 pb-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="h-8 text-xs"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isCreateMode ? "Tworzenie wycieczki..." : "Zapisywanie..."}
            </>
          ) : isCreateMode ? (
            "Utwórz wycieczkę"
          ) : (
            "Zapisz zmiany"
          )}
        </Button>
      </div>
    </div>
  )
}

export default function TripFormPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Wczytywanie...
      </div>
    }>
      <TripFormContent />
    </Suspense>
  )
}
