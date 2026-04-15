"use client"

import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ColumnDef } from "@tanstack/react-table"
import { ReusableTable } from "@/components/reusable-table"
import { IconDownload, IconMail, IconShield, IconUsers } from "@tabler/icons-react"
import {
  InsuranceVariant,
  TripInsuranceVariant,
  EmailLog,
  formatDate,
  formatDateTime,
} from "../types"

type Props = {
  tripId: string
  tripTitle: string
}

type Participant = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  booking_ref: string
}

export function InsuranceType1({ tripId, tripTitle }: Props) {
  const [allVariants, setAllVariants] = useState<InsuranceVariant[]>([])
  const [tripConfig, setTripConfig] = useState<TripInsuranceVariant | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [savingVariant, setSavingVariant] = useState(false)

  useEffect(() => {
    loadAll()
  }, [tripId])

  async function loadAll() {
    setLoadingInit(true)
    await Promise.all([loadVariants(), loadTripConfig(), loadParticipants(), loadLogs()])
    setLoadingInit(false)
  }

  async function loadVariants() {
    const res = await fetch("/api/insurance-local/variants?type=1")
    if (res.ok) setAllVariants(await res.json())
  }

  async function loadTripConfig() {
    const res = await fetch(`/api/insurance-local/trip-config/${tripId}`)
    if (!res.ok) return
    const data: TripInsuranceVariant[] = await res.json()
    const type1 = data.find((tv) => tv.insurance_variants?.type === 1)
    setTripConfig(type1 || null)
  }

  async function loadParticipants() {
    const res = await fetch(`/api/insurance-local/participant-insurances?trip_id=${tripId}&type=1`)
    if (!res.ok) return
    const data = await res.json()
    // Dla typu 1 — pobieramy uczestników ze wszystkich aktywnych rezerwacji (brak filtra)
    // Pobieramy bezpośrednio z ogólnego endpointu participants
    const res2 = await fetch(`/api/insurance-local/participants-by-trip?trip_id=${tripId}`)
    if (res2.ok) {
      setParticipants(await res2.json())
    } else {
      // Fallback: użyj danych z participant_insurances jeśli endpoint nie istnieje
      setParticipants(
        data
          .filter((pi: { participants: unknown }) => pi.participants)
          .map((pi: {
            participants: { id: string; first_name: string; last_name: string; date_of_birth: string | null }
            bookings: { booking_ref: string } | null
          }) => ({
            id: pi.participants.id,
            first_name: pi.participants.first_name,
            last_name: pi.participants.last_name,
            date_of_birth: pi.participants.date_of_birth,
            booking_ref: pi.bookings?.booking_ref || "—",
          }))
      )
    }
  }

  async function loadLogs() {
    const res = await fetch(`/api/insurance-local/email-logs?trip_id=${tripId}&type=1&limit=5`)
    if (res.ok) setLogs(await res.json())
  }

  async function handleSelectVariant(variantId: string) {
    setSavingVariant(true)
    try {
      if (tripConfig) {
        // Usuń stary i dodaj nowy
        await fetch(`/api/insurance-local/trip-config/${tripId}/${tripConfig.id}`, { method: "DELETE" })
      }
      const res = await fetch(`/api/insurance-local/trip-config/${tripId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId, price_grosz: null }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await loadTripConfig()
      toast.success("Wariant ubezpieczenia zapisany")
    } catch (err) {
      toast.error("Błąd zapisu wariantu: " + String(err))
    } finally {
      setSavingVariant(false)
    }
  }

  async function handleDownloadXlsx() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/insurance-local/generate-xlsx/${tripId}/1`)
      if (!res.ok) throw new Error((await res.json()).error)
      const blob = await res.blob()
      const filename = res.headers.get("X-Filename") || "ubezpieczenie_podstawowe.xlsx"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error("Błąd pobierania XLSX: " + String(err))
    } finally {
      setDownloading(false)
    }
  }

  async function handleSendEmail() {
    if (!tripConfig) {
      toast.error("Najpierw wybierz wariant ubezpieczenia")
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/insurance-local/send-email/${tripId}/1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggered_by: "manual" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Email wysłany do ${data.recipients?.join(", ")} (${data.participants_count} uczestników)`)
      await loadLogs()
    } catch (err) {
      toast.error("Błąd wysyłki emaila: " + String(err))
    } finally {
      setSending(false)
    }
  }

  const columns = useMemo<ColumnDef<Participant>[]>(
    () => [
      {
        id: "name",
        header: "Imię i nazwisko",
        cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
      },
      {
        id: "date_of_birth",
        header: "Data urodzenia",
        cell: ({ row }) => formatDate(row.original.date_of_birth),
      },
      {
        id: "booking_ref",
        header: "Nr rezerwacji",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.booking_ref}</span>
        ),
      },
    ],
    []
  )

  if (loadingInit) {
    return <div className="text-sm text-muted-foreground">Ładowanie...</div>
  }

  return (
    <div className="space-y-6">
      {/* Konfiguracja wariantu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconShield className="h-4 w-4" />
            Wariant ubezpieczenia
          </CardTitle>
          <CardDescription>
            Obowiązkowe ubezpieczenie medyczne wliczone w cenę wycieczki. Obejmuje wszystkich uczestników.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label>Wybrany wariant</Label>
              <Select
                value={tripConfig?.insurance_variants?.id || ""}
                onValueChange={handleSelectVariant}
                disabled={savingVariant}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz wariant ubezpieczenia..." />
                </SelectTrigger>
                <SelectContent>
                  {allVariants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      {v.is_default && (
                        <span className="ml-2 text-xs text-muted-foreground">(domyślny)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tripConfig && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="font-medium">{tripConfig.insurance_variants.name}</span>
              <span className="text-muted-foreground ml-2">— {tripConfig.insurance_variants.provider}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Akcje */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconUsers className="h-4 w-4" />
            Uczestnicy ({participants.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadXlsx}
              disabled={downloading}
            >
              <IconDownload className="h-4 w-4 mr-1.5" />
              {downloading ? "Generowanie..." : "Pobierz XLSX"}
            </Button>
            <Button
              size="sm"
              onClick={handleSendEmail}
              disabled={sending || !tripConfig}
            >
              <IconMail className="h-4 w-4 mr-1.5" />
              {sending ? "Wysyłanie..." : "Wyślij email teraz"}
            </Button>
          </div>

          {participants.length > 0 ? (
            <ReusableTable
              columns={columns}
              data={participants}
              searchable={false}
              enablePagination={participants.length > 10}
              pageSize={10}
              emptyMessage="Brak uczestników"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Brak uczestników z aktywnymi rezerwacjami na tej wycieczce.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Historia wysyłek */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historia wysyłek</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-sm border rounded-md px-3 py-2"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium">{formatDateTime(log.sent_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {log.recipients.join(", ")} · {log.participants_count} uczestników
                      {log.triggered_by === "cron" && " · auto"}
                    </div>
                  </div>
                  <Badge variant={log.status === "sent" ? "default" : "destructive"}>
                    {log.status === "sent" ? "Wysłano" : "Błąd"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
