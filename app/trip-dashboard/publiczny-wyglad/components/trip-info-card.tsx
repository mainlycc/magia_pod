"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { TripContentEditor } from "@/components/trip-content-editor"
import type { ToggleableCardProps } from "../types"

export function TripInfoCard({ show, onShowChange, text, onTextChange, title }: ToggleableCardProps) {
  return (
    <Card className={show ? "bg-green-50/50 border-green-200" : "bg-gray-50/50 border-gray-200"}>
      <CardHeader className="relative px-3 py-2 pr-12">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${show ? 'bg-green-500' : 'bg-gray-300'}`} />
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        <div className="absolute top-2 right-2">
          <Switch 
            checked={show} 
            onCheckedChange={onShowChange}
            className="scale-75"
          />
        </div>
      </CardHeader>
      {show && (
        <CardContent className="space-y-2 pt-2">
          <TripContentEditor
            content={text}
            onChange={onTextChange}
            label=""
          />
        </CardContent>
      )}
    </Card>
  )
}
