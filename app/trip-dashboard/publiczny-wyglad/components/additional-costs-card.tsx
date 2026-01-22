"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { GripVertical } from "lucide-react"
import type { AdditionalCostsCardProps } from "../types"

export function AdditionalCostsCard({
  text,
  onChange,
  isVisible,
  onVisibilityChange,
  dragHandlers,
}: AdditionalCostsCardProps) {
  return (
    <Card className={isVisible ? "bg-green-50/50 border-green-200" : "bg-gray-50/50 border-gray-200"}>
      <CardHeader
        {...dragHandlers}
        className="relative cursor-move px-3 py-2 pr-12"
      >
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isVisible ? 'bg-green-500' : 'bg-gray-300'}`} />
          <GripVertical className="h-3 w-3 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">
            Dodatkowe koszty
          </CardTitle>
        </div>
        <div className="absolute top-2 right-2">
          <Switch 
            checked={isVisible} 
            onCheckedChange={onVisibilityChange}
            className="scale-75"
          />
        </div>
      </CardHeader>
      {isVisible && (
        <CardContent>
          <Textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Wpisz dodatkowe koszty..."
            className="min-h-[120px]"
          />
        </CardContent>
      )}
    </Card>
  )
}
