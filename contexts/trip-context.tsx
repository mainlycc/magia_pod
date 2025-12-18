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

type TripContextType = {
  selectedTrip: Trip | null
  setSelectedTrip: (trip: Trip | null) => void
  trips: Trip[]
  setTrips: (trips: Trip[]) => void
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

  // Aktualizuj ref przy każdej zmianie selectedTrip
  React.useEffect(() => {
    selectedTripRef.current = selectedTrip
  }, [selectedTrip])

  // Zapisz wybraną wycieczkę w localStorage
  const setSelectedTrip = React.useCallback((trip: Trip | null) => {
    setSelectedTripState(trip)
    selectedTripRef.current = trip
    if (typeof window !== "undefined") {
      if (trip) {
        localStorage.setItem("selectedTripId", trip.id)
        localStorage.setItem("selectedTrip", JSON.stringify(trip))
      } else {
        localStorage.removeItem("selectedTripId")
        localStorage.removeItem("selectedTrip")
      }
    }
  }, [])

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

  return (
    <TripContext.Provider
      value={{
        selectedTrip,
        setSelectedTrip,
        trips,
        setTrips,
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

