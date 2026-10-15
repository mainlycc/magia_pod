import { isParticipantActive } from "@/lib/participants/active"

type ParticipantLike = {
  id?: string | null
  is_active?: boolean | null
} | null

/**
 * Ubezpieczenia typ 2/3 mają sens tylko dla istniejącego, aktywnego uczestnika.
 * Orphan po DELETE (participant_id SET NULL) oraz is_active=false nie powinny
 * wchodzić do list ani liczników w zakładce Ubezpieczenia.
 */
export function shouldIncludeParticipantInsurance(participants: ParticipantLike | ParticipantLike[]): boolean {
  if (!participants) return false
  const person = Array.isArray(participants) ? participants[0] : participants
  if (!person?.id) return false
  return isParticipantActive(person)
}
