export type InsuranceVariant = {
  id: string
  type: 1 | 2 | 3
  name: string
  provider: string
  description: string | null
  is_default: boolean
  is_active: boolean
}

export type TripInsuranceVariant = {
  id: string
  trip_id: string
  price_grosz: number | null
  is_enabled: boolean
  created_at: string
  updated_at: string
  insurance_variants: InsuranceVariant
}

export type ParticipantInsurance = {
  id: string
  status: "purchased" | "confirmed" | "cancelled"
  purchased_at: string
  booking_id: string
  participant_id: string | null
  trip_insurance_variant_id: string
  bookings: {
    id: string
    booking_ref: string
    contact_email: string | null
    contact_first_name: string | null
    contact_last_name: string | null
  } | null
  participants: {
    id: string
    first_name: string
    last_name: string
    date_of_birth: string | null
    pesel: string | null
  } | null
  trip_insurance_variants: {
    id: string
    price_grosz: number | null
    insurance_variants: {
      id: string
      type: number
      name: string
      provider: string
    }
  } | null
}

export type EmailTemplate = {
  id: string
  type: 1 | 2 | 3
  subject_template: string
  body_template: string
  to_email: string
  cc_email: string | null
}

export type EmailLog = {
  id: string
  trip_id: string | null
  insurance_type: 1 | 2 | 3
  sent_at: string
  recipients: string[]
  xlsx_filename: string | null
  participants_count: number
  status: "sent" | "error"
  error_message: string | null
  triggered_by: "manual" | "cron"
}

export function formatPrice(grosz: number | null): string {
  if (grosz === null) return "wliczone w cenę"
  const zl = Math.floor(grosz / 100)
  const gr = grosz % 100
  return `${zl},${gr.toString().padStart(2, "0")} zł`
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "—"
  return new Date(dateString).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return "—"
  return new Date(dateString).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
