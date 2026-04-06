"use client"

import React, { useEffect, useMemo, useState } from "react"
import type { TripFullData } from "@/contexts/trip-context"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

type DietCatalog = {
  id: string
  title: string
  price_cents: number | null
  variants?: { id: string; title: string; price_cents: number | null }[]
}

type InsuranceCatalog = {
  id: string
  title: string
  variants?: { id: string; title: string; price_cents: number | null }[]
}

type AttractionCatalog = {
  id: string
  title: string
  price_cents: number | null
  enabled?: boolean
  currency?: string
  include_in_contract?: boolean
}

type DietEntry = {
  service_id: string
  variant_id?: string
  price_cents?: number | null
}

type InsuranceEntry = {
  service_id: string
  variant_id?: string
  price_cents?: number | null
}

type AttractionEntry = {
  service_id: string
  price_cents?: number | null
  currency?: string
  include_in_contract?: boolean
}

type DraftState = {
  diets: DietEntry[]
  insurances: InsuranceEntry[]
  attractions: AttractionEntry[]
}

function parseCatalogArray<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : []
}

function normalizeDraft(raw: unknown): DraftState {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    diets: Array.isArray(o.diets) ? JSON.parse(JSON.stringify(o.diets)) : [],
    insurances: Array.isArray(o.insurances) ? JSON.parse(JSON.stringify(o.insurances)) : [],
    attractions: Array.isArray(o.attractions) ? JSON.parse(JSON.stringify(o.attractions)) : [],
  }
}

function toPayload(d: DraftState): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (d.diets.length) out.diets = d.diets
  if (d.insurances.length) out.insurances = d.insurances
  if (d.attractions.length) out.attractions = d.attractions
  return out
}

function stablePayloadJson(d: DraftState): string {
  return JSON.stringify(toPayload(d))
}

type Props = {
  participantId: string
  tripFullData: TripFullData | null
  initialSelectedServices: unknown
  onSaved: () => void
}

