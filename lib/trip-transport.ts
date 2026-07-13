/** Wartość Select gdy brak wyboru (mapuj na null w API). */
export const TRANSPORT_NONE = "__transport_none__" as const

export const TRIP_TRANSPORT_OPTIONS = [
  "LOTNCZART",
  "NLOT",
  "BRAK",
  "LOTCZART",
] as const

export type TripTransportMode = (typeof TRIP_TRANSPORT_OPTIONS)[number]

export function normalizeTransportMode(
  value: string | null | undefined
): typeof TRANSPORT_NONE | TripTransportMode {
  const v = typeof value === "string" ? value.trim().toUpperCase() : ""
  return (TRIP_TRANSPORT_OPTIONS as readonly string[]).includes(v)
    ? (v as TripTransportMode)
    : TRANSPORT_NONE
}

/** Wartość do POST/PATCH: null gdy brak lub nieznana */
export function transportModeToApi(uiValue: string): string | null {
  const v = uiValue.trim().toUpperCase()
  return (TRIP_TRANSPORT_OPTIONS as readonly string[]).includes(v) ? v : null
}
