import { createAdminClient } from "@/lib/supabase/admin"
import { variantAttachmentPublicUrl } from "@/lib/insurance-local/variant-attachments"

// Marker zapisywany w polu `source` na pozycji `form_extra_insurances`,
// żeby odróżnić wpisy stworzone w zakładce "Ubezpieczenia" (synchronizowane
// z tabeli `trip_insurance_variants`) od pozycji dodanych ręcznie w
// `Informacje → Formularz`.
export const FORM_EXTRA_INSURANCES_SYNC_SOURCE = "trip_insurance_variant"

// Identyfikator pozycji `form_extra_insurances` zsynchronizowanej z konkretnego
// wiersza tabeli `trip_insurance_variants`. Prefiks gwarantuje brak kolizji
// z manualnymi pozycjami (które używają losowych UUID-ów).
export const SYNCED_INSURANCE_ID_PREFIX = "local-ins:"

type ExtraInsuranceEntry = {
  id: string
  title: string
  description?: string
  owu_url?: string
  price_cents?: number | null
  variants?: { id: string; title: string; price_cents: number | null }[]
  enabled?: boolean
  // Pola własne, używane przez sync — nieobecne na pozycjach manualnych.
  source?: string
  source_id?: string
  insurance_type?: number | null
}

export type TripInsuranceVariantRow = {
  id: string
  trip_id: string
  price_grosz: number | null
  is_enabled: boolean
  insurance_variants: {
    id: string
    type: number
    name: string
    provider: string | null
    description: string | null
    coverage_scope?: string | null
  } | null
}

/** Jedna pozycja `form_extra_insurances` zsynchronizowana z `trip_insurance_variants`. */
export function tripInsuranceVariantToExtraInsurance(
  row: TripInsuranceVariantRow,
  owuUrlByVariantId: Map<string, string> = new Map(),
): ExtraInsuranceEntry | null {
  return buildSyncedEntry(row, owuUrlByVariantId)
}

function buildSyncedEntry(
  row: TripInsuranceVariantRow,
  owuUrlByVariantId: Map<string, string>,
): ExtraInsuranceEntry | null {
  const iv = row.insurance_variants
  if (!iv) return null
  const titleParts = [iv.name, iv.provider].filter((s): s is string => Boolean(s && s.trim()))
  const title = titleParts.join(" — ") || iv.name || "Ubezpieczenie"
  const scopeText = iv.coverage_scope?.trim() || iv.description?.trim() || ""
  return {
    id: `${SYNCED_INSURANCE_ID_PREFIX}${row.id}`,
    title,
    description: scopeText,
    owu_url: owuUrlByVariantId.get(iv.id) || "",
    price_cents: typeof row.price_grosz === "number" ? row.price_grosz : null,
    enabled: row.is_enabled !== false,
    source: FORM_EXTRA_INSURANCES_SYNC_SOURCE,
    source_id: row.id,
    insurance_type: iv.type,
  }
}

/**
 * Synchronizuje listę `form_extra_insurances` na rekordzie wycieczki tak, aby
 * odzwierciedlała aktualny stan tabeli `trip_insurance_variants` (Typ 2 i 3).
 *
 * - Pozycje manualne (bez `source === "trip_insurance_variant"`) są zachowane
 *   bez zmian i pozostają na początku listy.
 * - Pozycje z markerem są nadpisywane pełnym, świeżym zestawem zbudowanym
 *   z aktualnych wierszy `trip_insurance_variants` (Typ 2 i 3).
 *
 * Zwraca `null` przy błędzie odczytu/zapisu (logowane w konsoli) — wywołujący
 * może to zignorować, bo główna operacja na `trip_insurance_variants` już się
 * zatwierdziła; sync to "best effort".
 */
export async function syncFormExtraInsurancesForTrip(tripId: string): Promise<ExtraInsuranceEntry[] | null> {
  if (!tripId) return null

  const admin = createAdminClient()

  const { data: variantsRows, error: variantsError } = await admin
    .from("trip_insurance_variants")
    .select(`
      id,
      trip_id,
      price_grosz,
      is_enabled,
      insurance_variants ( id, type, name, provider, description, coverage_scope )
    `)
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true })

  if (variantsError) {
    console.error("[sync-form-extra-insurances] read trip_insurance_variants failed:", variantsError)
    return null
  }

  // Zostaw tylko Typ 2 (dodatkowe) i Typ 3 (KR) — Typ 1 jest "wliczony w cenę"
  // i nie pojawia się w katalogu wyboru dla klienta.
  const allowedTypes = new Set<number>([2, 3])
  const typedRows = ((variantsRows ?? []) as unknown as TripInsuranceVariantRow[]).filter(
    (row) => row.insurance_variants && allowedTypes.has(row.insurance_variants.type),
  )

  const variantIds = typedRows
    .map((row) => row.insurance_variants?.id)
    .filter((id): id is string => Boolean(id))

  const owuUrlByVariantId = new Map<string, string>()
  if (variantIds.length > 0) {
    const { data: attachmentRows } = await admin
      .from("insurance_variant_attachments")
      .select("variant_id, file_name, attachment_type")
      .in("variant_id", variantIds)
      .eq("attachment_type", "owu")

    for (const attachment of attachmentRows || []) {
      if (attachment.variant_id && attachment.file_name) {
        owuUrlByVariantId.set(attachment.variant_id, variantAttachmentPublicUrl(attachment.file_name))
      }
    }
  }

  const synced = typedRows
    .map((row) => buildSyncedEntry(row, owuUrlByVariantId))
    .filter((e): e is ExtraInsuranceEntry => e !== null)

  const { data: tripRow, error: tripError } = await admin
    .from("trips")
    .select("form_extra_insurances")
    .eq("id", tripId)
    .single()

  if (tripError) {
    console.error("[sync-form-extra-insurances] read trip failed:", tripError)
    return null
  }

  const current: ExtraInsuranceEntry[] = Array.isArray(tripRow?.form_extra_insurances)
    ? (tripRow!.form_extra_insurances as ExtraInsuranceEntry[])
    : []

  const manual = current.filter((e) => e?.source !== FORM_EXTRA_INSURANCES_SYNC_SOURCE)
  const next: ExtraInsuranceEntry[] = [...manual, ...synced]

  const { error: updateError } = await admin
    .from("trips")
    .update({ form_extra_insurances: next })
    .eq("id", tripId)

  if (updateError) {
    console.error("[sync-form-extra-insurances] update trip failed:", updateError)
    return null
  }

  return next
}
