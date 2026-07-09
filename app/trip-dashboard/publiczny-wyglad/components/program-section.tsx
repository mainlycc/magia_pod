"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TripContentEditor } from "@/components/trip-content-editor"
import { GripVertical } from "lucide-react"
import type { ProgramSectionProps } from "../types"

export function ProgramSection({
  content,
  onChange,
  dragHandlers,
}: ProgramSectionProps) {
  const { draggable, onDragStart, onDragEnd, onDragOver } = dragHandlers

  return (
    <Card className="bg-green-50/50 border-green-200">
      <CardHeader
        onDragOver={onDragOver}
        className="px-3 py-2"
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
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
            Program
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <TripContentEditor
          content={content}
          onChange={onChange}
          label=""
          showToolbar={false}
        />
      </CardContent>
    </Card>
  )
}
