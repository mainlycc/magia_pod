"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GripVertical, Plus, ChevronDown, Trash2, Shield, Loader2 } from "lucide-react"
import { VariantsEditor } from "../shared/variants-editor"
import type { ExtraInsurance } from "../types"
import {
  FORM_EXTRA_INSURANCES_SYNC_SOURCE,
  SYNCED_INSURANCE_ID_PREFIX,
  tripInsuranceVariantToExtraInsurance,
  type TripInsuranceVariantRow,
} from "@/lib/insurance-local/sync-form-extra-insurances"
import { toast } from "sonner"

const generateId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`

function insuranceListHasTripVariant(insurances: ExtraInsurance[], tripVariantRowId: string): boolean {
  const prefixed = `${SYNCED_INSURANCE_ID_PREFIX}${tripVariantRowId}`
  return insurances.some(
    (i) =>
      i.id === prefixed ||
      (i.source === FORM_EXTRA_INSURANCES_SYNC_SOURCE && i.source_id === tripVariantRowId),
  )
}

interface InsurancesSectionProps {
  insurances: ExtraInsurance[]
  setInsurances: (insurances: ExtraInsurance[] | ((prev: ExtraInsurance[]) => ExtraInsurance[])) => void
  expandedIds: Set<string>
  setExpandedIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  /** Ustawione w trybie edycji — umożliwia dodanie wariantów Typ 2 z modułu Ubezpieczenia. */
  tripId?: string | null
}

export function InsurancesSection({
  insurances,
  setInsurances,
  expandedIds,
  setExpandedIds,
  tripId,
}: InsurancesSectionProps) {
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({})
  const [tripConfigRows, setTripConfigRows] = useState<TripInsuranceVariantRow[]>([])
  const [loadingTripInsurances, setLoadingTripInsurances] = useState(false)
  const [pickTripVariantId, setPickTripVariantId] = useState<string>("")

  useEffect(() => {
    if (!tripId) {
      setTripConfigRows([])
      setPickTripVariantId("")
      return
    }
    let cancelled = false
    setLoadingTripInsurances(true)
    fetch(`/api/insurance-local/trip-config/${tripId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (cancelled) return
        const arr = Array.isArray(data) ? (data as TripInsuranceVariantRow[]) : []
        setTripConfigRows(arr)
      })
      .catch(() => {
        if (!cancelled) setTripConfigRows([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTripInsurances(false)
      })
    return () => {
      cancelled = true
    }
  }, [tripId])

  const type2TripVariants = useMemo(
    () =>
      tripConfigRows.filter(
        (row) => row.insurance_variants?.type === 2 && row.insurance_variants,
      ),
    [tripConfigRows],
  )

  const addableType2Variants = useMemo(
    () => type2TripVariants.filter((row) => !insuranceListHasTripVariant(insurances, row.id)),
    [type2TripVariants, insurances],
  )

  const handleAddFromInsuranceModule = () => {
    if (!pickTripVariantId) {
      toast.error("Wybierz wariant z listy")
      return
    }
    const row = type2TripVariants.find((r) => r.id === pickTripVariantId)
    if (!row) return
    const entry = tripInsuranceVariantToExtraInsurance(row)
    if (!entry) {
      toast.error("Nie udało się zbudować pozycji ubezpieczenia")
      return
    }
    const mapped: ExtraInsurance = {
      id: entry.id,
      title: entry.title,
      description: entry.description ?? "",
      owu_url: entry.owu_url ?? "",
      price_cents: entry.price_cents ?? null,
      variants: entry.variants,
      enabled: entry.enabled !== false,
      source: entry.source,
      source_id: entry.source_id,
      insurance_type: entry.insurance_type,
    }
    setInsurances((prev) => [...prev, mapped])
    setExpandedIds((prev) => new Set([...prev, mapped.id]))
    setPickTripVariantId("")
    toast.success("Dodano ubezpieczenie z modułu Ubezpieczenia")
  }

  return (
    <Card className="p-3 space-y-2 mt-2">
      <CardHeader className="px-0 pt-0 pb-1">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Ubezpieczenia
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              Klient wybiera jedną z listy. Domyślnie ubezpieczenia są darmowe. Warianty{" "}
              <strong className="font-medium text-foreground">Typ 2 — Dodatkowe</strong> zdefiniowane w{" "}
              <Link href="/trip-dashboard/ubezpieczenia" className="underline underline-offset-2">
                Ubezpieczeniach
              </Link>{" "}
              możesz dodać poniżej jednym kliknięciem.
            </p>
            {insurances.filter(i => i.enabled !== false).length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1 font-medium">
                ⚠️ Ta sekcja nie wyświetla się w formularzu, ponieważ nie ma żadnego włączonego ubezpieczenia.
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {insurances.filter(i => i.enabled !== false).length} z {insurances.length} aktywnych
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-2">
        <div className="space-y-2">
          {insurances.map((item, index) => {
            const isExpanded = expandedIds.has(item.id)
            const isEnabled = item.enabled !== false
            const hasVariants = item.variants && item.variants.length > 0
            const currentPriceInput =
              priceInputs[item.id] ??
              (item.price_cents != null
                ? String(item.price_cents / 100).replace(".", ",")
                : "")
            const displayPrice = hasVariants
              ? `od ${(Math.min(...item.variants!.map(v => v.price_cents || 0)) / 100).toFixed(2)} PLN`
              : item.price_cents != null && item.price_cents > 0
              ? `${(item.price_cents / 100).toFixed(2)} PLN`
              : "Bezpłatne"
            return (
              <div
                key={item.id || index}
                className={`border rounded-md ${isEnabled ? 'bg-green-50/50 border-green-200' : 'bg-gray-50/50 border-gray-200'}`}
              >
                <div className="flex items-center gap-2 p-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex flex-wrap items-center gap-2">
                      <span>{item.title || `Ubezpieczenie ${index + 1}`}</span>
                      {item.source === FORM_EXTRA_INSURANCES_SYNC_SOURCE && (
                        <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
                          Moduł Ubezpieczenia
                          {item.insurance_type === 2 ? " · Typ 2" : item.insurance_type === 3 ? " · KR" : ""}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{item.description || "Brak opisu"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{displayPrice}</span>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => {
                        setInsurances((prev) =>
                          prev.map((insurance, i) =>
                            i === index
                              ? { ...insurance, enabled: checked }
                              : insurance
                          )
                        )
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setExpandedIds((prev) => {
                          const newSet = new Set(prev)
                          if (newSet.has(item.id)) {
                            newSet.delete(item.id)
                          } else {
                            newSet.add(item.id)
                          }
                          return newSet
                        })
                      }}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() =>
                        setInsurances((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t bg-white p-3 space-y-3">
                    <div className="grid gap-1">
                      <Label className="text-xs">Tytuł</Label>
                      <Input
                        value={item.title}
                        disabled={item.source === FORM_EXTRA_INSURANCES_SYNC_SOURCE}
                        onChange={(e) => {
                          const value = e.target.value
                          setInsurances((prev) =>
                            prev.map((insurance, i) =>
                              i === index
                                ? { ...insurance, title: value }
                                : insurance
                            )
                          )
                        }}
                        className="h-8 text-xs"
                      />
                      {item.source === FORM_EXTRA_INSURANCES_SYNC_SOURCE && (
                        <p className="text-[10px] text-muted-foreground">
                          Tytuł pochodzi z katalogu wariantów w module Ubezpieczenia — edytuj go tam lub zmień cenę
                          przypisaną do wycieczki.
                        </p>
                      )}
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Opis</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) => {
                          const value = e.target.value
                          setInsurances((prev) =>
                            prev.map((insurance, i) =>
                              i === index
                                ? { ...insurance, description: value }
                                : insurance
                            )
                          )
                        }}
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Link do OWU</Label>
                      <Input
                        value={item.owu_url}
                        onChange={(e) => {
                          const value = e.target.value
                          setInsurances((prev) =>
                            prev.map((insurance, i) =>
                              i === index
                                ? { ...insurance, owu_url: value }
                                : insurance
                            )
                          )
                        }}
                        placeholder="https://..."
                        className="h-8 text-xs"
                      />
                    </div>
                    {(!item.variants || item.variants.length === 0) &&
                      item.source !== FORM_EXTRA_INSURANCES_SYNC_SOURCE && (
                      <div className="grid gap-1">
                        <Label className="text-xs">Cena (PLN)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={currentPriceInput}
                          onChange={(e) => {
                            const raw = e.target.value
                            setPriceInputs((prev) => ({
                              ...prev,
                              [item.id]: raw,
                            }))
                          }}
                          onBlur={() => {
                            const raw =
                              priceInputs[item.id] ??
                              (item.price_cents != null
                                ? String(item.price_cents / 100).replace(".", ",")
                                : "")
                            const normalized = raw.replace(",", ".").replace(/\s/g, "")
                            if (normalized.trim() === "") {
                              setInsurances((prev) =>
                                prev.map((insurance, i) =>
                                  i === index
                                    ? { ...insurance, price_cents: null }
                                    : insurance
                                )
                              )
                              return
                            }
                            const num = Number(normalized)
                            if (Number.isNaN(num)) return
                            const cents = Math.round(num * 100)
                            setInsurances((prev) =>
                              prev.map((insurance, i) =>
                                i === index
                                  ? { ...insurance, price_cents: cents }
                                  : insurance
                              )
                            )
                          }}
                          placeholder="0.00"
                          className="h-8 text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Jeśli ubezpieczenie ma warianty, użyj sekcji poniżej zamiast tego pola.
                        </p>
                      </div>
                    )}
                    {item.source === FORM_EXTRA_INSURANCES_SYNC_SOURCE ? (
                      <div className="border-t pt-2 mt-2 space-y-1">
                        <Label className="text-xs">Cena w rezerwacji</Label>
                        <p className="text-xs text-muted-foreground">
                          {item.price_cents != null && item.price_cents > 0
                            ? `${(item.price_cents / 100).toFixed(2)} PLN (z modułu Ubezpieczenia${
                                item.insurance_type === 3 ? ", KR (Typ 3)" : ", Typ 2"
                              })`
                            : "Bezpłatne / w cenie — zgodnie z ustawieniami w module Ubezpieczenia"}
                        </p>
                      </div>
                    ) : (
                      <VariantsEditor
                        variants={item.variants || []}
                        onVariantsChange={(variants) => {
                          setInsurances((prev) =>
                            prev.map((insurance, i) =>
                              i === index ? { ...insurance, variants } : insurance
                            )
                          )
                        }}
                        label="Warianty ubezpieczenia (opcjonalne)"
                        description="Jeśli ubezpieczenie ma kilka wariantów, dodaj je tutaj. Jeśli nie, uczestnik wybierze tylko Tak/Nie."
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {tripId ? (
            <div className="rounded-md border border-dashed bg-muted/25 p-3 space-y-2">
              <Label className="text-xs font-semibold">Z modułu Ubezpieczenia (Typ 2 — Dodatkowe)</Label>
              <p className="text-[10px] text-muted-foreground">
                Tu znajdziesz warianty dodane w zakładce{" "}
                <Link href="/trip-dashboard/ubezpieczenia" className="underline underline-offset-2">
                  Ubezpieczenia → Typ 2
                </Link>
                . Dodanie pozycji tutaj kopiuje ją do listy ubezpieczeń w formularzu publicznym (możesz potem uzupełnić OWU i opis).
              </p>
              {loadingTripInsurances ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  Wczytywanie wariantów…
                </div>
              ) : type2TripVariants.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  Nie ma jeszcze wariantów Typ 2 przypisanych do tej wycieczki.{" "}
                  <Link href="/trip-dashboard/ubezpieczenia" className="underline underline-offset-2">
                    Skonfiguruj je w Ubezpieczeniach
                  </Link>
                  .
                </p>
              ) : addableType2Variants.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  Wszystkie warianty Typ 2 z modułu Ubezpieczenia są już na liście poniżej (albo zostały zsynchronizowane automatycznie).
                </p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                  <div className="flex-1 space-y-1 min-w-0">
                    <Label className="text-[10px] text-muted-foreground">Wariant</Label>
                    <Select value={pickTripVariantId || undefined} onValueChange={setPickTripVariantId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Wybierz wariant Typ 2…" />
                      </SelectTrigger>
                      <SelectContent>
                        {addableType2Variants.map((row) => {
                          const iv = row.insurance_variants!
                          const label = [iv.name, iv.provider].filter(Boolean).join(" — ")
                          const priceLabel =
                            row.price_grosz != null
                              ? `${(row.price_grosz / 100).toFixed(2)} PLN`
                              : "—"
                          return (
                            <SelectItem key={row.id} value={row.id}>
                              {label} ({priceLabel})
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs shrink-0"
                    onClick={handleAddFromInsuranceModule}
                  >
                    Dodaj do listy
                  </Button>
                </div>
              )}
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs border-dashed w-full"
            onClick={() => {
              const newId = generateId()
              setInsurances((prev) => [
                ...prev,
                {
                  id: newId,
                  title: "",
                  description: "",
                  owu_url: "",
                  price_cents: null,
                  enabled: true,
                },
              ])
              setExpandedIds((prev) => new Set([...prev, newId]))
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj ubezpieczenie
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
