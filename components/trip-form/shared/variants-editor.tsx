"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"

const generateId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`

export interface Variant {
  id: string
  title: string
  price_cents: number | null
}

interface VariantsEditorProps {
  variants: Variant[]
  onVariantsChange: (variants: Variant[]) => void
  label?: string
  description?: string
}

export function VariantsEditor({
  variants,
  onVariantsChange,
  label = "Warianty (opcjonalne)",
  description,
}: VariantsEditorProps) {
  return (
    <div className="border-t pt-2 mt-2">
      <Label className="text-xs font-semibold">{label}</Label>
      {description && (
        <p className="text-[10px] text-muted-foreground mb-2">
          {description}
        </p>
      )}
      <div className="space-y-2">
        {variants.map((variant, variantIndex) => (
          <div key={variant.id || variantIndex} className="flex gap-2 items-end border rounded p-1.5">
            <div className="flex-1 grid gap-1">
              <Label className="text-[10px]">Nazwa wariantu</Label>
              <Input
                value={variant.title}
                onChange={(e) => {
                  const value = e.target.value
                  onVariantsChange(
                    variants.map((v, vi) =>
                      vi === variantIndex ? { ...v, title: value } : v
                    )
                  )
                }}
                className="h-7 text-xs"
                placeholder="np. Wegetariańska"
              />
            </div>
            <div className="w-24 grid gap-1">
              <Label className="text-[10px]">Cena (PLN)</Label>
              <Input
                type="number"
                value={
                  variant.price_cents != null
                    ? (variant.price_cents / 100).toFixed(2)
                    : ""
                }
                onChange={(e) => {
                  const value = e.target.value
                  const cents =
                    value.trim() === ""
                      ? null
                      : Math.round(parseFloat(value) * 100)
                  onVariantsChange(
                    variants.map((v, vi) =>
                      vi === variantIndex ? { ...v, price_cents: cents } : v
                    )
                  )
                }}
                className="h-7 text-xs"
                placeholder="0.00"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() =>
                onVariantsChange(variants.filter((_, vi) => vi !== variantIndex))
              }
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            const newVariant = {
              id: generateId(),
              title: "",
              price_cents: null,
            }
            onVariantsChange([...variants, newVariant])
          }}
        >
          Dodaj wariant
        </Button>
      </div>
    </div>
  )
}
