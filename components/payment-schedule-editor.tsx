"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Plus } from "lucide-react"
import { PaymentScheduleItem } from "@/contexts/trip-context"

type PaymentScheduleEditorProps = {
  schedule: PaymentScheduleItem[]
  onChange: (schedule: PaymentScheduleItem[]) => void
  tripStartDate?: string | null
  className?: string
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
    updateSchedule(newSchedule)
  }

  const removeInstallment = (index: number) => {
    if (localSchedule.length <= 1) return // Minimum 1 rata

    const newSchedule = localSchedule
      .filter((_, i) => i !== index)
      .map((item, idx) => ({
        ...item,
        installment_number: idx + 1,
      }))
    updateSchedule(newSchedule)
  }

  const updateInstallment = (
    index: number,
    field: keyof PaymentScheduleItem,
    value: string | number
  ) => {
    const newSchedule = [...localSchedule]
    newSchedule[index] = {
      ...newSchedule[index],
      [field]: field === "percent" ? Number(value) : value,
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
            className="grid grid-cols-12 gap-2 items-end p-2 border rounded-md"
          >
            <div className="col-span-1 flex items-center justify-center">
              <span className="text-xs font-medium">{item.installment_number}</span>
            </div>
            <div className="col-span-4 grid gap-1">
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
            <div className="col-span-5 grid gap-1">
              <Label className="text-xs">Data wymagalności</Label>
              <Input
                type="date"
                value={item.due_date}
                onChange={(e) =>
                  updateInstallment(index, "due_date", e.target.value)
                }
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2 flex justify-end">
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
