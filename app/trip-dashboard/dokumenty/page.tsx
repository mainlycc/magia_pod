"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Upload, FileText, Trash2, Loader2, ExternalLink } from "lucide-react"
import { Separator } from "@/components/ui/separator"

type DocumentType = 
  | "rodo" 
  | "terms" 
  | "conditions"
  | "agreement"
  | "conditions_de_pl"
  | "standard_form"
  | "electronic_services"
  | "rodo_info"
  | "insurance_terms"

type Document = {
  id: string
  document_type: DocumentType
  file_name: string
  display_name: string | null
  created_at: string
  updated_at: string
  url?: string
}

const documentTypes: { type: DocumentType; label: string; description: string }[] = [
  {
    type: "rodo",
    label: "RODO",
    description: "Zgoda na przetwarzanie danych osobowych",
  },
  {
    type: "terms",
    label: "Regulamin",
    description: "Regulamin wycieczek",
  },
  {
    type: "conditions",
    label: "Warunki udziału",
    description: "Warunki udziału w wycieczce",
  },
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

export default function DokumentyPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<Record<DocumentType, boolean>>({
    rodo: false,
    terms: false,
    conditions: false,
    agreement: false,
    conditions_de_pl: false,
    standard_form: false,
    electronic_services: false,
    rodo_info: false,
    insurance_terms: false,
  })

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/documents/global")
      if (!res.ok) {
        throw new Error("Failed to load documents")
      }
      const data = await res.json()
      setDocuments(data)
    } catch (error) {
      console.error("Error loading documents:", error)
      toast.error("Nie udało się załadować dokumentów")
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (type: DocumentType, file: File) => {
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

      const res = await fetch("/api/documents/global", {
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
    if (!confirm("Czy na pewno chcesz usunąć ten dokument?")) {
      return
    }

    try {
      const res = await fetch(`/api/documents/global/${type}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to delete")
      }

      toast.success("Dokument został usunięty")
      await loadDocuments()
    } catch (error) {
      console.error("Error deleting document:", error)
      toast.error("Nie udało się usunąć dokumentu")
    }
  }

  const getDocument = (type: DocumentType): Document | undefined => {
    return documents.find((doc) => doc.document_type === type)
  }

  const getFileUrl = (fileName: string): string => {
    return `/api/documents/file/${fileName}`
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
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {documentTypes.map((docType) => {
          const document = getDocument(docType.type)
          const isUploading = uploading[docType.type]

          return (
            <Card key={docType.type}>
              <CardHeader>
                <CardTitle className="text-lg">{docType.label}</CardTitle>
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
                          Wgrany: {new Date(document.updated_at).toLocaleDateString("pl-PL")}
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
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(docType.type)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Brak wgranego dokumentu
                    </p>
                  </div>
                )}

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
                            {document ? "Zmień dokument" : "Wgraj dokument"}
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

