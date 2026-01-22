"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { GripVertical, Plus, ChevronDown, Trash2, Utensils } from "lucide-react"
import { VariantsEditor } from "../shared/variants-editor"
import type { Diet } from "../types"

const generateId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`

interface DietsSectionProps {
  diets: Diet[]
  setDiets: (diets: Diet[] | ((prev: Diet[]) => Diet[])) => void
  expandedIds: Set<string>
  setExpandedIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void
}

export function DietsSection({
  diets,
  setDiets,
  expandedIds,
  setExpandedIds,
}: DietsSectionProps) {
  return (
    <Card className="p-3 space-y-2 mt-2">
      <CardHeader className="px-0 pt-0 pb-1">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              Diety
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              Klient wybiera jedną z listy. Domyślnie diety są darmowe.
            </p>
            {diets.filter(d => d.enabled !== false).length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1 font-medium">
                ⚠️ Ta sekcja nie wyświetla się w formularzu, ponieważ nie ma żadnej włączonej diety.
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {diets.filter(d => d.enabled !== false).length} z {diets.length} aktywnych
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-2">
        <div className="space-y-2">
          {diets.map((item, index) => {
            const isExpanded = expandedIds.has(item.id)
            const isEnabled = item.enabled !== false
            const hasVariants = item.variants && item.variants.length > 0
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
                    <div className="font-semibold text-sm">{item.title || `Dieta ${index + 1}`}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{item.description || "Brak opisu"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{displayPrice}</span>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => {
                        setDiets((prev) =>
                          prev.map((diet, i) =>
                            i === index
                              ? { ...diet, enabled: checked }
                              : diet
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
                        setDiets((prev) => prev.filter((_, i) => i !== index))
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
                          setDiets((prev) =>
                            prev.map((diet, i) =>
                              i === index ? { ...diet, title: value } : diet
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
                          setDiets((prev) =>
                            prev.map((diet, i) =>
                              i === index
                                ? { ...diet, description: value }
                                : diet
                            )
                          )
                        }}
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>
                    {(!item.variants || item.variants.length === 0) && (
                      <div className="grid gap-1">
                        <Label className="text-xs">Cena (PLN)</Label>
                        <Input
                          type="number"
                          value={
                            item.price_cents != null
                              ? (item.price_cents / 100).toFixed(2)
                              : ""
                          }
                          onChange={(e) => {
                            const value = e.target.value
                            const cents =
                              value.trim() === ""
                                ? null
                                : Math.round(parseFloat(value) * 100)
                            setDiets((prev) =>
                              prev.map((diet, i) =>
                                i === index
                                  ? { ...diet, price_cents: cents }
                                  : diet
                              )
                            )
                          }}
                          placeholder="0.00"
                          className="h-8 text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Jeśli dieta ma warianty, użyj sekcji poniżej zamiast tego pola.
                        </p>
                      </div>
                    )}
                    <VariantsEditor
                      variants={item.variants || []}
                      onVariantsChange={(variants) => {
                        setDiets((prev) =>
                          prev.map((diet, i) =>
                            i === index ? { ...diet, variants } : diet
                          )
                        )
                      }}
                      label="Warianty diety (opcjonalne)"
                      description="Jeśli dieta ma kilka wariantów (np. wegetariańska bezpłatna, wegańska odpłatna), dodaj je tutaj. Jeśli nie ma wariantów, zostaw puste i ustaw cenę powyżej."
                    />
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
              setDiets((prev) => [
                ...prev,
                {
                  id: newId,
                  title: "",
                  description: "",
                  price_cents: null,
                  enabled: true,
                },
              ])
              setExpandedIds((prev) => new Set([...prev, newId]))
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj dietę
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
