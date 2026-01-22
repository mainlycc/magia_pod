"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GripVertical } from "lucide-react"
import type { BookingPreviewCardProps } from "../types"

export function BookingPreviewCard({
  price,
  seatsLeft,
  showSeatsLeft,
  onShowSeatsLeftChange,
  dragHandlers,
}: BookingPreviewCardProps) {
  return (
    <Card className="bg-green-50/50 border-green-200">
      <CardHeader
        {...dragHandlers}
        className="cursor-move px-3 py-2"
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <GripVertical className="h-3 w-3 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">
            Podgląd karty rezerwacji
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Cena (z bazy)</span>
          <span className="font-semibold text-foreground">
            {price} PLN
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Pozostało miejsc</span>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              className="h-3 w-3 rounded border border-muted-foreground/60"
              checked={showSeatsLeft}
              onChange={(e) => onShowSeatsLeftChange(e.target.checked)}
            />
            <span className="text-xs">Pokaż na stronie</span>
          </label>
        </div>
        {showSeatsLeft && (
          <div className="text-xs text-muted-foreground">
            Na stronie będzie widoczne: {seatsLeft} miejsc
          </div>
        )}
      </CardContent>
    </Card>
  )
}
