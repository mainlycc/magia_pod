export type RegistrationMode = "individual" | "company" | "both"

export interface RequiredParticipantFields {
  pesel: boolean
  document: boolean
  gender: boolean
  phone: boolean
}

export interface AdditionalAttraction {
  id: string
  title: string
  description: string
  price_cents: number | null
  include_in_contract?: boolean
  currency?: "PLN" | "EUR"
  enabled?: boolean
}

export interface DietVariant {
  id: string
  title: string
  price_cents: number | null
}

export interface Diet {
  id: string
  title: string
  description: string
  price_cents: number | null
  variants?: DietVariant[]
  enabled?: boolean
}

export interface InsuranceVariant {
  id: string
  title: string
  price_cents: number | null
}

export interface ExtraInsurance {
  id: string
  title: string
  description: string
  owu_url: string
  price_cents: number | null
  variants?: InsuranceVariant[]
  enabled?: boolean
}
