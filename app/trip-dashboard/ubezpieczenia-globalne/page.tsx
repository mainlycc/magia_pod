"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Info } from "lucide-react"
import type { EmailTemplate } from "../ubezpieczenia/types"
import type { ManagedInsuranceVariant } from "./types"
import { VariantsManager } from "./components/variants-manager"
import { EmailTemplatesManager } from "./components/email-templates-manager"

export default function GlobalneUbezpieczeniaPage() {
  const [variants, setVariants] = useState<ManagedInsuranceVariant[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [variantsRes, templatesRes] = await Promise.all([
        fetch("/api/insurance-local/variants/manage"),
        fetch("/api/insurance-local/email-templates"),
      ])

      if (variantsRes.ok) {
        const data = await variantsRes.json()
        setVariants(Array.isArray(data.variants) ? data.variants : [])
      } else {
        throw new Error("variants_load_failed")
      }

      if (templatesRes.ok) {
        setTemplates(await templatesRes.json())
      }
    } catch (error) {
      console.error("Error loading global insurance settings:", error)
      toast.error("Nie udało się załadować ustawień ubezpieczeń")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleRefresh() {
    setLoading(true)
    await loadData()
  }

  if (loading && variants.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Centralny panel ubezpieczeń</AlertTitle>
        <AlertDescription>
          Zarządzaj wszystkimi wariantami ubezpieczeń w systemie: dodawaj i edytuj warianty, ustawiaj
          zakresy i sumy, podpinaj OWU oraz inne załączniki PDF, konfiguruj domyślne przypisanie do
          nowych wycieczek i edytuj szablony wiadomości e-mail.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="variants">
        <TabsList>
          <TabsTrigger value="variants">Warianty ubezpieczeń</TabsTrigger>
          <TabsTrigger value="templates">Szablony wiadomości</TabsTrigger>
        </TabsList>

        <TabsContent value="variants" className="mt-6">
          <VariantsManager variants={variants} onRefresh={handleRefresh} />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <EmailTemplatesManager templates={templates} onTemplatesChange={setTemplates} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