export function ParticipantAdditionalServicesEditor({
  participantId,
  tripFullData,
  initialSelectedServices,
  onSaved,
}: Props) {
  const initialDraft = useMemo(() => normalizeDraft(initialSelectedServices), [initialSelectedServices])
  const [draft, setDraft] = useState<DraftState>(initialDraft)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(normalizeDraft(initialSelectedServices))
  }, [initialSelectedServices])

  const diets = parseCatalogArray<DietCatalog>(tripFullData?.form_diets)
  const insurances = parseCatalogArray<InsuranceCatalog>(tripFullData?.form_extra_insurances)
  const attractions = parseCatalogArray<AttractionCatalog>(tripFullData?.form_additional_attractions).filter(
    (a) => a.enabled !== false,
  )

  const showStepOffNote =
    tripFullData?.form_show_additional_services !== true &&
    (diets.length > 0 || insurances.length > 0 || attractions.length > 0)

  const isDirty = stablePayloadJson(draft) !== stablePayloadJson(initialDraft)

  const persist = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/participants/${participantId}/selected-services`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_services: toPayload(draft) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "save_failed")
      }
      toast.success("Zapisano usługi dodatkowe")
      onSaved()
    } catch (e) {
      console.error(e)
      toast.error("Nie udało się zapisać usług dodatkowych")
    } finally {
      setSaving(false)
    }
  }

  const setDietOn = (catalog: DietCatalog, on: boolean) => {
    setDraft((prev) => {
      const next = { ...prev, diets: [...prev.diets] }
      const idx = next.diets.findIndex((d) => d.service_id === catalog.id)
      if (!on) {
        if (idx >= 0) next.diets.splice(idx, 1)
        return next
      }
      if (idx >= 0) return next
      const v0 = catalog.variants?.[0]
      next.diets.push({
        service_id: catalog.id,
        variant_id: v0?.id,
        price_cents: v0?.price_cents ?? catalog.price_cents ?? null,
      })
      return next
    })
  }

  const setDietVariant = (catalog: DietCatalog, variantId: string) => {
    const variant = catalog.variants?.find((v) => v.id === variantId)
    setDraft((prev) => ({
      ...prev,
      diets: prev.diets.map((d) =>
        d.service_id === catalog.id
          ? {
              ...d,
              variant_id: variantId,
              price_cents: variant?.price_cents ?? d.price_cents ?? catalog.price_cents ?? null,
            }
          : d,
      ),
    }))
  }

  const setInsuranceOn = (catalog: InsuranceCatalog, on: boolean) => {
    setDraft((prev) => {
      const next = { ...prev, insurances: [...prev.insurances] }
      const idx = next.insurances.findIndex((d) => d.service_id === catalog.id)
      if (!on) {
        if (idx >= 0) next.insurances.splice(idx, 1)
        return next
      }
      if (idx >= 0) return next
      const v0 = catalog.variants?.[0]
      next.insurances.push({
        service_id: catalog.id,
        variant_id: v0?.id,
        price_cents: v0?.price_cents ?? null,
      })
      return next
    })
  }

  const setInsuranceVariant = (catalog: InsuranceCatalog, variantId: string) => {
    const variant = catalog.variants?.find((v) => v.id === variantId)
    setDraft((prev) => ({
      ...prev,
      insurances: prev.insurances.map((d) =>
        d.service_id === catalog.id
          ? { ...d, variant_id: variantId, price_cents: variant?.price_cents ?? d.price_cents ?? null }
          : d,
      ),
    }))
  }

  const setAttractionOn = (catalog: AttractionCatalog, on: boolean) => {
    setDraft((prev) => {
      const next = { ...prev, attractions: [...prev.attractions] }
      const idx = next.attractions.findIndex((d) => d.service_id === catalog.id)
      if (!on) {
        if (idx >= 0) next.attractions.splice(idx, 1)
        return next
      }
      if (idx >= 0) return next
      next.attractions.push({
        service_id: catalog.id,
        price_cents: catalog.price_cents ?? null,
        currency: catalog.currency || "PLN",
        include_in_contract: catalog.include_in_contract !== false,
      })
      return next
    })
  }

  const formatPrice = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) return "—"
    return `${(cents / 100).toFixed(2)} zł`
  }

  if (diets.length === 0 && insurances.length === 0 && attractions.length === 0) {
    return (
      <div>
        <h4 className="font-semibold text-sm mb-2">Usługi dodatkowe</h4>
        <p className="text-sm text-muted-foreground">
          Dla tej wycieczki nie zdefiniowano usług dodatkowych (diety, ubezpieczenia, atrakcje) w ustawieniach
          formularza.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-sm">Usługi dodatkowe</h4>
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={!isDirty || saving}
          onClick={(e) => {
            e.stopPropagation()
            void persist()
          }}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
          Zapisz zmiany
        </Button>
      </div>
      {showStepOffNote && (
        <p className="text-xs text-muted-foreground">
          Krok „Usługi dodatkowe” jest wyłączony w formularzu publicznym — poniżej widać katalog wycieczki i
          zapisane wybory; możesz je poprawić ręcznie.
        </p>
      )}
      <div className="rounded-md border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-2 font-medium">Typ</th>
              <th className="text-left p-2 font-medium">Usługa</th>
              <th className="text-left p-2 font-medium w-[100px]">Wybrane</th>
              <th className="text-left p-2 font-medium">Wariant / szczegóły</th>
              <th className="text-right p-2 font-medium w-[100px]">Cena</th>
            </tr>
          </thead>
          <tbody>
            {diets.map((d) => {
              const row = draft.diets.find((x) => x.service_id === d.id)
              const selected = !!row
              const variants = d.variants?.length ? d.variants : null
              return (
                <tr key={`diet-${d.id}`} className="border-b last:border-0">
                  <td className="p-2 text-muted-foreground">Dieta</td>
                  <td className="p-2">{d.title}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={selected}
                        onCheckedChange={(v) => setDietOn(d, v)}
                        aria-label={`Wybór diety ${d.title}`}
                      />
                      <span className="text-xs text-muted-foreground">{selected ? "Tak" : "Nie"}</span>
                    </div>
                  </td>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    {selected && variants ? (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Wariant</Label>
                        <Select
                          value={row?.variant_id ?? variants[0]?.id}
                          onValueChange={(vid) => setDietVariant(d, vid)}
                        >
                          <SelectTrigger size="sm" className="h-8 max-w-[220px]">
                            <SelectValue placeholder="Wybierz" />
                          </SelectTrigger>
                          <SelectContent>
                            {variants.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.title} ({formatPrice(v.price_cents)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : selected && !variants ? (
                      <span className="text-xs text-muted-foreground">Bez wariantów</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {selected ? formatPrice(row?.price_cents) : "—"}
                  </td>
                </tr>
              )
            })}
            {insurances.map((ins) => {
              const row = draft.insurances.find((x) => x.service_id === ins.id)
              const selected = !!row
              const variants = ins.variants?.length ? ins.variants : null
              return (
                <tr key={`ins-${ins.id}`} className="border-b last:border-0">
                  <td className="p-2 text-muted-foreground">Ubezpieczenie</td>
                  <td className="p-2">{ins.title}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={selected}
                        onCheckedChange={(v) => setInsuranceOn(ins, v)}
                        aria-label={`Wybór ubezpieczenia ${ins.title}`}
                      />
                      <span className="text-xs text-muted-foreground">{selected ? "Tak" : "Nie"}</span>
                    </div>
                  </td>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    {selected && variants ? (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Wariant</Label>
                        <Select
                          value={row?.variant_id ?? variants[0]?.id}
                          onValueChange={(vid) => setInsuranceVariant(ins, vid)}
                        >
                          <SelectTrigger size="sm" className="h-8 max-w-[220px]">
                            <SelectValue placeholder="Wybierz" />
                          </SelectTrigger>
                          <SelectContent>
                            {variants.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.title} ({formatPrice(v.price_cents)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : selected && !variants ? (
                      <span className="text-xs text-muted-foreground">Bez wariantów</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {selected ? formatPrice(row?.price_cents) : "—"}
                  </td>
                </tr>
              )
            })}
            {attractions.map((a) => {
              const row = draft.attractions.find((x) => x.service_id === a.id)
              const selected = !!row
              return (
                <tr key={`att-${a.id}`} className="border-b last:border-0">
                  <td className="p-2 text-muted-foreground">Atrakcja</td>
                  <td className="p-2">{a.title}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={selected}
                        onCheckedChange={(v) => setAttractionOn(a, v)}
                        aria-label={`Wybór atrakcji ${a.title}`}
                      />
                      <span className="text-xs text-muted-foreground">{selected ? "Tak" : "Nie"}</span>
                    </div>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {row?.currency && row.currency !== "PLN" ? `Waluta: ${row.currency}` : "—"}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {selected ? formatPrice(row?.price_cents) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
