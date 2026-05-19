"use client"

import { useEffect, useState } from "react"
import { useTrip } from "@/contexts/trip-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Upload, FileText, Trash2, Loader2, ExternalLink, Info, Mail } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import {
  DOCUMENTATION_UI_TYPES,
  type DocumentationUiDocumentType,
} from "@/lib/documents/constants"

type DocumentType = DocumentationUiDocumentType

type Document = {
  id: string
  document_type: DocumentType
  file_name: string
  display_name: string | null
  created_at: string
  updated_at: string
  url?: string
  source?: "global" | "trip"
}

const documentTypes: { type: DocumentType; label: string; description: string }[] = [
  {
    type: "agreement",
    label: "Umowa o udział w imprezie turystycznej",
    description: "Umowa o udział w imprezie turystycznej oraz programem imprezy turystycznej",
  },
  {
    type: "conditions_de_pl",
    label: "Warunki Udziału w Imprezach Turystycznych GRUPY DE-PL",
    description: "Warunki Udziału w Imprezach Turystycznych GRUPY DE-PL",
  },
  {
    type: "standard_form",
    label: "Standardowy Formularz Informacyjny",
    description: "Standardowy Formularz Informacyjny",
  },
  {
    type: "electronic_services",
    label: "Regulamin Świadczenia Usług Drogą Elektroniczną",
    description: "Regulamin Świadczenia Usług Drogą Elektroniczną",
  },
  {
    type: "rodo_info",
    label: "Informacja nt przetwarzania danych osobowych",
    description: "Informacja nt przetwarzania danych osobowych",
  },
  {
    type: "insurance_terms",
    label: "Ogólne Warunki Ubezpieczenia",
    description: "Ogólne Warunki Ubezpieczenia",
  },
]

const defaultEmailSettings = (): Record<DocumentType, boolean> =>
  Object.fromEntries(DOCUMENTATION_UI_TYPES.map((t) => [t, true])) as Record<DocumentType, boolean>

