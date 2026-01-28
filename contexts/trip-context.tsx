"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"

type Trip = {
  id: string
  title: string
  slug: string
  start_date: string | null
  end_date: string | null
}

// Pełne dane wycieczki z API
type TripFullData = {
  id: string
  title: string
  slug: string
  description: string | null
  start_date: string | null
  end_date: string | null
  price_cents: number | null
  seats_total: number | null
  seats_reserved: number | null
  is_active: boolean | null
  category: string | null
  location: string | null
  is_public: boolean | null
  public_slug: string | null
  registration_mode: string | null
  require_pesel: boolean | null
  form_show_additional_services: boolean | null
  company_participants_info: string | null
  form_additional_attractions: unknown
  form_diets: unknown
  form_extra_insurances: unknown
  form_required_participant_fields: unknown
  payment_split_enabled: boolean | null
  payment_split_first_percent: number | null
  payment_split_second_percent: number | null
  payment_reminder_enabled: boolean | null
  payment_reminder_days_before: number | null
}

// Dane content wycieczki
type TripContentData = {
  program_atrakcje: string
  dodatkowe_swiadczenia: string
  gallery_urls: string[]
  intro_text: string
  section_poznaj_title: string
  section_poznaj_description: string
  reservation_info_text: string
  trip_info_text: string
  baggage_text: string
  weather_text: string
  show_weather_card: boolean
  show_seats_left: boolean
  included_in_price_text: string
  additional_costs_text: string
  additional_service_text: string
  reservation_number: string
  duration_text: string
  additional_fields: Array<{ 
    id: string
    sectionTitle: string
    fields: Array<{ title: string; value: string }>
  }>
  public_middle_sections: string[] | null
  public_right_sections: string[] | null
  public_hidden_middle_sections: string[] | null
  public_hidden_right_sections: string[] | null
  public_hidden_additional_sections: string[] | null
}

type TripContextType = {
  selectedTrip: Trip | null
  setSelectedTrip: (trip: Trip | null) => void
  trips: Trip[]
  setTrips: (trips: Trip[]) => void
  // Cache pełnych danych
  tripFullData: TripFullData | null
  tripContentData: TripContentData | null
  isLoadingTripData: boolean
  // Funkcja do invalidacji cache
  invalidateTripCache: () => void
}

const TripContext = React.createContext<TripContextType | undefined>(undefined)

