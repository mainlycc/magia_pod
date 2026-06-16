"use client"

import { useEffect, useState } from "react"
import { useTrip } from "@/contexts/trip-context"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InsuranceType1 } from "./components/InsuranceType1"
import { InsuranceType2 } from "./components/InsuranceType2"
import { InsuranceType3 } from "./components/InsuranceType3"
import { InsuranceSettings } from "./components/InsuranceSettings"

export default function UbezpieczeniaPage() {
  const { selectedTrip, invalidateTripCache } = useTrip()
  const [insuranceDataKey, setInsuranceDataKey] = useState(0)

  // Backfill: po wejściu na zakładkę synchronizujemy form_extra_insurances
  // z aktualnym stanem trip_insurance_variants (Typ 2 i 3) — dzięki temu
  // istniejące wycieczki, w których warianty były dodane przed wprowadzeniem
  // synchronizacji, pojawią się w publicznym formularzu rezerwacji oraz
  // w liście wyboru przy uczestnikach.
  useEffect(() => {
    const tripId = selectedTrip?.id
    if (!tripId) return
    let cancelled = false

    const runSync = async () => {
      try {
        const [formRes, participantRes] = await Promise.all([
          fetch(`/api/insurance-local/trip-config/${tripId}/sync-form-insurances`, {
            method: "POST",
          }),
          fetch(`/api/insurance-local/trip-config/${tripId}/sync-participant-insurances`, {
            method: "POST",
          }),
        ])

        if (cancelled) return

        if (formRes.ok) {
          invalidateTripCache()
        }
        if (participantRes.ok) {
          setInsuranceDataKey((k) => k + 1)
        }
      } catch {
        // Synchronizacja jest "best effort" — nie blokujemy UI.
      }
    }

    void runSync()

    return () => {
      cancelled = true
    }
  }, [selectedTrip?.id, invalidateTripCache])

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
          <InsuranceType1
            key={`typ1-${insuranceDataKey}`}
            tripId={selectedTrip.id}
            tripTitle={selectedTrip.title}
          />
        </TabsContent>

        <TabsContent value="typ2" className="mt-6">
          <InsuranceType2 key={`typ2-${insuranceDataKey}`} tripId={selectedTrip.id} />
        </TabsContent>

        <TabsContent value="typ3" className="mt-6">
          <InsuranceType3 key={`typ3-${insuranceDataKey}`} tripId={selectedTrip.id} />
        </TabsContent>

        <TabsContent value="ustawienia" className="mt-6">
          <InsuranceSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
