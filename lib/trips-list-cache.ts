/** Lista wycieczek z dashboardu — cache w sessionStorage (per karta, powiązany z userId). */

export const TRIPS_LIST_CACHE_STORAGE_KEY = "magia_dashboard_trips_list_v1"

export type TripsListCacheTrip = {
  id: string
  title: string
  slug: string
  start_date: string | null
  end_date: string | null
}

type TripsListCachePayload = {
  v: 1
  userId: string
  trips: TripsListCacheTrip[]
}

function isTripRow(x: unknown): x is TripsListCacheTrip {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.slug === "string" &&
    (o.start_date === null || typeof o.start_date === "string") &&
    (o.end_date === null || typeof o.end_date === "string")
  )
}

function isPayload(x: unknown): x is TripsListCachePayload {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (
    o.v === 1 &&
    typeof o.userId === "string" &&
    Array.isArray(o.trips) &&
    o.trips.every(isTripRow)
  )
}

/** Zwraca listę z cache tylko gdy zapis pasuje do podanego userId. */
export function readTripsListCache(userId: string): TripsListCacheTrip[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(TRIPS_LIST_CACHE_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isPayload(parsed)) return null
    if (parsed.userId !== userId) return null
    return parsed.trips
  } catch {
    return null
  }
}

export function writeTripsListCache(userId: string, trips: TripsListCacheTrip[]): void {
  if (typeof window === "undefined") return
  try {
    const payload: TripsListCachePayload = { v: 1, userId, trips }
    sessionStorage.setItem(TRIPS_LIST_CACHE_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // quota / private mode — ignoruj
  }
}

export function clearTripsListCache(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(TRIPS_LIST_CACHE_STORAGE_KEY)
  } catch {
    // ignoruj
  }
}
