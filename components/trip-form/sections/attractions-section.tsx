"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GripVertical, Plus, ChevronDown, Trash2, MapPin } from "lucide-react"
import type { AdditionalAttraction } from "../types"

const generateId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`

interface AttractionsSectionProps {
  attractions: AdditionalAttraction[]
  setAttractions: (attractions: AdditionalAttraction[] | ((prev: AdditionalAttraction[]) => AdditionalAttraction[])) => void
  expandedIds: Set<string>
  setExpandedIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void
}

export function AttractionsSection({
  attractions,
  setAttractions,
  expandedIds,
  setExpandedIds,
}: AttractionsSectionProps) {
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({})

  return (
    <Card className="p-3 space-y-2 mt-2">
      <CardHeader className="px-0 pt-0 pb-1">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Atrakcje
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              Klient wybiera jedną z listy. Domyślnie atrakcje są darmowe.
            </p>
            {attractions.filter(a => a.enabled !== false).length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1 font-medium">
                ⚠️ Ta sekcja nie wyświetla się w formularzu, ponieważ nie ma żadnej włączonej atrakcji.
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {attractions.filter(a => a.enabled !== false).length} z {attractions.length} aktywnych
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-2">
        <div className="space-y-2">
          {attractions.map((item, index) => {
            const isExpanded = expandedIds.has(item.id)
            const isEnabled = item.enabled !== false
            const currentPriceInput =
              priceInputs[item.id] ??
              (item.price_cents != null
                ? String(item.price_cents / 100).replace(".", ",")
                : "")
            return (
              <div
                key={item.id || index}
                className={`border rounded-md ${isEnabled ? 'bg-green-50/50 border-green-200' : 'bg-gray-50/50 border-gray-200'}`}
              >
                <div className="flex items-center gap-2 p-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{item.title || `Atrakcja ${index + 1}`}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{item.description || "Brak opisu"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {item.price_cents != null
                        ? `${(item.price_cents / 100).toFixed(2)} ${item.currency || "PLN"}`
                        : "0.00 PLN"}
                    </span>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => {
                        setAttractions((prev) =>
                          prev.map((attraction, i) =>
                            i === index
                              ? { ...attraction, enabled: checked }
                              : attraction
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
                        setAttractions((prev) =>
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
                        onChange={(e) => {
                          const value = e.target.value
                          setAttractions((prev) =>
                            prev.map((attraction, i) =>
                              i === index
                                ? { ...attraction, title: value }
                                : attraction
                            )
                          )
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Opis</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) => {
                          const value = e.target.value
                          setAttractions((prev) =>
                            prev.map((attraction, i) =>
                              i === index
                                ? { ...attraction, description: value }
                                : attraction
                            )
                          )
                        }}
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Cena</Label>
                      <div className="flex gap-2">
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
                              setAttractions((prev) =>
                                prev.map((attraction, i) =>
                                  i === index
                                    ? { ...attraction, price_cents: null }
                                    : attraction
                                )
                              )
                              return
                            }
                            const num = Number(normalized)
                            if (Number.isNaN(num)) return
                            const cents = Math.round(num * 100)
                            setAttractions((prev) =>
                              prev.map((attraction, i) =>
                                i === index
                                  ? { ...attraction, price_cents: cents }
                                  : attraction
                              )
                            )
                          }}
                          placeholder="0.00"
                          className="h-8 text-xs flex-1"
                        />
                        <Select
                          value={item.currency || "PLN"}
                          onValueChange={(value: "PLN" | "EUR" | "CZK" | "USD" | "HUF" | "GBP" | "DKK") => {
                            setAttractions((prev) =>
                              prev.map((attraction, i) =>
                                i === index
                                  ? { ...attraction, currency: value }
                                  : attraction
                              )
                            )
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PLN">PLN</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="CZK">CZK</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="HUF">HUF</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="DKK">DKK</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`include-in-contract-${index}`}
                        checked={item.include_in_contract ?? true}
                        onCheckedChange={(checked) =>
                          setAttractions((prev) =>
                            prev.map((attraction, i) =>
                              i === index
                                ? { ...attraction, include_in_contract: Boolean(checked) }
                                : attraction
                            )
                          )
                        }
                        className="h-4 w-4"
                      />
                      <Label
                        htmlFor={`include-in-contract-${index}`}
                        className="text-xs cursor-pointer"
                      >
                        Wliczać do ceny w umowie (tylko dla PLN)
                      </Label>
                    </div>
                    {item.currency && item.currency !== "PLN" && (
                      <p className="text-[10px] text-muted-foreground">
                        Atrakcje w {item.currency} nie są wliczane do umowy
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs border-dashed w-full"
            onClick={() => {
              const newId = generateId()
              setAttractions((prev) => [
                ...prev,
                {
                  id: newId,
                  title: "",
                  description: "",
                  price_cents: null,
                  include_in_contract: true,
                  currency: "PLN",
                  enabled: true,
                },
              ])
              setExpandedIds((prev) => new Set([...prev, newId]))
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj atrakcję
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
