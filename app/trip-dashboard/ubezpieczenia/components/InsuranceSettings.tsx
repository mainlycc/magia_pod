"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { IconPlus, IconEdit } from "@tabler/icons-react"
import { EmailTemplate, InsuranceVariant } from "../types"

const TYPE_LABELS: Record<number, string> = {
  1: "Typ 1 — Podstawowe (PZU)",
  2: "Typ 2 — Dodatkowe medyczne (TU Europa)",
  3: "Typ 3 — KR (TU Europa)",
}

const TAGS_BY_TYPE: Record<number, string[]> = {
  1: ["{wariant_ubezpieczenia}", "{termin_od_do}", "{termin}", "{kraj}", "{tytul_wycieczki}", "{kod_wycieczki}", "{liczba_osob}"],
  2: ["{wariant_ubezpieczenia}", "{termin_od_do}", "{kraj}", "{tytul_wycieczki}", "{kod_wycieczki}", "{liczba_osob}"],
  3: ["{data_raportu}", "{data_poprzedniego_dnia}", "{lista_umow}", "{liczba_ubezpieczen}"],
}

export function InsuranceSettings() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [allVariants, setAllVariants] = useState<InsuranceVariant[]>([])
  const [loadingInit, setLoadingInit] = useState(true)

  // Stan edycji szablonów
  const [savingTemplate, setSavingTemplate] = useState<number | null>(null)
  const [editedTemplates, setEditedTemplates] = useState<Record<number, Partial<EmailTemplate>>>({})

  // Dialog: nowy wariant
  const [addVariantOpen, setAddVariantOpen] = useState(false)
  const [newVariant, setNewVariant] = useState({
    type: "" as "" | "1" | "2" | "3",
    name: "",
    provider: "",
    description: "",
  })
  const [addVariantLoading, setAddVariantLoading] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoadingInit(true)
    const [templatesRes, variantsRes] = await Promise.all([
      fetch("/api/insurance-local/email-templates"),
      fetch("/api/insurance-local/variants?active_only=false"),
    ])
    if (templatesRes.ok) setTemplates(await templatesRes.json())
    if (variantsRes.ok) setAllVariants(await variantsRes.json())
    setLoadingInit(false)
  }

  function getTemplateValue(type: 1 | 2 | 3, field: keyof EmailTemplate): string {
    const edited = editedTemplates[type]
    if (edited && field in edited) return edited[field] as string
    const t = templates.find((t) => t.type === type)
    return t ? (t[field] as string) || "" : ""
  }

  function setTemplateField(type: 1 | 2 | 3, field: keyof EmailTemplate, value: string) {
    setEditedTemplates((prev) => ({
      ...prev,
      [type]: { ...(prev[type] || {}), [field]: value },
    }))
  }

  async function handleSaveTemplate(type: 1 | 2 | 3) {
    const template = templates.find((t) => t.type === type)
    if (!template) return
    const changes = editedTemplates[type]
    if (!changes || Object.keys(changes).length === 0) {
      toast.info("Brak zmian do zapisania")
      return
    }
    setSavingTemplate(type)
    try {
      const res = await fetch(`/api/insurance-local/email-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTemplates((prev) => prev.map((t) => (t.type === type ? data : t)))
      setEditedTemplates((prev) => {
        const next = { ...prev }
        delete next[type]
        return next
      })
      toast.success("Szablon zapisany")
    } catch (err) {
      toast.error("Błąd zapisu szablonu: " + String(err))
    } finally {
      setSavingTemplate(null)
    }
  }

  async function handleToggleVariant(variant: InsuranceVariant) {
    try {
      const res = await fetch(`/api/insurance-local/variants/${variant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !variant.is_active }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setAllVariants((prev) =>
        prev.map((v) => (v.id === variant.id ? { ...v, is_active: !v.is_active } : v))
      )
      toast.success(variant.is_active ? "Wariant dezaktywowany" : "Wariant aktywowany")
    } catch (err) {
      toast.error("Błąd: " + String(err))
    }
  }

  async function handleAddVariant() {
    if (!newVariant.type || !newVariant.name || !newVariant.provider) {
      toast.error("Typ, nazwa i dostawca są wymagane")
      return
    }
    setAddVariantLoading(true)
    try {
      const res = await fetch("/api/insurance-local/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: parseInt(newVariant.type),
          name: newVariant.name,
          provider: newVariant.provider,
          description: newVariant.description || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAllVariants((prev) => [...prev, data])
      setAddVariantOpen(false)
      setNewVariant({ type: "", name: "", provider: "", description: "" })
      toast.success("Wariant dodany do słownika")
    } catch (err) {
      toast.error("Błąd dodawania: " + String(err))
    } finally {
      setAddVariantLoading(false)
    }
  }

  if (loadingInit) {
    return <div className="text-sm text-muted-foreground">Ładowanie ustawień...</div>
  }

  return (
    <div className="space-y-8">
      {/* Szablony emaili */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Szablony emaili</h3>
          <p className="text-sm text-muted-foreground">
            Edytuj treść i adresy odbiorców dla każdego typu ubezpieczenia.
            Dostępne tagi systemowe zostaną zastąpione rzeczywistymi wartościami podczas wysyłki.
          </p>
        </div>

        <Tabs defaultValue="1">
          <TabsList>
            <TabsTrigger value="1">Typ 1</TabsTrigger>
            <TabsTrigger value="2">Typ 2</TabsTrigger>
            <TabsTrigger value="3">Typ 3</TabsTrigger>
          </TabsList>

          {([1, 2, 3] as const).map((type) => (
            <TabsContent key={type} value={String(type)}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {TYPE_LABELS[type]}
                  </CardTitle>
                  {type === 2 && (
                    <CardDescription>
                      Wysyłany wyłącznie do biura (bez ubezpieczalni).
                    </CardDescription>
                  )}
                  {type === 3 && (
                    <CardDescription>
                      Raport dzienny — wysyłany o 09:00 lub ręcznie.
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tagi */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dostępne tagi systemowe</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {TAGS_BY_TYPE[type].map((tag) => (
                        <Badge key={tag} variant="outline" className="font-mono text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Adres DO */}
                  <div className="space-y-1.5">
                    <Label>Adres DO {type === 1 ? "(ubezpieczalnia)" : "(biuro)"}</Label>
                    <Input
                      type="email"
                      value={getTemplateValue(type, "to_email")}
                      onChange={(e) => setTemplateField(type, "to_email", e.target.value)}
                      placeholder="adres@email.pl"
                    />
                  </div>

                  {/* Adres DW (tylko Typ 1) */}
                  {type === 1 && (
                    <div className="space-y-1.5">
                      <Label>Adres DW/CC (biuro)</Label>
                      <Input
                        type="email"
                        value={getTemplateValue(type, "cc_email")}
                        onChange={(e) => setTemplateField(type, "cc_email", e.target.value)}
                        placeholder="biuro@email.pl"
                      />
                    </div>
                  )}

                  {/* Temat */}
                  <div className="space-y-1.5">
                    <Label>Temat</Label>
                    <Input
                      value={getTemplateValue(type, "subject_template")}
                      onChange={(e) => setTemplateField(type, "subject_template", e.target.value)}
                      placeholder="Temat emaila z tagami..."
                    />
                  </div>

                  {/* Treść */}
                  <div className="space-y-1.5">
                    <Label>Treść</Label>
                    <Textarea
                      rows={8}
                      value={getTemplateValue(type, "body_template")}
                      onChange={(e) => setTemplateField(type, "body_template", e.target.value)}
                      placeholder="Treść emaila z tagami systemowymi..."
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSaveTemplate(type)}
                      disabled={savingTemplate === type}
                    >
                      {savingTemplate === type ? "Zapisywanie..." : "Zapisz szablon"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Słownik wariantów */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Słownik wariantów ubezpieczeń</h3>
            <p className="text-sm text-muted-foreground">
              Globalna lista wariantów dostępnych do przypisania do wycieczek.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAddVariantOpen(true)}>
            <IconPlus className="h-4 w-4 mr-1.5" />
            Dodaj wariant
          </Button>
        </div>

        {([1, 2, 3] as const).map((type) => {
          const variants = allVariants.filter((v) => v.type === type)
          return (
            <Card key={type}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{TYPE_LABELS[type]}</CardTitle>
              </CardHeader>
              <CardContent>
                {variants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brak wariantów</p>
                ) : (
                  <div className="space-y-2">
                    {variants.map((v) => (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between rounded-md border px-4 py-2.5 ${
                          !v.is_active ? "opacity-50" : ""
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{v.name}</span>
                            {v.is_default && (
                              <Badge variant="secondary" className="text-xs">Domyślny</Badge>
                            )}
                            {!v.is_active && (
                              <Badge variant="outline" className="text-xs">Nieaktywny</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{v.provider}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {v.is_active ? "Aktywny" : "Nieaktywny"}
                          </span>
                          <Switch
                            checked={Boolean(v.is_active)}
                            onCheckedChange={() => handleToggleVariant(v)}
                            aria-label={v.is_active ? "Dezaktywuj wariant" : "Aktywuj wariant"}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Dialog: nowy wariant */}
      <Dialog open={addVariantOpen} onOpenChange={setAddVariantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj nowy wariant do słownika</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Typ ubezpieczenia</Label>
              <Select
                value={newVariant.type}
                onValueChange={(v) => setNewVariant((prev) => ({ ...prev, type: v as "1" | "2" | "3" }))}
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
            <div className="space-y-2">
              <Label>Nazwa wariantu</Label>
              <Input
                value={newVariant.name}
                onChange={(e) => setNewVariant((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="np. PZU Wojażer KL 100 000 PLN"
              />
            </div>
            <div className="space-y-2">
              <Label>Dostawca (TU)</Label>
              <Input
                value={newVariant.provider}
                onChange={(e) => setNewVariant((prev) => ({ ...prev, provider: e.target.value }))}
                placeholder="np. PZU, TU Europa"
              />
            </div>
            <div className="space-y-2">
              <Label>Opis (opcjonalnie)</Label>
              <Input
                value={newVariant.description}
                onChange={(e) => setNewVariant((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Krótki opis wariantu"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddVariantOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleAddVariant} disabled={addVariantLoading}>
              {addVariantLoading ? "Dodawanie..." : "Dodaj do słownika"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
