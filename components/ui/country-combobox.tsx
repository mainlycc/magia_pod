"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { filterCountries } from "@/lib/countries"
import { cn } from "@/lib/utils"

type CountryComboboxProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
}

export function CountryCombobox({
  value,
  onChange,
  placeholder = "Wybierz lub wpisz kraj",
  className,
  id,
}: CountryComboboxProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const filteredCountries = useMemo(() => filterCountries(value), [value])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [value, open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const highlighted = listRef.current.querySelector<HTMLElement>(
      `[data-index="${highlightedIndex}"]`
    )
    highlighted?.scrollIntoView({ block: "nearest" })
  }, [highlightedIndex, open])

  const selectCountry = (country: string) => {
    onChange(country)
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
          index < filteredCountries.length - 1 ? index + 1 : index
        )
        break
      case "ArrowUp":
        event.preventDefault()
        setHighlightedIndex((index) => (index > 0 ? index - 1 : 0))
        break
      case "Enter":
        event.preventDefault()
        if (filteredCountries[highlightedIndex]) {
          selectCountry(filteredCountries[highlightedIndex])
        }
        break
      case "Escape":
        event.preventDefault()
        setOpen(false)
        break
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={`${inputId}-listbox`}
            value={value}
            onChange={(event) => {
              onChange(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("h-8 pr-8 text-xs", className)}
            autoComplete="off"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Pokaż listę krajów"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen((current) => !current)}
          >
            <ChevronDown className="h-4 w-4" />
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
        <div
          ref={listRef}
          className="max-h-60 overflow-y-auto py-1"
        >
          {filteredCountries.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Brak pasujących krajów
            </p>
          ) : (
            filteredCountries.map((country, index) => (
              <button
                key={country}
                type="button"
                role="option"
                data-index={index}
                aria-selected={index === highlightedIndex}
                className={cn(
                  "flex w-full px-3 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground",
                  index === highlightedIndex && "bg-accent text-accent-foreground"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectCountry(country)}
              >
                {country}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
