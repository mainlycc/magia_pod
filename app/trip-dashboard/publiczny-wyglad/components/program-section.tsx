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
            Program
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <TripContentEditor
          content={content}
          onChange={onChange}
          label=""
        />
      </CardContent>
    </Card>
  )
}
