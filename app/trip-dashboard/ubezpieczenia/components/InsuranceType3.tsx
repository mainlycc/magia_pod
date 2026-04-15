"use client"

import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ColumnDef } from "@tanstack/react-table"
import { ReusableTable } from "@/components/reusable-table"
import {
  IconDownload,
  IconMail,
  IconPlus,
  IconTrash,
  IconEdit,
  IconShieldCheck,
  IconClock,
} from "@tabler/icons-react"
import {
  InsuranceVariant,
  TripInsuranceVariant,
  ParticipantInsurance,
  EmailLog,
  formatPrice,
  formatDateTime,
} from "../types"

type Props = {
  tripId: string
}

export function InsuranceType3({ tripId }: Props) {
  const [allVariants, setAllVariants] = useState<InsuranceVariant[]>([])
  const [tripVariants, setTripVariants] = useState<TripInsuranceVariant[]>([])
  const [participants, setParticipants] = useState<ParticipantInsurance[]>([])
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addVariantId, setAddVariantId] = useState("")
  const [addPrice, setAddPrice] = useState("")
  const [addLoading, setAddLoading] = useState(false)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<TripInsuranceVariant | null>(null)
  const [editPrice, setEditPrice] = useState("")
  const [editLoading, setEditLoading] = useState(false)

  useEffect(() => {
    loadAll()
  }, [tripId])

  async function loadAll() {
    setLoadingInit(true)
    await Promise.all([loadVariants(), loadTripVariants(), loadParticipants(), loadLogs()])
    setLoadingInit(false)
  }

  async function loadVariants() {
    const res = await fetch("/api/insurance-local/variants?type=3")
    if (res.ok) setAllVariants(await res.json())
  }

  async function loadTripVariants() {
    const res = await fetch(`/api/insurance-local/trip-config/${tripId}`)
    if (!res.ok) return
    const data: TripInsuranceVariant[] = await res.json()
    setTripVariants(data.filter((tv) => tv.insurance_variants?.type === 3))
  }

  async function loadParticipants() {
    const res = await fetch(`/api/insurance-local/participant-insurances?trip_id=${tripId}&type=3`)
    if (res.ok) setParticipants(await res.json())
  }

  async function loadLogs() {
    const res = await fetch(`/api/insurance-local/email-logs?trip_id=${tripId}&type=3&limit=10`)
    if (res.ok) setLogs(await res.json())
  }

  async function handleAddVariant() {
    if (!addVariantId || !addPrice) {
      toast.error("Wybierz wariant i podaj cenę")
      return
    }
    const priceFloat = parseFloat(addPrice.replace(",", "."))
    if (isNaN(priceFloat) || priceFloat < 0) {
      toast.error("Nieprawidłowa cena")
      return
    }
    setAddLoading(true)
    try {
      const res = await fetch(`/api/insurance-local/trip-config/${tripId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant_id: addVariantId,
          price_grosz: Math.round(priceFloat * 100),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Wariant KR dodany")
      setAddDialogOpen(false)
      setAddVariantId("")
      setAddPrice("")
      await loadTripVariants()
    } catch (err) {
      toast.error("Błąd dodawania: " + String(err))
    } finally {
      setAddLoading(false)
    }
  }

  async function handleEditPrice() {
    if (!editingVariant || !editPrice) return
    const priceFloat = parseFloat(editPrice.replace(",", "."))
    if (isNaN(priceFloat) || priceFloat < 0) {
      toast.error("Nieprawidłowa cena")
      return
    }
    setEditLoading(true)
    try {
      const res = await fetch(
        `/api/insurance-local/trip-config/${tripId}/${editingVariant.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price_grosz: Math.round(priceFloat * 100) }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Cena zaktualizowana")
      setEditDialogOpen(false)
      setEditingVariant(null)
      await loadTripVariants()
    } catch (err) {
      toast.error("Błąd zapisu: " + String(err))
    } finally {
      setEditLoading(false)
    }
  }

  async function handleRemoveVariant(tv: TripInsuranceVariant) {
    const count = participants.filter(
      (pi) => pi.trip_insurance_variant_id === tv.id && pi.status !== "cancelled"
    ).length
    if (count > 0) {
      toast.error(`Nie można usunąć — ${count} uczestnik(ów) ma aktywne ubezpieczenie KR`)
      return
    }
    try {
      const res = await fetch(
        `/api/insurance-local/trip-config/${tripId}/${tv.id}`,
        { method: "DELETE" }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Wariant usunięty")
      await loadTripVariants()
    } catch (err) {
      toast.error("Błąd usuwania: " + String(err))
    }
  }

  async function handleDownloadXlsx() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/insurance-local/generate-xlsx/${tripId}/3`)
      if (!res.ok) throw new Error((await res.json()).error)
      const blob = await res.blob()
      const filename = res.headers.get("X-Filename") || "ubezpieczenie_KR.xlsx"
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
    setSending(true)
    try {
      const res = await fetch(`/api/insurance-local/send-email/${tripId}/3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggered_by: "manual" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Raport KR wysłany (${data.participants_count} ubezpieczeń)`)
      await loadLogs()
    } catch (err) {
      toast.error("Błąd wysyłki: " + String(err))
    } finally {
      setSending(false)
    }
  }

  const availableToAdd = allVariants.filter(
    (v) => !tripVariants.some((tv) => tv.insurance_variants?.id === v.id)
  )

  const participantColumns = useMemo<ColumnDef<ParticipantInsurance>[]>(
    () => [
      {
        id: "name",
        header: "Uczestnik",
        cell: ({ row }) => {
          const p = row.original.participants
          if (p) return `${p.first_name} ${p.last_name}`
          const b = row.original.bookings
          return b ? `${b.contact_first_name || ""} ${b.contact_last_name || ""}`.trim() || b.contact_email : "—"
        },
      },
      {
        id: "variant",
        header: "Wariant KR",
        cell: ({ row }) => row.original.trip_insurance_variants?.insurance_variants?.name || "—",
      },
      {
        id: "booking",
        header: "Nr umowy",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            #{row.original.bookings?.booking_ref || "—"}
          </span>
        ),
      },
      {
        id: "purchased_at",
        header: "Data zakupu",
        cell: ({ row }) => formatDateTime(row.original.purchased_at),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === "confirmed"
                ? "default"
                : row.original.status === "cancelled"
                ? "destructive"
                : "secondary"
            }
          >
            {row.original.status === "confirmed"
              ? "Potwierdzony"
              : row.original.status === "cancelled"
              ? "Anulowany"
              : "Zakupiony"}
          </Badge>
        ),
      },
    ],
    []
  )

  const logColumns = useMemo<ColumnDef<EmailLog>[]>(
    () => [
      {
        id: "sent_at",
        header: "Data wysyłki",
        cell: ({ row }) => formatDateTime(row.original.sent_at),
      },
      {
        id: "recipients",
        header: "Odbiorcy",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.recipients.join(", ")}
          </span>
        ),
      },
      {
        id: "participants_count",
        header: "Ubezpieczeń",
        cell: ({ row }) => row.original.participants_count,
      },
      {
        id: "triggered_by",
        header: "Źródło",
        cell: ({ row }) => (
          <Badge variant="outline">
            {row.original.triggered_by === "cron" ? "Auto" : "Ręcznie"}
          </Badge>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.status === "sent" ? "default" : "destructive"}>
            {row.original.status === "sent" ? "Wysłano" : "Błąd"}
          </Badge>
        ),
      },
    ],
    []
  )

  if (loadingInit) {
    return <div className="text-sm text-muted-foreground">Ładowanie...</div>
  }

  const activeParticipants = participants.filter((pi) => pi.status !== "cancelled")

  return (
    <div className="space-y-6">
      {/* Info o trybie działania */}
      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <IconClock className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <span className="font-medium">Raport dzienny:</span> System automatycznie wysyła raport codziennie o 09:00,
          obejmujący ubezpieczenia KR zakupione/potwierdzone poprzedniego dnia.
          Można też wysłać raport ręcznie poniżej.
        </div>
      </div>

      {/* Warianty KR */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconShieldCheck className="h-4 w-4" />
                Warianty KR na tej wycieczce
              </CardTitle>
              <CardDescription>
                Ubezpieczenie od kosztów rezygnacji — klient wykupuje opcjonalnie.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddDialogOpen(true)}
              disabled={availableToAdd.length === 0}
            >
              <IconPlus className="h-4 w-4 mr-1.5" />
              Dodaj wariant
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tripVariants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Brak przypisanych wariantów KR. Kliknij &quot;Dodaj wariant&quot;.
            </p>
          ) : (
            <div className="space-y-2">
              {tripVariants.map((tv) => {
                const count = participants.filter(
                  (pi) => pi.trip_insurance_variant_id === tv.id && pi.status !== "cancelled"
                ).length
                return (
                  <div
                    key={tv.id}
                    className="flex items-center justify-between rounded-md border px-4 py-3"
                  >
                    <div className="space-y-0.5">
                      <div className="font-medium text-sm">{tv.insurance_variants?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {tv.insurance_variants?.provider} · Cena:{" "}
                        <span className="font-medium text-foreground">{formatPrice(tv.price_grosz)}</span>
                        {count > 0 && (
                          <span className="ml-2">
                            · <span className="font-medium text-foreground">{count}</span> aktywnych
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingVariant(tv)
                          setEditPrice(
                            tv.price_grosz !== null
                              ? (tv.price_grosz / 100).toFixed(2)
                              : ""
                          )
                          setEditDialogOpen(true)
                        }}
                      >
                        <IconEdit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveVariant(tv)}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista zakupionych ubezpieczeń KR */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Zakupione ubezpieczenia KR — wszystkie ({activeParticipants.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadXlsx}
                disabled={downloading}
              >
                <IconDownload className="h-4 w-4 mr-1.5" />
                {downloading ? "Generowanie..." : "XLSX za wczoraj"}
              </Button>
              <Button
                size="sm"
                onClick={handleSendEmail}
                disabled={sending}
              >
                <IconMail className="h-4 w-4 mr-1.5" />
                {sending ? "Wysyłanie..." : "Wyślij raport za wczoraj"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeParticipants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Brak aktywnych ubezpieczeń KR na tej wycieczce.
            </p>
          ) : (
            <ReusableTable
              columns={participantColumns}
              data={participants}
              searchable={false}
              enablePagination={participants.length > 10}
              pageSize={10}
              emptyMessage="Brak ubezpieczeń KR"
            />
          )}
        </CardContent>
      </Card>

      {/* Historia raportów */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historia raportów KR</CardTitle>
          </CardHeader>
          <CardContent>
            <ReusableTable
              columns={logColumns}
              data={logs}
              searchable={false}
              enablePagination={logs.length > 5}
              pageSize={5}
              emptyMessage="Brak historii raportów"
            />
          </CardContent>
        </Card>
      )}

      {/* Dialog: dodaj wariant */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj wariant KR</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Wariant</Label>
              <Select value={addVariantId} onValueChange={setAddVariantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz wariant KR..." />
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cena (zł)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="np. 120.00"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleAddVariant} disabled={addLoading}>
              {addLoading ? "Dodawanie..." : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: edytuj cenę */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj cenę wariantu KR</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-medium">
              {editingVariant?.insurance_variants?.name}
            </div>
            <div className="space-y-2">
              <Label>Nowa cena (zł)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleEditPrice} disabled={editLoading}>
              {editLoading ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
