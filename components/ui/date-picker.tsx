"use client"

import * as React from "react"
import { format } from "date-fns/format"
import { parseISO } from "date-fns/parseISO"
import { parse } from "date-fns/parse"
import { isValid } from "date-fns/isValid"
import { pl } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type DatePickerProps = {
  value?: string | null
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  align?: React.ComponentProps<typeof PopoverContent>["align"]
  calendarClassName?: string
  fromYear?: number
  toYear?: number
  defaultYear?: number
  captionLayout?: React.ComponentProps<typeof Calendar>["captionLayout"]
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

function toDisplayDateString(value?: string | null): string {
  const d = toDate(value)
  return d ? format(d, "dd/MM/yyyy", { locale: pl }) : ""
}

function parseDisplayDateString(displayValue: string): Date | undefined {
  const trimmed = displayValue.trim()
  if (!trimmed) return undefined
  const parsed = parse(trimmed, "dd/MM/yyyy", new Date(), { locale: pl })
  return isValid(parsed) ? parsed : undefined
}

export function DatePicker({
  value,
  onChange,
  placeholder = "DD/MM/RRRR",
  disabled,
  className,
  align = "start",
  calendarClassName,
  fromYear,
  toYear,
  defaultYear,
  captionLayout = "dropdown",
}: DatePickerProps) {
  const selected = toDate(value)
  const fallbackMonth =
    selected ??
    (typeof defaultYear === "number" && Number.isFinite(defaultYear)
      ? new Date(defaultYear, 0, 1)
      : undefined)

  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(() =>
    toDisplayDateString(value)
  )

  // Synchronizuj tekst w inpucie, gdy `value` zmieni się z zewnątrz
  React.useEffect(() => {
    setInputValue(toDisplayDateString(value))
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => {
            // Pozwól wpisać ręcznie: cyfry + "/"
            const next = e.target.value.replace(/[^\d/]/g, "")
            setInputValue(next)
          }}
          onBlur={() => {
            const parsed = parseDisplayDateString(inputValue)
            if (!parsed) {
              // Jeśli niepoprawne, wróć do ostatniej poprawnej wartości
              setInputValue(toDisplayDateString(value))
              return
            }
            onChange(toIsoDateString(parsed))
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              const parsed = parseDisplayDateString(inputValue)
              if (parsed) {
                onChange(toIsoDateString(parsed))
                setOpen(false)
                ;(e.currentTarget as HTMLInputElement).blur()
              }
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          inputMode="numeric"
          className={cn("min-w-0", className)}
        />

        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="shrink-0 px-2"
            aria-label="Otwórz kalendarz"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align={align} className="w-auto p-2">
        <Calendar
          className={cn(
            // Powiększamy siatkę dni, żeby kalendarz nie był „przykurczony”.
            "[--cell-size:2.5rem]",
            calendarClassName
          )}
          mode="single"
          captionLayout={captionLayout}
          fromYear={fromYear}
          toYear={toYear}
          defaultMonth={fallbackMonth}
          selected={selected}
          onSelect={(d) => {
            if (!d) return
            onChange(toIsoDateString(d))
            setInputValue(format(d, "dd/MM/yyyy", { locale: pl }))
            setOpen(false)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

