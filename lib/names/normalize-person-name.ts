const LETTER_RE = /[A-Za-zÀ-žĄĆĘŁŃÓŚŹŻąćęłńóśźż]/u

function lettersOnly(value: string): string {
  return value.replace(/[^A-Za-zÀ-žĄĆĘŁŃÓŚŹŻąćęłńóśźż]/gu, "")
}

/**
 * Sprowadza imię/nazwisko wpisane CAPSLOCKIEM (lub całe małymi) do formy
 * „Joanna” / „Anna-Maria”. Mieszany zapis (np. „McDonald”) zostawia bez zmian.
 */
export function normalizePersonName(input: string | null | undefined): string {
  if (input == null) return ""
  const trimmed = input.trim().replace(/\s+/g, " ")
  if (!trimmed) return trimmed

  const letters = lettersOnly(trimmed)
  if (!letters || !LETTER_RE.test(letters)) return trimmed

  const lower = letters.toLocaleLowerCase("pl-PL")
  const upper = letters.toLocaleUpperCase("pl-PL")
  const isUniformCase = letters === lower || letters === upper
  if (!isUniformCase) return trimmed

  return trimmed
    .toLocaleLowerCase("pl-PL")
    .split(/([\s'-]+)/)
    .map((token) => {
      if (!token || /^[\s'-]+$/.test(token)) return token
      const chars = [...token]
      chars[0] = chars[0].toLocaleUpperCase("pl-PL")
      return chars.join("")
    })
    .join("")
}

export function normalizeOptionalPersonName(
  input: string | null | undefined,
): string | undefined {
  if (input == null || input === "") return undefined
  return normalizePersonName(input)
}

type BookingNamesPayload = {
  contact_first_name?: string
  contact_last_name?: string
  invoice_name?: string
  invoice?: {
    person?: {
      first_name?: string
      last_name?: string
      address?: unknown
    }
    company?: unknown
    use_other_data?: boolean
    type?: "individual" | "company"
  }
  participants: Array<{ first_name: string; last_name: string } & Record<string, unknown>>
}

/** Normalizuje pola osobowe w payloadzie rezerwacji (przed zapisem do DB / PDF / mail). */
export function normalizeBookingPersonNames<T extends BookingNamesPayload>(payload: T): T {
  const invoicePerson = payload.invoice?.person
  return {
    ...payload,
    contact_first_name: normalizeOptionalPersonName(payload.contact_first_name) ?? payload.contact_first_name,
    contact_last_name: normalizeOptionalPersonName(payload.contact_last_name) ?? payload.contact_last_name,
    invoice_name: normalizeOptionalPersonName(payload.invoice_name) ?? payload.invoice_name,
    invoice: payload.invoice
      ? {
          ...payload.invoice,
          person: invoicePerson
            ? {
                ...invoicePerson,
                first_name:
                  normalizeOptionalPersonName(invoicePerson.first_name) ?? invoicePerson.first_name,
                last_name:
                  normalizeOptionalPersonName(invoicePerson.last_name) ?? invoicePerson.last_name,
              }
            : invoicePerson,
        }
      : payload.invoice,
    participants: payload.participants.map((p) => ({
      ...p,
      first_name: normalizePersonName(p.first_name),
      last_name: normalizePersonName(p.last_name),
    })),
  }
}
