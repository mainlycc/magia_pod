"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react"
import { VARIANT_ATTACHMENT_TYPE_LABELS } from "@/lib/insurance-local/variant-attachments"
import type { ManagedInsuranceVariant } from "../types"

const TYPE_LABELS: Record<number, string> = {
  1: "Typ 1 — Podstawowe (PZU)",
  2: "Typ 2 — Dodatkowe medyczne",
  3: "Typ 3 — KR",
}

type Props = {
  open: boolean
  mode: "create" | "edit"
  initial?: ManagedInsuranceVariant | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

function formatPriceGrosz(value: number | null): string {
  if (value == null) return ""
  return (value / 100).toFixed(2)
}

function parsePriceGrosz(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = parseFloat(trimmed.replace(",", "."))
  if (Number.isNaN(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

const emptyCreateForm = () => ({
  type: "" as "" | "1" | "2" | "3",
  name: "",
  provider: "",
  description: "",
  coverage_scope: "",
  is_default: false,
  is_active: true,
  trip_default_enabled: false,
  trip_default_price_grosz: null as number | null,
})

export function VariantEditorDialog({ open, mode, initial, onOpenChange, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [uploadingType, setUploadingType] = useState<"owu" | "other" | null>(null)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [editForm, setEditForm] = useState({
    name: "",
    provider: "",
    description: "",
    coverage_scope: "",
    is_default: false,
    is_active: true,
    trip_default_enabled: false,
    trip_default_price_grosz: null as number | null,
  })

  const owuInputRef = useRef<HTMLInputElement>(null)
  const otherInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && initial) {
      setEditForm({
        name: initial.name,
        provider: initial.provider,
        description: initial.description || "",
        coverage_scope: initial.coverage_scope || "",
        is_default: initial.is_default,
        is_active: initial.is_active,
        trip_default_enabled: initial.trip_default.is_enabled,
        trip_default_price_grosz: initial.trip_default.price_grosz,
      })
    }
    if (mode === "create") {
      setCreateForm(emptyCreateForm())
    }
  }, [open, mode, initial])

  async function saveTripDefault(variantId: string, type: number) {
    const enabled = mode === "create" ? createForm.trip_default_enabled : editForm.trip_default_enabled
    const priceGrosz =
      mode === "create" ? createForm.trip_default_price_grosz : editForm.trip_default_price_grosz

    const res = await fetch("/api/insurance-local/trip-defaults", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            variant_id: variantId,
            is_enabled: enabled,
            price_grosz: type === 1 ? null : priceGrosz,
          },
        ],
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "trip_default_save_failed")
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (mode === "create") {
        if (!createForm.type || !createForm.name || !createForm.provider) {
          toast.error("Typ, nazwa i dostawca są wymagane")
          return
        }

        const res = await fetch("/api/insurance-local/variants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: parseInt(createForm.type, 10),
            name: createForm.name,
            provider: createForm.provider,
            description: createForm.description || null,
            coverage_scope: createForm.coverage_scope || null,
            is_default: createForm.is_default,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        await saveTripDefault(data.id, data.type)
        toast.success("Wariant dodany")
      } else if (initial) {
        const res = await fetch(`/api/insurance-local/variants/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editForm.name,
            provider: editForm.provider,
            description: editForm.description || null,
            coverage_scope: editForm.coverage_scope || null,
            is_default: editForm.is_default,
            is_active: editForm.is_active,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        await saveTripDefault(initial.id, initial.type)
        toast.success("Wariant zapisany")
      }

      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error("Błąd zapisu: " + String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(attachmentType: "owu" | "other", file: File) {
    if (!initial?.id) return

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Tylko pliki PDF są dozwolone")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Plik jest zbyt duży (maksymalnie 10MB)")
      return
    }

    setUploadingType(attachmentType)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("attachment_type", attachmentType)
      formData.append(
        "display_name",
        attachmentType === "owu" ? `OWU ${initial.name}` : file.name.replace(/\.pdf$/i, ""),
      )

      const res = await fetch(`/api/insurance-local/variants/${initial.id}/attachments`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "upload_failed")
      }

      toast.success("Załącznik wgrany")
      onSaved()
    } catch (err) {
      toast.error("Błąd wgrywania: " + String(err))
    } finally {
      setUploadingType(null)
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!initial?.id) return
    if (!confirm("Usunąć ten załącznik?")) return

    try {
      const res = await fetch(
        `/api/insurance-local/variants/${initial.id}/attachments/${attachmentId}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error("delete_failed")
      toast.success("Załącznik usunięty")
      onSaved()
    } catch {
      toast.error("Nie udało się usunąć załącznika")
    }
  }

  const variantType = mode === "edit" ? initial?.type : createForm.type ? parseInt(createForm.type, 10) : null
  const attachments = initial?.attachments || []
  const owuAttachment = attachments.find((item) => item.attachment_type === "owu")
  const otherAttachments = attachments.filter((item) => item.attachment_type === "other")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Dodaj wariant ubezpieczenia" : "Edytuj wariant ubezpieczenia"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {mode === "create" ? (
            <>
              <div className="space-y-2">
                <Label>Typ ubezpieczenia *</Label>
                <Select
                  value={createForm.type}
                  onValueChange={(v) => setCreateForm((prev) => ({ ...prev, type: v as "1" | "2" | "3" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz typ..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Typ 1 — Podstawowe (PZU)</SelectItem>
                    <SelectItem value="2">Typ 2 — Dodatkowe medyczne</SelectItem>
                    <SelectItem value="3">Typ 3 — KR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nazwa wariantu *</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dostawca (TU) *</Label>
                  <Input
                    value={createForm.provider}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, provider: e.target.value }))}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline">{initial ? TYPE_LABELS[initial.type] : ""}</Badge>
              {!initial?.is_active && <Badge variant="secondary">Nieaktywny</Badge>}
            </div>
          )}

          {mode === "edit" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nazwa wariantu *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Dostawca (TU) *</Label>
                <Input
                  value={editForm.provider}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, provider: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Opis (krótki — formularz rezerwacji)</Label>
            <Textarea
              rows={2}
              value={mode === "create" ? createForm.description : editForm.description}
              onChange={(e) =>
                mode === "create"
                  ? setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                  : setEditForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Krótki opis widoczny dla klienta"
            />
          </div>

          <div className="space-y-2">
            <Label>Zakres i sumy ubezpieczenia</Label>
            <Textarea
              rows={3}
              value={mode === "create" ? createForm.coverage_scope : editForm.coverage_scope}
              onChange={(e) =>
                mode === "create"
                  ? setCreateForm((prev) => ({ ...prev, coverage_scope: e.target.value }))
                  : setEditForm((prev) => ({ ...prev, coverage_scope: e.target.value }))
              }
              placeholder="np. KL 80 000 PLN, NNW 10 000 PLN, CP, OC"
            />
            <p className="text-xs text-muted-foreground">
              Wyświetlane w umowie (placeholder {"{{insurance_scope}}"}) oraz jako zakres wariantu.
            </p>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <Label className="text-sm font-medium">Domyślna konfiguracja nowych wycieczek</Label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Przypisz automatycznie przy tworzeniu wycieczki</span>
              <Switch
                checked={mode === "create" ? createForm.trip_default_enabled : editForm.trip_default_enabled}
                onCheckedChange={(checked) =>
                  mode === "create"
                    ? setCreateForm((prev) => ({ ...prev, trip_default_enabled: checked }))
                    : setEditForm((prev) => ({ ...prev, trip_default_enabled: checked }))
                }
              />
            </div>
            {variantType !== 1 && (
              <div className="flex items-center gap-2">
                <Label htmlFor="default-price" className="text-sm whitespace-nowrap">
                  Domyślna cena (PLN)
                </Label>
                <Input
                  id="default-price"
                  className="h-8 w-32"
                  inputMode="decimal"
                  disabled={
                    !(mode === "create" ? createForm.trip_default_enabled : editForm.trip_default_enabled)
                  }
                  value={formatPriceGrosz(
                    mode === "create"
                      ? createForm.trip_default_price_grosz
                      : editForm.trip_default_price_grosz,
                  )}
                  onChange={(e) => {
                    const price = parsePriceGrosz(e.target.value)
                    if (mode === "create") {
                      setCreateForm((prev) => ({ ...prev, trip_default_price_grosz: price }))
                    } else {
                      setEditForm((prev) => ({ ...prev, trip_default_price_grosz: price }))
                    }
                  }}
                  placeholder="0.00"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="variant-active"
                checked={mode === "create" ? createForm.is_active : editForm.is_active}
                disabled={mode === "create"}
                onCheckedChange={(checked) =>
                  setEditForm((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label htmlFor="variant-active">Aktywny w słowniku</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="variant-default"
                checked={mode === "create" ? createForm.is_default : editForm.is_default}
                onCheckedChange={(checked) =>
                  mode === "create"
                    ? setCreateForm((prev) => ({ ...prev, is_default: checked }))
                    : setEditForm((prev) => ({ ...prev, is_default: checked }))
                }
              />
              <Label htmlFor="variant-default">Oznacz jako domyślny</Label>
            </div>
          </div>

          {mode === "edit" && initial && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-medium">Załączniki wariantu</Label>

                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{VARIANT_ATTACHMENT_TYPE_LABELS.owu}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploadingType === "owu"}
                      onClick={() => owuInputRef.current?.click()}
                    >
                      {uploadingType === "owu" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1.5" />
                          {owuAttachment ? "Zmień OWU" : "Wgraj OWU"}
                        </>
                      )}
                    </Button>
                    <input
                      ref={owuInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleUpload("owu", file)
                        e.target.value = ""
                      }}
                    />
                  </div>
                  {owuAttachment ? (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="text-sm truncate flex-1">
                        {owuAttachment.display_name || "OWU"}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => window.open(owuAttachment.url, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDeleteAttachment(owuAttachment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Brak pliku OWU dla tego wariantu</p>
                  )}
                </div>

                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Inne załączniki PDF</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploadingType === "other"}
                      onClick={() => otherInputRef.current?.click()}
                    >
                      {uploadingType === "other" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1.5" />
                          Dodaj załącznik
                        </>
                      )}
                    </Button>
                    <input
                      ref={otherInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleUpload("other", file)
                        e.target.value = ""
                      }}
                    />
                  </div>
                  {otherAttachments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Brak dodatkowych załączników</p>
                  ) : (
                    <div className="space-y-2">
                      {otherAttachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="text-sm truncate flex-1">
                            {attachment.display_name || attachment.file_name.split("/").pop()}
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => window.open(attachment.url, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDeleteAttachment(attachment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Zapisywanie..." : mode === "create" ? "Dodaj wariant" : "Zapisz zmiany"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