export function TripProvider({ children }: { children: React.ReactNode }) {
  // Inicjalizuj selectedTrip synchronicznie z localStorage, aby uniknąć migotania
  const [selectedTrip, setSelectedTripState] = React.useState<Trip | null>(() => {
    if (typeof window === "undefined") return null
    const savedTrip = localStorage.getItem("selectedTrip")
    if (savedTrip) {
      try {
        return JSON.parse(savedTrip) as Trip
      } catch (e) {
        console.error("Error parsing saved trip:", e)
        return null
      }
    }
    return null
  })
  const [trips, setTrips] = React.useState<Trip[]>([])
  const selectedTripRef = React.useRef<Trip | null>(selectedTrip)
  
  // Cache pełnych danych wycieczki
  const [tripFullData, setTripFullData] = React.useState<TripFullData | null>(null)
  const [tripContentData, setTripContentData] = React.useState<TripContentData | null>(null)
  const [isLoadingTripData, setIsLoadingTripData] = React.useState(false)
  const [cachedTripId, setCachedTripId] = React.useState<string | null>(null)

  // Aktualizuj ref przy każdej zmianie selectedTrip
  React.useEffect(() => {
    selectedTripRef.current = selectedTrip
  }, [selectedTrip])

  // Funkcja do preloadowania wszystkich danych wycieczki
  const loadTripData = React.useCallback(async (tripId: string) => {
    // Jeśli dane są już załadowane dla tej wycieczki, nie ładuj ponownie
    if (cachedTripId === tripId && tripFullData && tripContentData) {
      return
    }

    setIsLoadingTripData(true)
    try {
      // Ładuj oba endpointy równolegle
      const [tripRes, contentRes] = await Promise.all([
        fetch(`/api/trips/${tripId}`),
        fetch(`/api/trips/${tripId}/content`),
      ])

      if (tripRes.ok) {
        const tripData = await tripRes.json()
        setTripFullData(tripData as TripFullData)
      } else {
        console.error("Failed to load trip data:", tripRes.status)
        setTripFullData(null)
      }

      if (contentRes.ok) {
        const contentData = await contentRes.json()
        setTripContentData(contentData as TripContentData)
      } else {
        console.error("Failed to load trip content:", contentRes.status)
        setTripContentData(null)
      }

      setCachedTripId(tripId)
    } catch (error) {
      console.error("Error loading trip data:", error)
      setTripFullData(null)
      setTripContentData(null)
    } finally {
      setIsLoadingTripData(false)
    }
  }, [cachedTripId, tripFullData, tripContentData])

  // Funkcja do invalidacji cache
  const invalidateTripCache = React.useCallback(() => {
    setTripFullData(null)
    setTripContentData(null)
    setCachedTripId(null)
    // Jeśli mamy wybraną wycieczkę, przeładuj dane
    const currentTripId = selectedTripRef.current?.id
    if (currentTripId) {
      void loadTripData(currentTripId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zapisz wybraną wycieczkę w localStorage i załaduj dane
  const setSelectedTrip = React.useCallback((trip: Trip | null) => {
    setSelectedTripState(trip)
    selectedTripRef.current = trip
    
    // Wyczyść cache jeśli zmieniamy wycieczkę
    if (trip?.id !== cachedTripId) {
      setTripFullData(null)
      setTripContentData(null)
      setCachedTripId(null)
    }
    
    if (typeof window !== "undefined") {
      if (trip) {
        localStorage.setItem("selectedTripId", trip.id)
        localStorage.setItem("selectedTrip", JSON.stringify(trip))
        // Preloaduj dane dla nowej wycieczki
        void loadTripData(trip.id)
      } else {
        localStorage.removeItem("selectedTripId")
        localStorage.removeItem("selectedTrip")
        setTripFullData(null)
        setTripContentData(null)
        setCachedTripId(null)
      }
    }
  }, [cachedTripId, loadTripData])

  // Wczytaj listę wycieczek (raz, współdzielone między podstronami)
  React.useEffect(() => {
    const loadTrips = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("trips")
        .select("id, title, slug, start_date, end_date")
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (!error && data) {
        setTrips(data as Trip[])

        // Użyj ref, aby uzyskać aktualną wartość selectedTrip
        const currentSelectedTrip = selectedTripRef.current
        let tripToSelect: Trip | null = null

        // Jeśli mamy wybraną wycieczkę, sprawdź czy nadal istnieje w bazie i zaktualizuj ją
        if (currentSelectedTrip) {
          const updatedTrip = (data as Trip[]).find((t) => t.id === currentSelectedTrip.id)
          if (updatedTrip) {
            tripToSelect = updatedTrip
          } else {
            // Wybrana wycieczka już nie istnieje, wybierz pierwszą dostępną
            if (data.length > 0) {
              tripToSelect = data[0] as Trip
            }
          }
        } else {
          // Jeśli nie ma wybranej wycieczki, spróbuj przywrócić z localStorage lub wybierz pierwszą
          if (typeof window !== "undefined") {
            const savedId = localStorage.getItem("selectedTripId")
            const fromSaved =
              savedId != null ? (data as Trip[]).find((t) => t.id === savedId) : null

            if (fromSaved) {
              tripToSelect = fromSaved
            }
          }

          if (!tripToSelect && data.length > 0) {
            tripToSelect = data[0] as Trip
          }
        }

        // Użyj setSelectedTrip, aby zaktualizować zarówno stan jak i localStorage
        if (tripToSelect) {
          setSelectedTrip(tripToSelect)
        } else {
          setSelectedTrip(null)
        }
      }
    }

    void loadTrips()
  }, [setSelectedTrip])

  // Załaduj dane wycieczki jeśli selectedTrip istnieje, ale cache nie jest jeszcze załadowany
  React.useEffect(() => {
    if (selectedTrip?.id && cachedTripId !== selectedTrip.id && !isLoadingTripData) {
      void loadTripData(selectedTrip.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrip?.id, cachedTripId, isLoadingTripData])

  return (
    <TripContext.Provider
      value={{
        selectedTrip,
        setSelectedTrip,
        trips,
        setTrips,
        tripFullData,
        tripContentData,
        isLoadingTripData,
        invalidateTripCache,
      }}
    >
      {children}
    </TripContext.Provider>
  )
}

export function useTrip() {
  const context = React.useContext(TripContext)
  if (context === undefined) {
    throw new Error("useTrip must be used within a TripProvider")
  }
  return context
}

