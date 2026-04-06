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

/** Wartość Select gdy użytkownik nie wybiera kategorii (mapuj na null w API). */
export const TRIP_CATEGORY_NONE = "__none__" as const
