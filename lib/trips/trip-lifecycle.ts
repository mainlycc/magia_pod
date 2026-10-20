export type TripDateFields = {
  start_date?: string | null
  end_date?: string | null
}

export type TripLifecycleFields = TripDateFields & {
  is_active?: boolean | null
}

/** Koniec dnia daty wycieczki (end_date, a jeśli brak — start_date). */
export function getTripEndOfDay(trip: TripDateFields): Date | null {
  const tripDate = trip.end_date ?? trip.start_date
  if (!tripDate) return null

  const endOfTripDay = new Date(tripDate)
  endOfTripDay.setHours(23, 59, 59, 999)
  return endOfTripDay
}

/** Czy data wycieczki już minęła (koniec dnia end_date ?? start_date). */
export function isPastTrip(
  trip: TripDateFields,
  now: Date = new Date(),
): boolean {
  const endOfTripDay = getTripEndOfDay(trip)
  if (!endOfTripDay) return false
  return endOfTripDay.getTime() < now.getTime()
}

/**
 * Zrealizowana = dawna „Archiwalna”: nieaktywna i data w przeszłości.
 * Aktywne wycieczki z minioną datą stają się zrealizowane po cronie
 * (ustawia is_active=false).
 */
export function isCompletedTrip(
  trip: TripLifecycleFields,
  now: Date = new Date(),
): boolean {
  return trip.is_active === false && isPastTrip(trip, now)
}

/**
 * Czy aktywna wycieczka powinna zostać automatycznie oznaczona
 * jako zrealizowana (dezaktywacja po dacie).
 */
export function shouldAutoCompleteTrip(
  trip: TripLifecycleFields,
  now: Date = new Date(),
): boolean {
  return trip.is_active === true && isPastTrip(trip, now)
}
