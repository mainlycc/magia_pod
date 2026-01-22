"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RegistrationMode, RequiredParticipantFields } from "../types"

interface BasicSettingsSectionProps {
  registrationMode: RegistrationMode
  setRegistrationMode: (mode: RegistrationMode) => void
  requiredParticipantFields: RequiredParticipantFields
  setRequiredParticipantFields: (fields: RequiredParticipantFields | ((prev: RequiredParticipantFields) => RequiredParticipantFields)) => void
  showAdditionalServices: boolean
  setShowAdditionalServices: (show: boolean) => void
}

export function BasicSettingsSection({
  registrationMode,
  setRegistrationMode,
  requiredParticipantFields,
  setRequiredParticipantFields,
  showAdditionalServices,
  setShowAdditionalServices,
}: BasicSettingsSectionProps) {
  return (
    <Card className="p-3 space-y-2">
      <CardContent className="px-0 pb-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="grid gap-1">
            <Label className="text-xs">Dostępne ścieżki zgłoszenia</Label>
            <Select
              value={registrationMode}
              onValueChange={(value: RegistrationMode) =>
                setRegistrationMode(value)
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Wybierz typ zgłoszenia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">
                  Tylko Osoba Fizyczna
                </SelectItem>
                <SelectItem value="company">Tylko Firma</SelectItem>
                <SelectItem value="both">
                  Obie opcje dostępne (wybór użytkownika)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {(registrationMode === "individual" || registrationMode === "both") && (
          <div className="grid gap-2 mt-4 border rounded-md p-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Wymagane pola uczestników
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Wybierz które pola są obowiązkowe w formularzu rezerwacji dla uczestników. Imię i nazwisko są zawsze wymagane.
              </p>
            </div>
            <div className="space-y-3 pl-2">
              <div className="flex items-center justify-between rounded-lg border p-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium cursor-pointer">
                    PESEL
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Numer PESEL uczestnika
                  </p>
                </div>
                <Switch
                  checked={requiredParticipantFields.pesel}
                  onCheckedChange={(checked) =>
                    setRequiredParticipantFields((prev) => ({
                      ...prev,
                      pesel: checked,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium cursor-pointer">
                    Dokument tożsamości / Paszport
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Typ dokumentu i numer
                  </p>
                </div>
                <Switch
                  checked={requiredParticipantFields.document}
                  onCheckedChange={(checked) =>
                    setRequiredParticipantFields((prev) => ({
                      ...prev,
                      document: checked,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium cursor-pointer">
                    Płeć
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Płeć uczestnika
                  </p>
                </div>
                <Switch
                  checked={requiredParticipantFields.gender}
                  onCheckedChange={(checked) =>
                    setRequiredParticipantFields((prev) => ({
                      ...prev,
                      gender: checked,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium cursor-pointer">
                    Telefon
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Numer telefonu uczestnika
                  </p>
                </div>
                <Switch
                  checked={requiredParticipantFields.phone}
                  onCheckedChange={(checked) =>
                    setRequiredParticipantFields((prev) => ({
                      ...prev,
                      phone: checked,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        )}
          
        <div className="grid gap-1 mt-4">
          <Label className="text-xs">Krok usługi dodatkowe</Label>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium cursor-pointer">
                Pokaż krok "Usługi dodatkowe" w formularzu
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Jeśli włączone, w formularzu pojawi się krok umożliwiający wybór usług dodatkowych dla uczestników
              </p>
            </div>
            <Switch
              checked={showAdditionalServices}
              onCheckedChange={setShowAdditionalServices}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
