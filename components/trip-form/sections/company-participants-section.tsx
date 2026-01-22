"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { RegistrationMode } from "../types"

interface CompanyParticipantsSectionProps {
  companyParticipantsInfo: string
  setCompanyParticipantsInfo: (info: string) => void
  registrationMode: RegistrationMode
}

export function CompanyParticipantsSection({
  companyParticipantsInfo,
  setCompanyParticipantsInfo,
  registrationMode,
}: CompanyParticipantsSectionProps) {
  if (registrationMode === "individual") {
    return null
  }

  return (
    <Card className="p-3 space-y-2">
      <CardHeader className="px-0 pt-0 pb-1">
        <CardTitle className="text-sm font-semibold">
          Uczestnicy – zgłoszenia firmowe
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-2">
        <p className="text-[11px] text-muted-foreground">
          Ten komunikat będzie wyświetlany w formularzu rezerwacji, gdy
          zgłoszenie jest składane jako firma. Zastępuje on formularz
          dodawania uczestników.
        </p>
        <div className="grid gap-1">
          <Label className="text-xs">Treść komunikatu dla firm</Label>
          <Textarea
            value={companyParticipantsInfo}
            onChange={(e) => setCompanyParticipantsInfo(e.target.value)}
            rows={3}
            className="text-xs resize-none"
          />
        </div>
      </CardContent>
    </Card>
  )
}
