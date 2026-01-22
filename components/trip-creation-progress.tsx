"use client"

import { Check, Circle, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

type Step = {
  number: number
  label: string
  path: string
}

const steps: Step[] = [
  { number: 1, label: "Informacje ogólne", path: "/trip-dashboard/dodaj-wycieczke" },
  { number: 2, label: "Publiczny wygląd", path: "/trip-dashboard/publiczny-wyglad" },
  { number: 3, label: "Formularz", path: "/trip-dashboard/informacje/formularz" },
]

type TripCreationProgressProps = {
  currentStep: number
}

export function TripCreationProgress({ currentStep }: TripCreationProgressProps) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = step.number < currentStep
            const isCurrent = step.number === currentStep
            const isPending = step.number > currentStep

            return (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isCompleted
                        ? "bg-primary text-primary-foreground border-primary"
                        : isCurrent
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : isCurrent ? (
                      <ArrowRight className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={`mt-2 text-sm font-medium ${
                      isCurrent ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      isCompleted ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
