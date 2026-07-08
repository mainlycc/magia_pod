"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import type { EmailTemplate } from "../../ubezpieczenia/types"

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

type Props = {
  templates: EmailTemplate[]
  onTemplatesChange: (templates: EmailTemplate[]) => void
}

export function EmailTemplatesManager({ templates, onTemplatesChange }: Props) {
  const [savingTemplate, setSavingTemplate] = useState<number | null>(null)
  const [editedTemplates, setEditedTemplates] = useState<Record<number, Partial<EmailTemplate>>>({})

  function getTemplateValue(type: 1 | 2 | 3, field: keyof EmailTemplate): string {
    const edited = editedTemplates[type]
    if (edited && field in edited) return edited[field] as string
    const t = templates.find((item) => item.type === type)
    return t ? (t[field] as string) || "" : ""
  }

  function setTemplateField(type: 1 | 2 | 3, field: keyof EmailTemplate, value: string) {
    setEditedTemplates((prev) => ({
      ...prev,
      [type]: { ...(prev[type] || {}), [field]: value },
    }))
  }

  async function handleSaveTemplate(type: 1 | 2 | 3) {
    const template = templates.find((item) => item.type === type)
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
      onTemplatesChange(templates.map((item) => (item.type === type ? data : item)))
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Szablony wiadomości</h3>
        <p className="text-sm text-muted-foreground">
          Treść i odbiorcy maili wysyłanych do ubezpieczalni i biura dla każdego typu ubezpieczenia.
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
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="space-y-1.5">
                  <Label>Adres DO {type === 1 ? "(ubezpieczalnia)" : "(biuro)"}</Label>
                  <Input
                    type="email"
                    value={getTemplateValue(type, "to_email")}
                    onChange={(e) => setTemplateField(type, "to_email", e.target.value)}
                    placeholder="adres@email.pl"
                  />
                </div>

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

                <div className="space-y-1.5">
                  <Label>Temat</Label>
                  <Input
                    value={getTemplateValue(type, "subject_template")}
                    onChange={(e) => setTemplateField(type, "subject_template", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Treść</Label>
                  <Textarea
                    rows={8}
                    value={getTemplateValue(type, "body_template")}
                    onChange={(e) => setTemplateField(type, "body_template", e.target.value)}
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
  )
}
