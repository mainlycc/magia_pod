"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconEdit, IconPlus } from "@tabler/icons-react"
import { FileText, Paperclip } from "lucide-react"
import type { ManagedInsuranceVariant } from "../types"
import { VariantEditorDialog } from "./variant-editor-dialog"

const TYPE_LABELS: Record<number, string> = {
  1: "Typ 1 — Podstawowe (PZU)",
  2: "Typ 2 — Dodatkowe medyczne (TU Europa)",
  3: "Typ 3 — KR (TU Europa)",
}

type Props = {
  variants: ManagedInsuranceVariant[]
  onRefresh: () => void
}

export function VariantsManager({ variants, onRefresh }: Props) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create")
  const [selectedVariant, setSelectedVariant] = useState<ManagedInsuranceVariant | null>(null)

  useEffect(() => {
    if (!selectedVariant) return
    const updated = variants.find((item) => item.id === selectedVariant.id)
    if (updated) setSelectedVariant(updated)
  }, [variants, selectedVariant?.id])

  function openCreate() {
    setEditorMode("create")
    setSelectedVariant(null)
    setEditorOpen(true)
  }

  function openEdit(variant: ManagedInsuranceVariant) {
    setEditorMode("edit")
    setSelectedVariant(variant)
    setEditorOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Warianty ubezpieczeń</h3>
          <p className="text-sm text-muted-foreground">
            Pełny słownik wariantów — nazwa, zakres, sumy, OWU, załączniki i domyślna konfiguracja dla
            nowych wycieczek.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <IconPlus className="h-4 w-4 mr-1.5" />
          Dodaj wariant
        </Button>
      </div>

      {([1, 2, 3] as const).map((type) => {
        const items = variants.filter((item) => item.type === type)
        return (
          <Card key={type}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{TYPE_LABELS[type]}</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak wariantów tego typu</p>
              ) : (
                <div className="space-y-2">
                  {items.map((variant) => {
                    const hasOwu = variant.attachments.some((a) => a.attachment_type === "owu")
                    const otherCount = variant.attachments.filter((a) => a.attachment_type === "other").length
                    const scopePreview = variant.coverage_scope?.trim() || variant.description?.trim()

                    return (
                      <div
                        key={variant.id}
                        className={`flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-start sm:justify-between ${
                          !variant.is_active ? "opacity-60" : ""
                        }`}
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{variant.name}</span>
                            <span className="text-xs text-muted-foreground">({variant.provider})</span>
                            {variant.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                Domyślny
                              </Badge>
                            )}
                            {!variant.is_active && (
                              <Badge variant="outline" className="text-xs">
                                Nieaktywny
                              </Badge>
                            )}
                            {variant.trip_default.is_enabled && (
                              <Badge variant="default" className="text-xs">
                                Auto przy nowej wycieczce
                              </Badge>
                            )}
                          </div>

                          {scopePreview && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              Zakres: {scopePreview}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {hasOwu ? (
                              <span className="inline-flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" />
                                OWU
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-500">Brak OWU</span>
                            )}
                            {otherCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Paperclip className="h-3.5 w-3.5" />
                                {otherCount} załącznik{otherCount === 1 ? "" : "i"}
                              </span>
                            )}
                            {variant.type !== 1 && variant.trip_default.price_grosz != null && (
                              <span>
                                Cena domyślna: {(variant.trip_default.price_grosz / 100).toFixed(2)} zł
                              </span>
                            )}
                          </div>
                        </div>

                        <Button size="sm" variant="outline" onClick={() => openEdit(variant)}>
                          <IconEdit className="h-4 w-4 mr-1.5" />
                          Edytuj
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      <VariantEditorDialog
        open={editorOpen}
        mode={editorMode}
        initial={selectedVariant}
        onOpenChange={setEditorOpen}
        onSaved={onRefresh}
      />
    </div>
  )
}
