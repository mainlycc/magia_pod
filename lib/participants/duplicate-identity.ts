import { isParticipantActive } from "@/lib/participants/active";

export type ParticipantIdentity = {
  first_name: string;
  last_name: string;
  birth_date: string;
  is_active?: boolean | null;
};

/** Normalizowany klucz tożsamości uczestnika na wycieczce. */
export function participantIdentityKey(
  firstName: string,
  lastName: string,
  birthDate: string,
): string {
  const first = firstName.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl-PL");
  const last = lastName.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl-PL");
  const birth = birthDate.trim().slice(0, 10);
  return `${first}|${last}|${birth}`;
}

/** Placeholdery firmowe (dane do uzupełnienia później) — nie biorą udziału w kontroli duplikatów. */
export function isCompanyPlaceholderParticipant(participant: ParticipantIdentity): boolean {
  const last = participant.last_name.trim().toLocaleLowerCase("pl-PL");
  if (last.includes("dane do uzupełnienia")) return true;

  const birth = participant.birth_date.trim().slice(0, 10);
  const first = participant.first_name.trim();
  if (birth === "1900-01-01" && /^uczestnik(\s+\d+)?$/i.test(first)) {
    return true;
  }

  return false;
}

function formatBirthDatePl(iso: string): string {
  const [y, m, d] = iso.trim().slice(0, 10).split("-");
  if (!y || !m || !d) return iso.trim();
  return `${d}.${m}.${y}`;
}

export function buildDuplicateParticipantMessage(
  duplicates: ParticipantIdentity[],
): string {
  const seen = new Set<string>();
  const unique: ParticipantIdentity[] = [];
  for (const p of duplicates) {
    const key = participantIdentityKey(p.first_name, p.last_name, p.birth_date);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }

  if (unique.length === 0) {
    return "Ten uczestnik jest już zapisany na tę wycieczkę. Nie możesz dodać tej samej osoby drugi raz.";
  }

  if (unique.length === 1) {
    const p = unique[0];
    return `Uczestnik ${p.first_name} ${p.last_name} (ur. ${formatBirthDatePl(p.birth_date)}) jest już zapisany na tę wycieczkę. Nie możesz dodać tej samej osoby drugi raz.`;
  }

  const list = unique
    .map((p) => `${p.first_name} ${p.last_name} (ur. ${formatBirthDatePl(p.birth_date)})`)
    .join(", ");
  return `Następujący uczestnicy są już zapisani na tę wycieczkę: ${list}. Nie możesz dodać tej samej osoby drugi raz.`;
}

/**
 * Znajduje uczestników z `incoming`, którzy kolidują z samym payloadem
 * albo z już zapisanymi (aktywnymi) uczestnikami wycieczki.
 * Zamawiający nie jest sprawdzany — tylko lista uczestników.
 */
export function findDuplicateParticipantIdentities(
  incoming: ParticipantIdentity[],
  existing: ParticipantIdentity[],
): ParticipantIdentity[] {
  const existingKeys = new Set(
    existing
      .filter(isParticipantActive)
      .filter((p) => !isCompanyPlaceholderParticipant(p))
      .filter((p) => p.first_name?.trim() && p.last_name?.trim() && p.birth_date?.trim())
      .map((p) => participantIdentityKey(p.first_name, p.last_name, p.birth_date)),
  );

  const seenIncoming = new Set<string>();
  const duplicateKeys = new Set<string>();
  const duplicates: ParticipantIdentity[] = [];

  for (const p of incoming) {
    if (isCompanyPlaceholderParticipant(p)) continue;
    if (!p.first_name?.trim() || !p.last_name?.trim() || !p.birth_date?.trim()) continue;

    const key = participantIdentityKey(p.first_name, p.last_name, p.birth_date);
    const dupInPayload = seenIncoming.has(key);
    const dupExisting = existingKeys.has(key);
    seenIncoming.add(key);

    if ((dupInPayload || dupExisting) && !duplicateKeys.has(key)) {
      duplicateKeys.add(key);
      duplicates.push({
        first_name: p.first_name.trim().replace(/\s+/g, " "),
        last_name: p.last_name.trim().replace(/\s+/g, " "),
        birth_date: p.birth_date.trim().slice(0, 10),
      });
    }
  }

  return duplicates;
}
