export type ManagedVariantAttachment = {
  id: string
  variant_id: string
  attachment_type: "owu" | "other"
  file_name: string
  display_name: string | null
  sort_order: number
  created_at: string
  updated_at: string
  url?: string
}

export type ManagedInsuranceVariant = {
  id: string
  type: 1 | 2 | 3
  name: string
  provider: string
  description: string | null
  coverage_scope: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  attachments: ManagedVariantAttachment[]
  trip_default: {
    price_grosz: number | null
    is_enabled: boolean
  }
}
