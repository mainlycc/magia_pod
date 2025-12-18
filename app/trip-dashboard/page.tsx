"use client"

import { useTrip } from "@/contexts/trip-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TripPublicLink } from "@/components/trip-public-link"

export default function TripDashboardPage() {
  const { selectedTrip } = useTrip()

  if (!selectedTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Wybierz wycieczkę</CardTitle>
            <CardDescription>
              Wybierz wycieczkę z listy w lewym górnym rogu, aby zobaczyć dashboard
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{selectedTrip.title}</h1>
          <p className="text-muted-foreground mt-2">
            Dashboard dla wybranej wycieczki
          </p>
        </div>
        <TripPublicLink />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Aktywna</div>
            <p className="text-xs text-muted-foreground">
              Wycieczka jest aktywna
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data rozpoczęcia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedTrip.start_date
                ? new Date(selectedTrip.start_date).toLocaleDateString("pl-PL")
                : "Brak"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data zakończenia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedTrip.end_date
                ? new Date(selectedTrip.end_date).toLocaleDateString("pl-PL")
                : "Brak"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Akcje</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Użyj menu po lewej stronie, aby przejść do różnych sekcji
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