export default function DokumentacjaPage() {
  const { selectedTrip } = useTrip()
  const [documents, setDocuments] = useState<Document[]>([])
  const [emailSettings, setEmailSettings] = useState<Record<DocumentType, boolean>>(defaultEmailSettings)
  const [loading, setLoading] = useState(true)
  const [togglingAttach, setTogglingAttach] = useState<Record<DocumentType, boolean>>({
    agreement: false,
    conditions_de_pl: false,
    standard_form: false,
    electronic_services: false,
    rodo_info: false,
    insurance_terms: false,
  })
  const [uploading, setUploading] = useState<Record<DocumentType, boolean>>({
    agreement: false,
    conditions_de_pl: false,
    standard_form: false,
    electronic_services: false,
    rodo_info: false,
    insurance_terms: false,
  })

  useEffect(() => {
    if (selectedTrip?.id) {
      loadDocuments()
    } else {
      setLoading(false)
    }
  }, [selectedTrip])

  const loadDocuments = async () => {
    if (!selectedTrip?.id) return

    try {
      setLoading(true)
      const res = await fetch(`/api/documents/trip/${selectedTrip.id}`)
      if (!res.ok) {
        throw new Error("Failed to load documents")
      }
      const data = await res.json()
      const docsList = Array.isArray(data) ? data : data.documents ?? []
      setDocuments(docsList)

      const settings = defaultEmailSettings()
      const apiSettings = Array.isArray(data) ? null : data.email_settings
      if (apiSettings) {
        for (const type of DOCUMENTATION_UI_TYPES) {
          if (typeof apiSettings[type] === "boolean") {
            settings[type] = apiSettings[type]
          }
        }
      }
      setEmailSettings(settings)
    } catch (error) {
      console.error("Error loading documents:", error)
      toast.error("Nie udało się załadować dokumentów")
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (type: DocumentType, file: File) => {
    if (!selectedTrip?.id) {
      toast.error("Wybierz wycieczkę")
      return
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Tylko pliki PDF są dozwolone")
      return
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      toast.error("Plik jest zbyt duży (maksymalnie 10MB)")
      return
    }

    try {
      setUploading((prev) => ({ ...prev, [type]: true }))

      const formData = new FormData()
      formData.append("file", file)
      formData.append("document_type", type)
      formData.append("display_name", documentTypes.find((dt) => dt.type === type)?.label || "")

      const res = await fetch(`/api/documents/trip/${selectedTrip.id}`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to upload")
      }

      const data = await res.json()
      toast.success("Dokument został wgrany pomyślnie")
      await loadDocuments()
    } catch (error: any) {
      console.error("Error uploading document:", error)
      toast.error(error.message || "Nie udało się wgrać dokumentu")
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }))
    }
  }

  const handleDelete = async (type: DocumentType) => {
    if (!selectedTrip?.id) return

    if (!confirm("Czy na pewno chcesz usunąć ten dokument? Po usunięciu zostanie użyty dokument globalny.")) {
      return
    }

    try {
      const res = await fetch(`/api/documents/trip/${selectedTrip.id}/${type}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to delete")
      }

      toast.success("Dokument został usunięty. Używany jest teraz dokument globalny.")
      await loadDocuments()
    } catch (error) {
      console.error("Error deleting document:", error)
      toast.error("Nie udało się usunąć dokumentu")
    }
  }

  const handleToggleAttach = async (type: DocumentType, attachOnReservation: boolean) => {
    if (!selectedTrip?.id) return

    const previous = emailSettings[type]
    setEmailSettings((prev) => ({ ...prev, [type]: attachOnReservation }))
    setTogglingAttach((prev) => ({ ...prev, [type]: true }))

    try {
      const res = await fetch(`/api/documents/trip/${selectedTrip.id}/email-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_type: type,
          attach_on_reservation: attachOnReservation,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "Failed to update email settings")
      }

      toast.success(
        attachOnReservation
          ? "Dokument będzie wysyłany po rezerwacji"
          : "Dokument nie będzie wysyłany po rezerwacji",
      )
    } catch (error: unknown) {
      setEmailSettings((prev) => ({ ...prev, [type]: previous }))
      const message = error instanceof Error ? error.message : "Nie udało się zapisać ustawienia"
      toast.error(message)
    } finally {
      setTogglingAttach((prev) => ({ ...prev, [type]: false }))
    }
  }

  const getDocument = (type: DocumentType): Document | undefined => {
    return documents.find((doc) => doc.document_type === type)
  }

  const getFileUrl = (fileName: string): string => {
    return `/api/documents/file/${fileName}`
  }

  if (!selectedTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Wybierz wycieczkę</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Wybierz wycieczkę z listy w lewym górnym rogu, aby zobaczyć dokumentację
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">
          Zarządzaj dokumentami PDF dla wybranej wycieczki. Jeśli nie wgrasz własnego dokumentu,
          używany będzie dokument globalny.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Informacja</AlertTitle>
        <AlertDescription>
          Dokumenty specyficzne dla wycieczki nadpisują dokumenty globalne. Jeśli usuniesz
          dokument dla wycieczki, automatycznie zostanie użyty dokument globalny. Przy każdym
          dokumencie możesz włączyć lub wyłączyć wysyłkę w załączniku maila po rezerwacji.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {documentTypes.map((docType) => {
          const document = getDocument(docType.type)
          const isUploading = uploading[docType.type]
          const isTogglingAttach = togglingAttach[docType.type]
          const isGlobal = document?.source === "global"
          const isTripSpecific = document?.source === "trip"
          const attachOnReservation = emailSettings[docType.type] ?? true

          return (
            <Card key={docType.type}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{docType.label}</CardTitle>
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
                <p className="text-sm text-muted-foreground">{docType.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {document ? (
                  <>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {document.display_name || docType.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isGlobal
                            ? "Używany dokument globalny"
                            : `Wgrany: ${new Date(document.updated_at).toLocaleDateString("pl-PL")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          window.open(getFileUrl(document.file_name), "_blank")
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Podgląd
                      </Button>
                      {isTripSpecific && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(docType.type)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {isGlobal && (
                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground text-center">
                          Używasz dokumentu globalnego. Wgraj własny dokument, aby go nadpisać.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Brak dokumentu (używany będzie dokument globalny)
                    </p>
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
                        htmlFor={`attach-${docType.type}`}
                        className={document ? "cursor-pointer" : "cursor-not-allowed"}
                      >
                        Wyślij w załączniku po rezerwacji
                      </Label>
                      {!document && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Wgraj lub ustaw dokument globalny, aby móc włączyć wysyłkę
                        </p>
                      )}
                    </div>
                  </div>
                  <Switch
                    id={`attach-${docType.type}`}
                    checked={attachOnReservation}
                    disabled={!document || isTogglingAttach}
                    onCheckedChange={(checked) => handleToggleAttach(docType.type, checked)}
                  />
                </div>

                <Separator />

                <div>
                  <Label htmlFor={`file-upload-${docType.type}`} className="cursor-pointer">
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
                            {document && isTripSpecific
                              ? "Zmień dokument"
                              : "Wgraj własny dokument"}
                          </>
                        )}
                      </span>
                    </Button>
                  </Label>
                  <input
                    id={`file-upload-${docType.type}`}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleFileUpload(docType.type, file)
                        // Reset input
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
    </div>
  )
}

