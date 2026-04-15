"use client"

import * as React from "react"
import { format } from "date-fns/format"
import { parseISO } from "date-fns/parseISO"
import { pl } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type DatePickerProps = {
  value?: string | null
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  align?: React.ComponentProps<typeof PopoverContent>["align"]
}

function toDate(value?: string | null): Date | undefined {
  if (!value) return undefined
  try {
    // Expecting YYYY-MM-DD.
    const d = parseISO(value)
    return Number.isNaN(d.getTime()) ? undefined : d
  } catch {
    return undefined
  }
}

function toIsoDateString(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Wybierz datę",
  disabled,
  className,
  align = "start",
}: DatePickerProps) {
  const selected = toDate(value)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "dd.MM.yyyy", { locale: pl }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) return
            onChange(toIsoDateString(d))
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

