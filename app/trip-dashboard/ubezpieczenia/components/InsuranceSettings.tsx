"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useTrip } from "@/contexts/trip-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Upload, FileText, Trash2, Loader2, ExternalLink, Info, Mail } from "lucide-react"
import Link from "next/link"
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
  source?: "global" | "trip"
}

const defaultOwuUploading = (): Record<InsuranceOwuType, boolean> => ({ 1: false, 2: false, 3: false })
const defaultOwuToggling = (): Record<InsuranceOwuType, boolean> => ({ 1: false, 2: false, 3: false })

export function InsuranceSettings() {
  const { selectedTrip } = useTrip()
  const [owuDocuments, setOwuDocuments] = useState<OwuDocument[]>([])
  const [owuEmailSettings, setOwuEmailSettings] = useState<Record<InsuranceOwuType, boolean>>(
    buildDefaultOwuEmailSettings,
  )
  const [loadingOwu, setLoadingOwu] = useState(false)
  const [owuUploading, setOwuUploading] = useState(defaultOwuUploading)
  const [owuTogglingAttach, setOwuTogglingAttach] = useState(defaultOwuToggling)

  useEffect(() => {
    if (selectedTrip?.id) {
      void loadOwuDocuments()
    } else {
      setOwuDocuments([])
      setOwuEmailSettings(buildDefaultOwuEmailSettings())
    }
  }, [selectedTrip?.id])

  async function loadOwuDocuments() {
    if (!selectedTrip?.id) return

    try {
      setLoadingOwu(true)
      const res = await fetch(`/api/insurance-local/owu/trip/${selectedTrip.id}`)
      if (!res.ok) {
        throw new Error("Failed to load OWU documents")
      }
      const data = await res.json()
      setOwuDocuments(Array.isArray(data.documents) ? data.documents : [])
      const settings = buildDefaultOwuEmailSettings()
      if (data.email_settings) {
        for (const type of INSURANCE_OWU_TYPES) {
          if (typeof data.email_settings[type] === "boolean") {
            settings[type] = data.email_settings[type]
          }
        }
      }
      setOwuEmailSettings(settings)
    } catch (error) {
      console.error("Error loading OWU documents:", error)
      toast.error("Nie udało się załadować dokumentów OWU")
    } finally {
      setLoadingOwu(false)
    }
  }

  async function handleOwuUpload(type: InsuranceOwuType, file: File) {
    if (!selectedTrip?.id) {
      toast.error("Wybierz wycieczkę")
      return
    }

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
      setOwuUploading((prev) => ({ ...prev, [type]: true }))
      const formData = new FormData()
      formData.append("file", file)
      formData.append("insurance_type", String(type))
      formData.append("display_name", `OWU ${INSURANCE_OWU_TYPE_LABELS[type]}`)

      const res = await fetch(`/api/insurance-local/owu/trip/${selectedTrip.id}`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to upload")
      }

      toast.success("Dokument OWU wycieczki został wgrany pomyślnie")
      await loadOwuDocuments()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Nie udało się wgrać dokumentu OWU"
      toast.error(message)
    } finally {
      setOwuUploading((prev) => ({ ...prev, [type]: false }))
    }
  }

  async function handleOwuDelete(type: InsuranceOwuType) {
    if (!selectedTrip?.id) return

    const document = getOwuDocument(type)
    if (document?.source === "global") {
      toast.error("To jest dokument globalny — usuń go w ustawieniach globalnych lub nadpisz własnym plikiem")
      return
    }

    if (!confirm("Czy na pewno chcesz usunąć własny dokument OWU dla tej wycieczki?")) {
      return
    }

    try {
      const res = await fetch(`/api/insurance-local/owu/trip/${selectedTrip.id}/${type}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to delete")
      }

      toast.success("Własny dokument OWU został usunięty")
      await loadOwuDocuments()
    } catch (error) {
      console.error("Error deleting OWU document:", error)
      toast.error("Nie udało się usunąć dokumentu OWU")
    }
  }

  async function handleOwuToggleAttach(type: InsuranceOwuType, attachOnReservation: boolean) {
    if (!selectedTrip?.id) return

    const previous = owuEmailSettings[type]
    setOwuEmailSettings((prev) => ({ ...prev, [type]: attachOnReservation }))
    setOwuTogglingAttach((prev) => ({ ...prev, [type]: true }))

    try {
      const res = await fetch(`/api/insurance-local/owu/trip/${selectedTrip.id}/email-settings`, {
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
      setOwuEmailSettings((prev) => ({ ...prev, [type]: previous }))
      const message = error instanceof Error ? error.message : "Nie udało się zapisać ustawienia"
      toast.error(message)
    } finally {
      setOwuTogglingAttach((prev) => ({ ...prev, [type]: false }))
    }
  }

  function getOwuDocument(type: InsuranceOwuType): OwuDocument | undefined {
    return owuDocuments.find((doc) => doc.insurance_type === type)
  }

  function getOwuFileUrl(fileName: string): string {
    return `/api/documents/file/${fileName}`
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Ustawienia wycieczki</AlertTitle>
        <AlertDescription>
          Dokumenty OWU specyficzne dla wycieczki nadpisują dokumenty globalne. Słownik wariantów,
          domyślna konfiguracja i szablony emaili znajdują się w{" "}
          <Link href="/trip-dashboard/ubezpieczenia-globalne" className="underline font-medium">
            globalnych ustawieniach ubezpieczeń
          </Link>
          .
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Ogólne Warunki Ubezpieczenia (OWU)</h3>
          <p className="text-sm text-muted-foreground">
            Wgraj pliki OWU dla tej wycieczki, aby nadpisać globalne dokumenty. Po rezerwacji klient
            otrzyma OWU w załączniku maila tylko wtedy, gdy wykupił dany typ ubezpieczenia.
          </p>
        </div>

        {loadingOwu ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
            {INSURANCE_OWU_TYPES.map((type) => {
              const document = getOwuDocument(type)
              const isUploading = owuUploading[type]
              const isTogglingAttach = owuTogglingAttach[type]
              const attachOnReservation = owuEmailSettings[type] ?? true
              const isGlobal = document?.source === "global"
              const isTripSpecific = document?.source === "trip"

              return (
                <Card key={type}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-lg">{INSURANCE_OWU_TYPE_LABELS[type]}</CardTitle>
                      {isGlobal && (
                        <Badge variant="secondary" className="text-xs">
                          Globalny
                        </Badge>
                      )}
                      {isTripSpecific && (
                        <Badge variant="default" className="text-xs">
                          Własny
                        </Badge>
                      )}
                    </div>
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
                            onClick={() => window.open(getOwuFileUrl(document.file_name), "_blank")}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Podgląd
                          </Button>
                          {isTripSpecific && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleOwuDelete(type)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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
                            htmlFor={`owu-attach-${type}`}
                            className={document ? "cursor-pointer" : "cursor-not-allowed"}
                          >
                            Wyślij w załączniku po rezerwacji
                          </Label>
                          {!document && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Wgraj dokument OWU (lub ustaw globalny), aby móc włączyć wysyłkę
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch
                        id={`owu-attach-${type}`}
                        checked={attachOnReservation}
                        disabled={!document || isTogglingAttach}
                        onCheckedChange={(checked) => handleOwuToggleAttach(type, checked)}
                      />
                    </div>

                    <Separator />

                    <div>
                      <Label htmlFor={`owu-upload-${type}`} className="cursor-pointer">
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
                                {isTripSpecific ? "Zmień dokument OWU" : "Wgraj własny dokument OWU"}
                              </>
                            )}
                          </span>
                        </Button>
                      </Label>
                      <input
                        id={`owu-upload-${type}`}
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            void handleOwuUpload(type, file)
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
    </div>
  )
}
