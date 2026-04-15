"use client"

import { useTrip } from "@/contexts/trip-context"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InsuranceType1 } from "./components/InsuranceType1"
import { InsuranceType2 } from "./components/InsuranceType2"
import { InsuranceType3 } from "./components/InsuranceType3"
import { InsuranceSettings } from "./components/InsuranceSettings"

export default function UbezpieczeniaPage() {
  const { selectedTrip } = useTrip()

  if (!selectedTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Wybierz wycieczkę</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Wycieczka: <span className="font-medium">{selectedTrip.title}</span>
      </div>

      <Tabs defaultValue="typ1">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="typ1">Typ 1 — Podstawowe</TabsTrigger>
          <TabsTrigger value="typ2">Typ 2 — Dodatkowe</TabsTrigger>
          <TabsTrigger value="typ3">Typ 3 — KR</TabsTrigger>
          <TabsTrigger value="ustawienia">Ustawienia</TabsTrigger>
        </TabsList>

        <TabsContent value="typ1" className="mt-6">
          <InsuranceType1 tripId={selectedTrip.id} tripTitle={selectedTrip.title} />
        </TabsContent>

        <TabsContent value="typ2" className="mt-6">
          <InsuranceType2 tripId={selectedTrip.id} />
        </TabsContent>

        <TabsContent value="typ3" className="mt-6">
          <InsuranceType3 tripId={selectedTrip.id} />
        </TabsContent>

        <TabsContent value="ustawienia" className="mt-6">
          <InsuranceSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
