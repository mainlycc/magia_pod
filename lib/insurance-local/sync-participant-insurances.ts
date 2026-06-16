import { createAdminClient } from "@/lib/supabase/admin"
import { SYNCED_INSURANCE_ID_PREFIX } from "@/lib/insurance-local/sync-form-extra-insurances"

export type SelectedInsuranceEntry = {
  service_id: string
  variant_id?: string
  price_cents?: number | null
}

export type ParticipantInsuranceSyncRow = {
  booking_id: string
  participant_id: string
  trip_insurance_variant_id: string
}

type ParticipantRow = {
  id: string
  booking_id: string | null
  selected_services: unknown
}

/** Wyciąga UUID wiersza `trip_insurance_variants` z `service_id` formularza. */
export function tripInsuranceVariantIdFromServiceId(serviceId: string): string | null {
  if (!serviceId.startsWith(SYNCED_INSURANCE_ID_PREFIX)) return null
  const id = serviceId.slice(SYNCED_INSURANCE_ID_PREFIX.length).trim()
  return id.length > 0 ? id : null
}

/** Parsuje `selected_services` uczestnika do listy wariantów do synchronizacji. */
export function parseSelectedInsurancesForSync(
  selectedServices: unknown,
): SelectedInsuranceEntry[] {
  if (!selectedServices || typeof selectedServices !== "object") return []
  const raw = selectedServices as Record<string, unknown>
  if (!Array.isArray(raw.insurances)) return []
  return raw.insurances.filter(
    (entry): entry is SelectedInsuranceEntry =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as SelectedInsuranceEntry).service_id === "string",
  )
}

/** Buduje listę rekordów `participant_insurances` z danych uczestnika. */
export function buildParticipantInsuranceRows(
  participant: { id: string; booking_id: string | null; selected_services: unknown },
): ParticipantInsuranceSyncRow[] {
  if (!participant.booking_id) return []

  const rows: ParticipantInsuranceSyncRow[] = []
  const seen = new Set<string>()

  for (const entry of parseSelectedInsurancesForSync(participant.selected_services)) {
    const tripVariantId = tripInsuranceVariantIdFromServiceId(entry.service_id)
    if (!tripVariantId || seen.has(tripVariantId)) continue
    seen.add(tripVariantId)
    rows.push({
      booking_id: participant.booking_id,
      participant_id: participant.id,
      trip_insurance_variant_id: tripVariantId,
    })
  }

  return rows
}

export type SyncParticipantInsurancesResult = {
  upserted: number
  cancelled: number
  skipped_manual: number
}

async function syncParticipantRows(
  admin: ReturnType<typeof createAdminClient>,
  participants: ParticipantRow[],
): Promise<SyncParticipantInsurancesResult> {
  let upserted = 0
  let cancelled = 0
  let skipped_manual = 0

  for (const participant of participants) {
    if (!participant.booking_id) continue

    const desiredRows = buildParticipantInsuranceRows(participant)
    const desiredVariantIds = new Set(desiredRows.map((r) => r.trip_insurance_variant_id))

    const insurances = parseSelectedInsurancesForSync(participant.selected_services)
    for (const entry of insurances) {
      if (!tripInsuranceVariantIdFromServiceId(entry.service_id)) {
        skipped_manual++
      }
    }

    const { data: existing, error: existingError } = await admin
      .from("participant_insurances")
      .select("id, trip_insurance_variant_id, status")
      .eq("participant_id", participant.id)
      .eq("booking_id", participant.booking_id)

    if (existingError) {
      console.error("[sync-participant-insurances] read existing failed:", existingError)
      return { upserted, cancelled, skipped_manual }
    }

    const existingByVariant = new Map(
      (existing ?? []).map((row) => [row.trip_insurance_variant_id as string, row]),
    )

    for (const row of desiredRows) {
      const current = existingByVariant.get(row.trip_insurance_variant_id)
      if (current) {
        if (current.status === "cancelled") {
          const { error } = await admin
            .from("participant_insurances")
            .update({ status: "purchased" })
            .eq("id", current.id)
          if (error) {
            console.error("[sync-participant-insurances] reactivate failed:", error)
          } else {
            upserted++
          }
        }
        continue
      }

      const { error } = await admin.from("participant_insurances").insert({
        booking_id: row.booking_id,
        participant_id: row.participant_id,
        trip_insurance_variant_id: row.trip_insurance_variant_id,
        status: "purchased",
      })
      if (error) {
        console.error("[sync-participant-insurances] insert failed:", error)
      } else {
        upserted++
      }
    }

    for (const row of existing ?? []) {
      if (row.status === "cancelled") continue
      if (!desiredVariantIds.has(row.trip_insurance_variant_id as string)) {
        const { error } = await admin
          .from("participant_insurances")
          .update({ status: "cancelled" })
          .eq("id", row.id)
        if (error) {
          console.error("[sync-participant-insurances] cancel failed:", error)
        } else {
          cancelled++
        }
      }
    }
  }

  return { upserted, cancelled, skipped_manual }
}

/** Synchronizuje `participant_insurances` dla jednej rezerwacji. */
export async function syncParticipantInsurancesForBooking(
  bookingId: string,
): Promise<SyncParticipantInsurancesResult | null> {
  if (!bookingId) return null

  const admin = createAdminClient()
  const { data: participants, error } = await admin
    .from("participants")
    .select("id, booking_id, selected_services")
    .eq("booking_id", bookingId)

  if (error) {
    console.error("[sync-participant-insurances] read participants for booking failed:", error)
    return null
  }

  return syncParticipantRows(admin, (participants ?? []) as ParticipantRow[])
}

/** Backfill: synchronizuje wszystkich uczestników aktywnych rezerwacji na wycieczce. */
export async function syncParticipantInsurancesForTrip(
  tripId: string,
): Promise<SyncParticipantInsurancesResult | null> {
  if (!tripId) return null

  const admin = createAdminClient()
  const { data: bookings, error: bookingsError } = await admin
    .from("bookings")
    .select("id")
    .eq("trip_id", tripId)
    .neq("status", "cancelled")

  if (bookingsError) {
    console.error("[sync-participant-insurances] read bookings failed:", bookingsError)
    return null
  }

  const bookingIds = (bookings ?? []).map((b) => b.id as string)
  if (bookingIds.length === 0) {
    return { upserted: 0, cancelled: 0, skipped_manual: 0 }
  }

  const { data: participants, error: participantsError } = await admin
    .from("participants")
    .select("id, booking_id, selected_services")
    .in("booking_id", bookingIds)

  if (participantsError) {
    console.error("[sync-participant-insurances] read participants for trip failed:", participantsError)
    return null
  }

  return syncParticipantRows(admin, (participants ?? []) as ParticipantRow[])
}
