"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type AirportOption = {
  code: string
  name: string
}

type AirportComboboxProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
}

function formatAirportLabel(airport: AirportOption): string {
  // Seed names often end with "(CODE)" — strip it so the code isn't shown twice.
  const suffix = `(${airport.code})`
  const name = airport.name.endsWith(suffix)
    ? airport.name.slice(0, -suffix.length).trimEnd()
    : airport.name
  return `${airport.code} — ${name}`
}

export function AirportCombobox({
  value,
  onChange,
  placeholder = "Wyszukaj kod lotniska (np. LKPR, Warszawa)",
  className,
  id,
}: AirportComboboxProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [options, setOptions] = useState<AirportOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    if (!value.trim()) {
      setSelectedLabel(null)
      return
    }

    const controller = new AbortController()
    const code = value.trim().split(/[\s,;-]+/)[0]?.toUpperCase() ?? ""

    if (!code) {
      setSelectedLabel(null)
      return
    }

    fetch(`/api/airports?code=${encodeURIComponent(code)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.airport) {
          setSelectedLabel(formatAirportLabel(data.airport))
        } else {
          setSelectedLabel(null)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSelectedLabel(null)
        }
      })

    return () => controller.abort()
  }, [value])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setOptions([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController()
      fetch(`/api/airports?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : { airports: [] }))
        .then((data) => {
          setOptions(data.airports ?? [])
          setHighlightedIndex(0)
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setOptions([])
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false)
          }
        })
    }, 250)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const highlighted = listRef.current.querySelector<HTMLElement>(
      `[data-index="${highlightedIndex}"]`
    )
    highlighted?.scrollIntoView({ block: "nearest" })
  }, [highlightedIndex, open])

  const selectAirport = (airport: AirportOption) => {
    onChange(airport.code)
    setQuery(airport.code)
    setSelectedLabel(formatAirportLabel(airport))
    setOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault()
      setOpen(true)
      return
    }

    if (!open) return

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        setHighlightedIndex((index) =>
          index < options.length - 1 ? index + 1 : index
        )
        break
      case "ArrowUp":
        event.preventDefault()
        setHighlightedIndex((index) => (index > 0 ? index - 1 : 0))
        break
      case "Enter":
        event.preventDefault()
        if (options[highlightedIndex]) {
          selectAirport(options[highlightedIndex])
        } else {
          onChange(query.trim())
          setOpen(false)
        }
        break
      case "Escape":
        event.preventDefault()
        setOpen(false)
        break
    }
  }

  const displayValue = open ? query : (selectedLabel ?? value)

  return (
    <div className="grid gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              id={inputId}
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              aria-controls={`${inputId}-listbox`}
              value={displayValue}
              onChange={(event) => {
                setQuery(event.target.value)
                onChange(event.target.value)
                setSelectedLabel(null)
                setOpen(true)
              }}
              onFocus={() => {
                setQuery(value)
                setOpen(true)
              }}
              onBlur={() => {
                onChange(query.trim())
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn("h-8 pr-8 text-xs", className)}
              autoComplete="off"
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pokaż listę lotnisk"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setOpen((current) => !current)}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </PopoverAnchor>
        <PopoverContent
          id={`${inputId}-listbox`}
          role="listbox"
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            const target = event.target as HTMLElement | null
            if (target?.closest(`#${CSS.escape(inputId)}`)) {
              event.preventDefault()
            }
          }}
        >
          <div ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {query.trim().length < 2 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Wpisz co najmniej 2 znaki, aby wyszukać lotnisko
              </p>
            ) : loading ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Wyszukiwanie…
              </p>
            ) : options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Brak pasujących lotnisk
              </p>
            ) : (
              options.map((airport, index) => (
                <button
                  key={airport.code}
                  type="button"
                  role="option"
                  data-index={index}
                  aria-selected={index === highlightedIndex}
                  className={cn(
                    "flex w-full px-3 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground",
                    index === highlightedIndex &&
                      "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectAirport(airport)}
                >
                  {formatAirportLabel(airport)}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
