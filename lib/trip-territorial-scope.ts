/** Wartość Select gdy brak wyboru (mapuj na null w API). */
export const TERRITORIAL_SCOPE_NONE = "__territorial_scope_none__" as const

export const TRIP_TERRITORIAL_SCOPES = ["PLISAS", "EUR", "POZAEUR"] as const

export type TripTerritorialScope = (typeof TRIP_TERRITORIAL_SCOPES)[number]

export const TRIP_TERRITORIAL_SCOPE_LABELS: Record<TripTerritorialScope, string> = {
  PLISAS: "PLISAS",
  EUR: "EUR",
  POZAEUR: "POZAEUR",
}

export const TRIP_TERRITORIAL_SCOPE_OPTIONS = TRIP_TERRITORIAL_SCOPES.map(
  (value) => ({
    value,
    label: TRIP_TERRITORIAL_SCOPE_LABELS[value],
  })
) as ReadonlyArray<{ value: TripTerritorialScope; label: string }>

export function normalizeTerritorialScope(
  value: string | null | undefined
): typeof TERRITORIAL_SCOPE_NONE | TripTerritorialScope {
  const v = typeof value === "string" ? value.trim().toUpperCase() : ""
  return (TRIP_TERRITORIAL_SCOPES as readonly string[]).includes(v)
    ? (v as TripTerritorialScope)
    : TERRITORIAL_SCOPE_NONE
}

export function territorialScopeToApi(uiValue: string): string | null {
  const v = uiValue.trim().toUpperCase()
  return (TRIP_TERRITORIAL_SCOPES as readonly string[]).includes(v) ? v : null
}
