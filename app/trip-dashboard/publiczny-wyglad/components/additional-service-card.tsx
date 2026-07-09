"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { TripContentEditor } from "@/components/trip-content-editor"
import { GripVertical } from "lucide-react"
import type { AdditionalServiceCardProps } from "../types"

export function AdditionalServiceCard({
  text,
  onChange,
  isVisible,
  onVisibilityChange,
  dragHandlers,
}: AdditionalServiceCardProps) {
  const { draggable, onDragStart, onDragEnd, onDragOver } = dragHandlers

  return (
    <Card className={isVisible ? "bg-green-50/50 border-green-200" : "bg-gray-50/50 border-gray-200"}>
      <CardHeader
        onDragOver={onDragOver}
        className="relative px-3 py-2 pr-12"
      >
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isVisible ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="cursor-grab active:cursor-grabbing select-none inline-flex"
            title="Przeciągnij, aby zmienić kolejność"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </span>
          <CardTitle className="text-sm font-semibold">
            Dodatkowe świadczenie
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
          <TripContentEditor
            content={text}
            onChange={onChange}
            label=""
            showToolbar={false}
          />
        </CardContent>
      )}
    </Card>
  )
}
