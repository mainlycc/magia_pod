"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Plus } from "lucide-react"
import { PaymentScheduleItem } from "@/contexts/trip-context"
import { DatePicker } from "@/components/ui/date-picker"

type PaymentScheduleEditorProps = {
  schedule: PaymentScheduleItem[]
  onChange: (schedule: PaymentScheduleItem[]) => void
  tripStartDate?: string | null
  className?: string
}

const clampPercent = (v: number) => {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, v))
}

const roundToInt = (v: number) => {
  if (!Number.isFinite(v)) return 0
  return Math.round(v)
}

/**
 * Rozdziela `total` na `count` liczb całkowitych tak, by suma była równa `total`.
 * Bazuje na wagach (proporcjonalnie), z metodą największych reszt.
 */
const distributeIntsByWeights = (
  total: number,
  weights: number[]
): number[] => {
  const count = weights.length
  if (count === 0) return []

  const safeTotal = Math.max(0, roundToInt(total))
  const cleanedWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  const sumWeights = cleanedWeights.reduce((a, b) => a + b, 0)
  const baseWeight = sumWeights > 0 ? cleanedWeights : new Array(count).fill(1)
  const denom = sumWeights > 0 ? sumWeights : count

  const raw = baseWeight.map((w) => (safeTotal * w) / denom)
  const floors = raw.map((x) => Math.floor(x))
  let remainder = safeTotal - floors.reduce((a, b) => a + b, 0)

  const order = raw
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => b.frac - a.frac)

  const out = [...floors]
  let k = 0
  while (remainder > 0) {
    out[order[k % order.length].i] += 1
    remainder -= 1
    k += 1
  }
  return out
}

const normalizeScheduleTo100 = (
  schedule: PaymentScheduleItem[],
  lockedIndex?: number
): PaymentScheduleItem[] => {
  if (schedule.length === 0) return schedule

  const lockedIdx =
    typeof lockedIndex === "number" && lockedIndex >= 0 && lockedIndex < schedule.length
      ? lockedIndex
      : null

  const currentPercents = schedule.map((s) => clampPercent(roundToInt(s.percent)))

  // 1 rata zawsze 100%
  if (schedule.length === 1) {
    return [
      {
        ...schedule[0],
        percent: 100,
      },
    ]
  }

  const lockedPercent = lockedIdx === null ? null : currentPercents[lockedIdx]
  const remainingTotal = lockedPercent === null ? 100 : clampPercent(100 - lockedPercent)

  const otherIdxs = schedule
    .map((_, i) => i)
    .filter((i) => (lockedIdx === null ? true : i !== lockedIdx))

  const otherWeights =
    lockedIdx === null
      ? currentPercents
      : otherIdxs.map((i) => currentPercents[i])

  const distributed = distributeIntsByWeights(remainingTotal, otherWeights)

  const nextPercents = [...currentPercents]
  if (lockedIdx === null) {
    for (let j = 0; j < schedule.length; j++) nextPercents[j] = distributed[j] ?? 0
  } else {
    for (let k = 0; k < otherIdxs.length; k++) {
      nextPercents[otherIdxs[k]] = distributed[k] ?? 0
    }
  }

  return schedule.map((item, i) => ({
    ...item,
    percent: clampPercent(nextPercents[i]),
  }))
}

export function PaymentScheduleEditor({
  schedule,
  onChange,
  tripStartDate,
  className = "",
}: PaymentScheduleEditorProps) {
  const [localSchedule, setLocalSchedule] = useState<PaymentScheduleItem[]>(
    schedule.length > 0
      ? schedule
      : [
          {
            installment_number: 1,
            percent: 100,
            due_date: tripStartDate
              ? new Date(
                  new Date(tripStartDate).getTime() - 14 * 24 * 60 * 60 * 1000
                )
                  .toISOString()
                  .split("T")[0]
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
          },
        ]
  )

  const updateSchedule = (newSchedule: PaymentScheduleItem[]) => {
    setLocalSchedule(newSchedule)
    onChange(newSchedule)
  }

  const addInstallment = () => {
    const newNumber = localSchedule.length + 1
    const defaultDate = tripStartDate
      ? new Date(
          new Date(tripStartDate).getTime() - 14 * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split("T")[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]

    const newSchedule = [
      ...localSchedule,
      {
        installment_number: newNumber,
        percent: 0,
        due_date: defaultDate,
      },
    ]
    // Dodanie raty nie powinno psuć sumy 100% (nowa rata startuje z 0%).
    updateSchedule(normalizeScheduleTo100(newSchedule))
  }

  const removeInstallment = (index: number) => {
    if (localSchedule.length <= 1) return // Minimum 1 rata

    const newSchedule = localSchedule
      .filter((_, i) => i !== index)
      .map((item, idx) => ({
        ...item,
        installment_number: idx + 1,
      }))
    // Po usunięciu raty przeskaluj pozostałe do 100%.
    updateSchedule(normalizeScheduleTo100(newSchedule))
  }

  const updateInstallment = (
    index: number,
    field: keyof PaymentScheduleItem,
    value: string | number
  ) => {
    const newSchedule = [...localSchedule]
    newSchedule[index] = {
      ...newSchedule[index],
      [field]: field === "percent" ? clampPercent(Number(value)) : value,
    }
    if (field === "percent") {
      // Po zmianie jednej raty automatycznie przelicz pozostałe, żeby suma była 100%.
      updateSchedule(normalizeScheduleTo100(newSchedule, index))
      return
    }

    updateSchedule(newSchedule)
  }

  const totalPercent = localSchedule.reduce(
    (sum, item) => sum + item.percent,
    0
  )

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Harmonogram płatności</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addInstallment}
          className="h-7 text-xs"
          disabled={localSchedule.length >= 12}
        >
          <Plus className="h-3 w-3 mr-1" />
          Dodaj ratę
        </Button>
      </div>

      <div className="space-y-2">
        {localSchedule.map((item, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 p-3 border rounded-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-center">
                Rata {item.installment_number}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeInstallment(index)}
                disabled={localSchedule.length <= 1}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">Procent (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={item.percent}
                  onChange={(e) =>
                    updateInstallment(index, "percent", e.target.value)
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Data wymagalności</Label>
                <DatePicker
                  value={item.due_date}
                  onChange={(v) => updateInstallment(index, "due_date", v)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs">
        <div>
          {totalPercent !== 100 && (
            <p className="text-destructive">
              Suma procentów: {totalPercent}% (wymagane: 100%)
            </p>
          )}
          {totalPercent === 100 && (
            <p className="text-muted-foreground">
              Suma procentów: {totalPercent}%
            </p>
          )}
        </div>
        <p className="text-muted-foreground">
          Liczba rat: {localSchedule.length}
        </p>
      </div>
    </div>
  )
}
