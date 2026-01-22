"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TripTitleSectionProps } from "../types"

export function TripTitleSection({
  tripTitle,
  reservationNumber,
  onReservationNumberChange,
  durationText,
  onDurationTextChange,
  tripData,
}: TripTitleSectionProps) {
  return (
    <Card className="bg-green-50/50 border-green-200">
      <CardHeader className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <CardTitle className="text-sm font-semibold">
            Tytuł wyjazdu i informacje
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Tytuł wyjazdu - duży nagłówek */}
        <h1 className="text-2xl font-bold text-foreground">{tripTitle}</h1>
        
        {/* Numer rezerwacji */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Numer rezerwacji:</Label>
          <Input
            value={reservationNumber}
            onChange={(e) => onReservationNumberChange(e.target.value)}
            placeholder="Wpisz numer rezerwacji..."
            className="text-sm"
          />
        </div>

        {/* Data wyjazdu, czas trwania, kraj - większy rozmiar czcionki */}
        <div className="space-y-3 text-base">
          {tripData && tripData.start_date && tripData.end_date && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Data wyjazdu:</span>
              <span className="text-foreground">
                {new Date(tripData.start_date).toLocaleDateString("pl-PL")} – {new Date(tripData.end_date).toLocaleDateString("pl-PL")}
              </span>
            </div>
          )}
          
          <div className="space-y-2">
            <Label className="text-base font-semibold">Czas trwania:</Label>
            <Input
              value={durationText}
              onChange={(e) => onDurationTextChange(e.target.value)}
              placeholder="Np. 8 dni / 7 nocy"
              className="text-base"
            />
          </div>

          {tripData && tripData.location && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Kraj:</span>
              <span className="text-foreground">{tripData.location}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
