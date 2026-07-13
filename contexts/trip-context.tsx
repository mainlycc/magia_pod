"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import {
  readTripsListCache,
  writeTripsListCache,
  type TripsListCacheTrip,
} from "@/lib/trips-list-cache"

type Trip = {
  id: string
  title: string
  slug: string
  start_date: string | null
  end_date: string | null
}

// Typ dla pojedynczej raty w harmonogramie
export type PaymentScheduleItem = {
  installment_number: number
  percent: number
  due_date: string
}

// Pełne dane wycieczki z API
export type TripFullData = {
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
  territorial_scope: string | null
  country: string | null
  location: string | null
  transport_mode: string | null
  airport_codes: string | null
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
  form_required_contact_fields: unknown
  payment_split_enabled: boolean | null
  payment_split_first_percent: number | null
  payment_split_second_percent: number | null
  payment_reminder_enabled: boolean | null
  payment_reminder_days_before: number | null
  payment_schedule: PaymentScheduleItem[] | null
}

// Dane content wycieczki
export type TripContentData = {
  program_atrakcje: string
  dodatkowe_swiadczenia: string
  gallery_urls: string[]
  intro_text: string
  section_poznaj_title: string
  section_poznaj_description: string
  reservation_info_text: string
  reservation_success_message: string
  trip_info_text: string
  baggage_text: string
  weather_text: string
  show_trip_info_card: boolean
  show_baggage_card: boolean
  show_weather_card: boolean
  show_seats_left: boolean
  included_in_price_text: string
  additional_costs_text: string
  additional_service_text: string
  reservation_number: string
  duration_text: string
  agreement_room_type: string
  agreement_meals_info: string
  agreement_transfer_info: string
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

export type UserRole = "admin" | "coordinator" | null

type TripContextType = {
  selectedTrip: Trip | null
  setSelectedTrip: (trip: Trip | null) => void
  trips: Trip[]
  setTrips: (trips: Trip[]) => void
  // Rola zalogowanego użytkownika (null dopóki nie załadowana)
  role: UserRole
  isRoleLoaded: boolean
  // Cache pełnych danych
  tripFullData: TripFullData | null
  tripContentData: TripContentData | null
  isLoadingTripData: boolean
  // Funkcja do invalidacji cache
  invalidateTripCache: () => void
}

const TripContext = React.createContext<TripContextType | undefined>(undefined)

/** Wybór aktywnej wycieczki z listy (localStorage / pierwsza / zgodność z poprzednim ref). */
function pickTripFromList(list: Trip[], currentSelectedTrip: Trip | null): Trip | null {
  let tripToSelect: Trip | null = null

  if (currentSelectedTrip) {
    const updatedTrip = list.find((t) => t.id === currentSelectedTrip.id)
    if (updatedTrip) {
      tripToSelect = updatedTrip
    } else if (list.length > 0) {
      tripToSelect = list[0]
    }
  } else {
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("selectedTripId")
      const fromSaved =
        savedId != null ? list.find((t) => t.id === savedId) : null

      if (fromSaved) {
        tripToSelect = fromSaved
      }
    }

    if (!tripToSelect && list.length > 0) {
      tripToSelect = list[0]
    }
  }

  return tripToSelect
}

export function TripProvider({ children }: { children: React.ReactNode }) {
  // Uwaga: nie inicjalizujemy z localStorage w initializerze,
  // bo to powoduje hydration mismatch (serwer renderuje null, klient renderuje zapisany trip).
  const [selectedTrip, setSelectedTripState] = React.useState<Trip | null>(null)
  const [trips, setTrips] = React.useState<Trip[]>([])
  const [role, setRole] = React.useState<UserRole>(null)
  const [isRoleLoaded, setIsRoleLoaded] = React.useState(false)
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
    let cancelled = false

    const loadTrips = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id ?? null

      // Pobierz profil (rola + przypisane wyjazdy) zanim pokażemy listę,
      // żeby koordynator ani przez moment nie widział cudzych wycieczek.
      let userRole: UserRole = null
      let allowedTripIds: string[] | null = null
      if (userId) {
        try {
          const res = await fetch("/api/profile")
          if (res.ok) {
            const profile = (await res.json()) as {
              role?: string
              allowed_trip_ids?: string[] | null
            }
            userRole =
              profile.role === "admin" || profile.role === "coordinator"
                ? profile.role
                : null
            allowedTripIds = profile.allowed_trip_ids ?? null
          }
        } catch {
          // brak profilu — traktujemy jak brak roli
        }
      }
      if (cancelled) return
      setRole(userRole)
      setIsRoleLoaded(true)

      const filterByRole = (list: Trip[]): Trip[] => {
        if (userRole !== "coordinator") return list
        const allowed = new Set((allowedTripIds ?? []).map(String))
        return list.filter((t) => allowed.has(String(t.id)))
      }

      if (!cancelled && userId) {
        const cached = readTripsListCache(userId)
        if (cached && cached.length > 0) {
          const list = filterByRole(cached as Trip[])
          setTrips(list)
          const tripToSelect = pickTripFromList(list, selectedTripRef.current)
          if (tripToSelect) {
            setSelectedTripState(tripToSelect)
            selectedTripRef.current = tripToSelect
          } else {
            setSelectedTripState(null)
            selectedTripRef.current = null
          }
        }
      }

      const { data, error } = await supabase
        .from("trips")
        .select("id, title, slug, start_date, end_date")
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (cancelled) return

      if (!error && data) {
        if (userId) {
          writeTripsListCache(userId, data as TripsListCacheTrip[])
        }

        const filtered = filterByRole(data as Trip[])
        setTrips(filtered)

        const tripToSelect = pickTripFromList(filtered, selectedTripRef.current)

        if (tripToSelect) {
          const sameAsCurrent = selectedTripRef.current?.id === tripToSelect.id
          if (sameAsCurrent) {
            setSelectedTripState(tripToSelect)
            selectedTripRef.current = tripToSelect
            if (typeof window !== "undefined") {
              localStorage.setItem("selectedTripId", tripToSelect.id)
              localStorage.setItem("selectedTrip", JSON.stringify(tripToSelect))
            }
          } else {
            setSelectedTrip(tripToSelect)
          }
        } else {
          setSelectedTrip(null)
        }
      }
    }

    void loadTrips()
    return () => {
      cancelled = true
    }
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
        role,
        isRoleLoaded,
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

