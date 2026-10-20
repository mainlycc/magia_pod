export type Type1ExtraPerson = {
  id: string
  trip_id: string
  first_name: string
  last_name: string
  birth_date: string
  created_at: string
  updated_at: string
}

export type Type1ExtraXlsxRow = {
  first_name: string
  last_name: string
  date_of_birth: string | null
  agreement_number: string
  insurance_variant: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseType1ExtraPersonInput(body: unknown):
  | { ok: true; value: { first_name: string; last_name: string; birth_date: string } }
  | { ok: false; error: string } {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const first_name = typeof record.first_name === "string" ? record.first_name.trim() : ""
  const last_name = typeof record.last_name === "string" ? record.last_name.trim() : ""
  const birth_date = typeof record.birth_date === "string" ? record.birth_date.trim() : ""

  if (!first_name || first_name.length > 80) {
    return { ok: false, error: "Podaj imię" }
  }
  if (!last_name || last_name.length > 80) {
    return { ok: false, error: "Podaj nazwisko" }
  }
  if (!isCalendarDate(birth_date)) {
    return { ok: false, error: "Podaj datę urodzenia" }
  }

  return { ok: true, value: { first_name, last_name, birth_date } }
}

function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listType1ExtraPersons(supabase: any, tripId: string): Promise<Type1ExtraPerson[]> {
  const { data, error } = await supabase
    .from("insurance_type1_extra_persons")
    .select("id, trip_id, first_name, last_name, birth_date, created_at, updated_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[type1-extra-persons] list failed:", error)
    throw new Error(error.message)
  }

  return (data || []) as Type1ExtraPerson[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function countType1ExtraPersons(supabase: any, tripId: string): Promise<number> {
  const { count, error } = await supabase
    .from("insurance_type1_extra_persons")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)

  if (error) {
    console.error("[type1-extra-persons] count failed:", error)
    return 0
  }

  return count ?? 0
}

export function type1ExtraPersonsToXlsxRows(
  persons: Type1ExtraPerson[],
  variantName: string
): Type1ExtraXlsxRow[] {
  return persons.map((person) => ({
    first_name: person.first_name,
    last_name: person.last_name,
    date_of_birth: person.birth_date,
    agreement_number: "",
    insurance_variant: variantName,
  }))
}
