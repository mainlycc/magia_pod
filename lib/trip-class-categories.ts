/** Klasy szkolne w kolejności od najwyższej (6B) do najniższej (1A). */
export const TRIP_CLASS_CATEGORIES = [
  "6B",
  "6A",
  "5B",
  "5A",
  "4B",
  "4A",
  "3B",
  "3A",
  "2B",
  "2A",
  "1B",
  "1A",
] as const

export type TripClassCategory = (typeof TRIP_CLASS_CATEGORIES)[number]

export const TRIP_CLASS_CATEGORY_LABELS: Record<TripClassCategory, string> = {
  "6B": "6B. Polska i kraje sąsiedzkie, płatność przed",
  "6A": "6A. Polska i kraje sąsiedzkie, płatność po",
  "5B": "5B. Europa, dojazd własny, płatność przed",
  "5A": "5A. Europa, dojazd własny, płatność po",
  "4B": "4B. Europa, płatność przed",
  "4A": "4A. Europa, płatność po",
  "3B": "3B. Świat, bez transportu, płatność przed",
  "3A": "3A. Świat, bez transportu, płatność po",
  "2B": "2B. Świat, płatność przed",
  "2A": "2A. Świat, płatność po",
  "1B": "1B. Czarter, płatność przed",
  "1A": "1A. Czarter, płatność po",
}

export const TRIP_CLASS_CATEGORY_OPTIONS = TRIP_CLASS_CATEGORIES.map((value) => ({
  value,
  label: TRIP_CLASS_CATEGORY_LABELS[value],
})) as ReadonlyArray<{ value: TripClassCategory; label: string }>

/** Wartość Select gdy użytkownik nie wybiera kategorii (mapuj na null w API). */
export const TRIP_CATEGORY_NONE = "__none__" as const
