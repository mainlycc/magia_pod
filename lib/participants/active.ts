/** Uczestnik bez flagi (stare rekordy / brak kolumny w odpowiedzi) traktujemy jako aktywnego. */
export function isParticipantActive(
  participant: { is_active?: boolean | null } | null | undefined,
): boolean {
  return participant?.is_active !== false
}

export function filterActiveParticipants<T extends { is_active?: boolean | null }>(
  participants: T[],
): T[] {
  return participants.filter(isParticipantActive)
}
