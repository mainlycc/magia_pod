"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Upload, FileText, Trash2, Loader2, ExternalLink, Mail } from "lucide-react"
import {
  INSURANCE_OWU_TYPES,
  INSURANCE_OWU_TYPE_LABELS,
  type InsuranceOwuType,
  buildDefaultOwuEmailSettings,
} from "@/lib/insurance-local/owu-constants"

type OwuDocument = {
  id?: string
  insurance_type: InsuranceOwuType
  file_name: string
  display_name: string | null
  created_at: string
  updated_at: string
  url?: string
}

const defaultFlags = (): Record<InsuranceOwuType, boolean> => ({ 1: false, 2: false, 3: false })

export function GlobalOwuManager() {
  const [documents, setDocuments] = useState<OwuDocument[]>([])
  const [emailSettings, setEmailSettings] = useState<Record<InsuranceOwuType, boolean>>(
    buildDefaultOwuEmailSettings,
  )
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(defaultFlags)
  const [togglingAttach, setTogglingAttach] = useState(defaultFlags)

  useEffect(() => {
    void loadDocuments()
  }, [])

  async function loadDocuments() {
    try {
      setLoading(true)
      const res = await fetch("/api/insurance-local/owu/global")
      if (!res.ok) {
        throw new Error("Failed to load OWU documents")
      }
      const data = await res.json()
      setDocuments(Array.isArray(data.documents) ? data.documents : [])
      const settings = buildDefaultOwuEmailSettings()
      if (data.email_settings) {
        for (const type of INSURANCE_OWU_TYPES) {
          if (typeof data.email_settings[type] === "boolean") {
            settings[type] = data.email_settings[type]
          }
        }
      }
      setEmailSettings(settings)
    } catch (error) {
      console.error("Error loading global OWU documents:", error)
      toast.error("Nie udało się załadować dokumentów OWU")
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(type: InsuranceOwuType, file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Tylko pliki PDF są dozwolone")
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error("Plik jest zbyt duży (maksymalnie 10MB)")
      return
    }

    try {
      setUploading((prev) => ({ ...prev, [type]: true }))
      const formData = new FormData()
      formData.append("file", file)
      formData.append("insurance_type", String(type))
      formData.append("display_name", `OWU ${INSURANCE_OWU_TYPE_LABELS[type]}`)

      const res = await fetch("/api/insurance-local/owu/global", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to upload")
      }

      toast.success("Globalny dokument OWU został wgrany pomyślnie")
      await loadDocuments()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Nie udało się wgrać dokumentu OWU"
      toast.error(message)
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }))
    }
  }

  async function handleDelete(type: InsuranceOwuType) {
    if (!confirm("Czy na pewno chcesz usunąć globalny dokument OWU tego typu?")) {
      return
    }

    try {
      const res = await fetch(`/api/insurance-local/owu/global/${type}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to delete")
      }

      toast.success("Globalny dokument OWU został usunięty")
      await loadDocuments()
    } catch (error) {
      console.error("Error deleting global OWU document:", error)
      toast.error("Nie udało się usunąć dokumentu OWU")
    }
  }

  async function handleToggleAttach(type: InsuranceOwuType, attachOnReservation: boolean) {
    const previous = emailSettings[type]
    setEmailSettings((prev) => ({ ...prev, [type]: attachOnReservation }))
    setTogglingAttach((prev) => ({ ...prev, [type]: true }))

    try {
      const res = await fetch("/api/insurance-local/owu/global/email-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurance_type: type,
          attach_on_reservation: attachOnReservation,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "Failed to update email settings")
      }

      toast.success(
        attachOnReservation
          ? "OWU będzie wysyłane po rezerwacji (gdy klient wykupi ubezpieczenie)"
          : "OWU nie będzie wysyłane po rezerwacji",
      )
    } catch (error: unknown) {
      setEmailSettings((prev) => ({ ...prev, [type]: previous }))
      const message = error instanceof Error ? error.message : "Nie udało się zapisać ustawienia"
      toast.error(message)
    } finally {
      setTogglingAttach((prev) => ({ ...prev, [type]: false }))
    }
  }

  function getDocument(type: InsuranceOwuType): OwuDocument | undefined {
    return documents.find((doc) => doc.insurance_type === type)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Ogólne Warunki Ubezpieczenia (OWU)</h3>
        <p className="text-sm text-muted-foreground">
          Globalne dokumenty OWU dla każdego typu ubezpieczenia — obowiązują na wszystkich
          wycieczkach. Po rezerwacji klient otrzyma OWU w załączniku maila tylko wtedy, gdy wykupił
          dany typ ubezpieczenia.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
          {INSURANCE_OWU_TYPES.map((type) => {
            const document = getDocument(type)
            const isUploading = uploading[type]
            const isTogglingAttach = togglingAttach[type]
            const attachOnReservation = emailSettings[type] ?? true

            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="text-lg">{INSURANCE_OWU_TYPE_LABELS[type]}</CardTitle>
                  <CardDescription>Ogólne Warunki Ubezpieczenia — Typ {type}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {document ? (
                    <>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {document.display_name || INSURANCE_OWU_TYPE_LABELS[type]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Wgrany: {new Date(document.updated_at).toLocaleDateString("pl-PL")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            window.open(`/api/documents/file/${document.file_name}`, "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Podgląd
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(type)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-4">Brak dokumentu OWU</p>
                    </div>
                  )}

                  <div
                    className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                      document ? "bg-background" : "bg-muted/50 opacity-70"
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <Mail className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <Label
                          htmlFor={`global-owu-attach-${type}`}
                          className={document ? "cursor-pointer" : "cursor-not-allowed"}
                        >
                          Wyślij w załączniku po rezerwacji
                        </Label>
                        {!document && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Wgraj dokument OWU, aby móc włączyć wysyłkę
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      id={`global-owu-attach-${type}`}
                      checked={attachOnReservation}
                      disabled={!document || isTogglingAttach}
                      onCheckedChange={(checked) => handleToggleAttach(type, checked)}
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor={`global-owu-upload-${type}`} className="cursor-pointer">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        asChild
                        disabled={isUploading}
                      >
                        <span>
                          {isUploading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Wgrywanie...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              {document ? "Zmień dokument OWU" : "Wgraj dokument OWU"}
                            </>
                          )}
                        </span>
                      </Button>
                    </Label>
                    <input
                      id={`global-owu-upload-${type}`}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          void handleUpload(type, file)
                          e.target.value = ""
                        }
                      }}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Tylko pliki PDF, maksymalnie 10MB
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
