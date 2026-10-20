"use client"

import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ColumnDef } from "@tanstack/react-table"
import { ReusableTable } from "@/components/reusable-table"
import {
  IconDownload,
  IconMail,
  IconShield,
  IconUsers,
  IconClock,
  IconPlus,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react"
import {
  InsuranceVariant,
  TripInsuranceVariant,
  EmailLog,
  formatDate,
  formatDateTime,
} from "../types"
import { formatPublicAgreementNumber } from "@/lib/agreements/public-agreement-number"

type Props = {
  tripId: string
  tripTitle: string
}

type Participant = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  agreement_number: string
}

type ExtraPerson = {
  id: string
  first_name: string
  last_name: string
  birth_date: string
}

type ListRow = Participant & { isExtra: boolean }

export function InsuranceType1({ tripId, tripTitle }: Props) {
  const [allVariants, setAllVariants] = useState<InsuranceVariant[]>([])
  const [tripConfig, setTripConfig] = useState<TripInsuranceVariant | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [extraPersons, setExtraPersons] = useState<ExtraPerson[]>([])
  const [personDialogOpen, setPersonDialogOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<ExtraPerson | null>(null)
  const [personFirstName, setPersonFirstName] = useState("")
  const [personLastName, setPersonLastName] = useState("")
  const [personBirthDate, setPersonBirthDate] = useState("")
  const [savingPerson, setSavingPerson] = useState(false)
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsTotalPages, setLogsTotalPages] = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)
  const LOGS_PAGE_SIZE = 10
  const [loadingInit, setLoadingInit] = useState(true)
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [savingVariant, setSavingVariant] = useState(false)

  useEffect(() => {
    loadAll()
  }, [tripId])

  async function loadAll() {
    setLoadingInit(true)
    await Promise.all([loadVariants(), loadTripConfig(), loadParticipants(), loadExtraPersons(), loadLogs()])
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
            bookings: { booking_ref: string; agreements?: any; trips?: any } | null
          }) => ({
            id: pi.participants.id,
            first_name: pi.participants.first_name,
            last_name: pi.participants.last_name,
            date_of_birth: pi.participants.date_of_birth,
            agreement_number: (() => {
              const b: any = pi.bookings
              const trip = Array.isArray(b?.trips) ? b.trips[0] : b?.trips
              const agreements = Array.isArray(b?.agreements) ? b.agreements : b?.agreements ? [b.agreements] : []
              const seq =
                agreements
                  .map((a: any) => a?.agreement_seq ?? 0)
                  .filter((n: number) => n > 0)
                  .sort((a: number, c: number) => c - a)[0] ?? null
              const formatted = formatPublicAgreementNumber({
                reservationNumber: trip?.reservation_number ?? null,
                agreementSeq: seq,
              })
              return formatted === "-" ? "—" : formatted
            })(),
          }))
      )
    }
  }

  async function loadExtraPersons() {
    const res = await fetch(`/api/insurance-local/extra-persons?trip_id=${tripId}`)
    if (res.ok) setExtraPersons(await res.json())
  }

  function openAddPerson() {
    setEditingPerson(null)
    setPersonFirstName("")
    setPersonLastName("")
    setPersonBirthDate("")
    setPersonDialogOpen(true)
  }

  function openEditPerson(person: ExtraPerson) {
    setEditingPerson(person)
    setPersonFirstName(person.first_name)
    setPersonLastName(person.last_name)
    setPersonBirthDate(person.birth_date?.slice(0, 10) ?? "")
    setPersonDialogOpen(true)
  }

  async function handleSavePerson() {
    setSavingPerson(true)
    try {
      const payload = {
        first_name: personFirstName,
        last_name: personLastName,
        birth_date: personBirthDate,
      }
      const res = editingPerson
        ? await fetch(`/api/insurance-local/extra-persons/${editingPerson.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/insurance-local/extra-persons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trip_id: tripId, ...payload }),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Nie udało się zapisać osoby")
      setPersonDialogOpen(false)
      await loadExtraPersons()
      toast.success(editingPerson ? "Zapisano osobę" : "Dodano osobę do listy ubezpieczenia")
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err))
    } finally {
      setSavingPerson(false)
    }
  }

  async function handleDeletePerson(person: ExtraPerson) {
    try {
      const res = await fetch(`/api/insurance-local/extra-persons/${person.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Nie udało się usunąć osoby")
      await loadExtraPersons()
      toast.success("Usunięto osobę z listy ubezpieczenia")
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err))
    }
  }

  async function loadLogs(page = 1) {
    setLogsLoading(true)
    try {
      const res = await fetch(
        `/api/insurance-local/email-logs?trip_id=${tripId}&type=1&page=${page}&pageSize=${LOGS_PAGE_SIZE}`
      )
      if (!res.ok) return
      const json = await res.json()
      const items = Array.isArray(json) ? json : json.data || []
      setLogs(items)
      setLogsPage(Array.isArray(json) ? page : json.page || page)
      setLogsTotal(Array.isArray(json) ? items.length : json.total || 0)
      setLogsTotalPages(
        Array.isArray(json)
          ? 1
          : Math.max(1, json.totalPages || Math.ceil((json.total || 0) / LOGS_PAGE_SIZE) || 1)
      )
    } finally {
      setLogsLoading(false)
    }
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
      await loadLogs(1)
    } catch (err) {
      toast.error("Błąd wysyłki emaila: " + String(err))
    } finally {
      setSending(false)
    }
  }

  const rows = useMemo<ListRow[]>(
    () => [
      ...participants.map((person) => ({ ...person, isExtra: false })),
      ...extraPersons.map((person) => ({
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        date_of_birth: person.birth_date,
        agreement_number: "—",
        isExtra: true,
      })),
    ],
    [participants, extraPersons]
  )

  const columns = useMemo<ColumnDef<ListRow>[]>(
    () => [
      {
        id: "name",
        header: "Imię i nazwisko",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span>{`${row.original.first_name} ${row.original.last_name}`}</span>
            {row.original.isExtra && <Badge variant="secondary">Opiekun</Badge>}
          </div>
        ),
      },
      {
        id: "date_of_birth",
        header: "Data urodzenia",
        cell: ({ row }) => formatDate(row.original.date_of_birth),
      },
      {
        id: "agreement_number",
        header: "Numer umowy",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.agreement_number}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          if (!row.original.isExtra) return null
          const person = extraPersons.find((item) => item.id === row.original.id)
          if (!person) return null
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openEditPerson(person)}
              >
                <IconEdit className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDeletePerson(person)}
              >
                <IconTrash className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        },
      },
    ],
    [extraPersons]
  )

  if (loadingInit) {
    return <div className="text-sm text-muted-foreground">Ładowanie...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <IconClock className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <span className="font-medium">Automatyczna wysyłka (5 dni przed startem):</span>{" "}
          Codziennie o 09:00 UTC system sprawdza wycieczki startujące za 5 dni, bierze
          wszystkich uczestników, generuje XLSX, wysyła mail ze szablonu i zapisuje historię —
          tego samego raportu nie wyśle drugi raz. Poniżej możesz też wysłać ręcznie.
        </div>
      </div>

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
            Uczestnicy ({rows.length})
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
            <Button variant="outline" size="sm" onClick={openAddPerson}>
              <IconPlus className="h-4 w-4 mr-1.5" />
              Dodaj osobę
            </Button>
          </div>

          {rows.length > 0 ? (
            <ReusableTable
              columns={columns}
              data={rows}
              searchable={false}
              enablePagination={rows.length > 10}
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
      {(logsTotal > 0 || logs.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Historia wysyłek
              {logsTotal > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({logsTotal})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
            {logsTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Strona {logsPage} z {logsTotalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logsLoading || logsPage <= 1}
                    onClick={() => loadLogs(logsPage - 1)}
                  >
                    Poprzednia
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logsLoading || logsPage >= logsTotalPages}
                    onClick={() => loadLogs(logsPage + 1)}
                  >
                    Następna
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
        <DialogContent
          onPointerDownOutside={(event) => {
            const target = event.target as HTMLElement | null
            if (target?.closest("[data-radix-popper-content-wrapper]")) {
              event.preventDefault()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{editingPerson ? "Edytuj osobę" : "Dodaj osobę do listy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Osoba trafi tylko do listy i maila ubezpieczenia podstawowego. Nie jest uczestnikiem wycieczki.
            </p>
            <div className="space-y-2">
              <Label htmlFor="extra-first-name">Imię</Label>
              <Input
                id="extra-first-name"
                value={personFirstName}
                onChange={(event) => setPersonFirstName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra-last-name">Nazwisko</Label>
              <Input
                id="extra-last-name"
                value={personLastName}
                onChange={(event) => setPersonLastName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data urodzenia</Label>
              <DatePicker
                value={personBirthDate}
                onChange={setPersonBirthDate}
                placeholder="Wybierz datę"
                className="w-full"
                fromYear={1900}
                toYear={new Date().getFullYear()}
                defaultYear={1990}
                captionLayout="dropdown"
                dimPastDays={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPersonDialogOpen(false)}
              disabled={savingPerson}
            >
              Anuluj
            </Button>
            <Button onClick={handleSavePerson} disabled={savingPerson}>
              {savingPerson ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
