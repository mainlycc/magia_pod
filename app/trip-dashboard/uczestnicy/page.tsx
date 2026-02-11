"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTrip } from "@/contexts/trip-context"
import { ColumnDef } from "@tanstack/react-table"
import { createClient } from "@/lib/supabase/client"
import { ReusableTable } from "@/components/reusable-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Mail, Trash2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Participant = {
  id: string
  first_name: string
  last_name: string
  pesel: string | null
  email: string | null
  phone: string | null
  booking_id: string
  bookings: {
    id: string
    booking_ref: string
    trip_id: string
  } | null
}

export default function UczestnicyPage() {
  const router = useRouter()
  const { selectedTrip } = useTrip()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [addError, setAddError] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Participant[]>([])
  const [messageDialogOpen, setMessageDialogOpen] = useState(false)
  const [messageSubject, setMessageSubject] = useState("")
  const [messageBody, setMessageBody] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; subject: string; body: string }>>([])
  const TEMPLATE_NONE_VALUE = "__none__"
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")

  useEffect(() => {
    if (!selectedTrip) {
      setLoading(false)
      return
    }
    loadData()
    loadTemplates()
  }, [selectedTrip])

  const loadTemplates = async () => {
    try {
      const response = await fetch("/api/message-templates")
      if (response.ok) {
        const data = await response.json()
        setTemplates(data || [])
      }
    } catch (error) {
      console.error("Failed to load templates:", error)
    }
  }

  const loadData = async () => {
    if (!selectedTrip) return

    try {
      setLoading(true)
      const supabase = createClient()

      // Pobierz uczestników dla wybranej wycieczki
      const { data, error } = await supabase
        .from("participants")
        .select(
          `
          id,
          first_name,
          last_name,
          pesel,
          email,
          phone,
          booking_id,
          bookings:bookings!inner(id, booking_ref, trip_id)
        `
        )
        .eq("bookings.trip_id", selectedTrip.id)

      if (error) {
        throw error
      }

      // Mapuj dane, aby bookings było pojedynczym obiektem zamiast tablicy
      const mappedParticipants = (data || []).map((participant: any) => ({
        ...participant,
        bookings: Array.isArray(participant.bookings) ? participant.bookings[0] || null : participant.bookings,
      }))

      setParticipants(mappedParticipants)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectionChange = useCallback((selected: Participant[]) => {
    setSelectedRows(selected)
  }, [])

  const handleSendMessage = async () => {
    if (!messageSubject || !messageBody || selectedRows.length === 0) {
      setAddError("Wypełnij temat i treść wiadomości")
      return
    }

    setSendingMessage(true)
    setAddError(null)

    try {
      const participantIds = selectedRows.map((row) => row.id)
      const response = await fetch("/api/participants/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds,
          subject: messageSubject,
          body: messageBody,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAddError(data.error === "no_emails" 
          ? "Wybrani uczestnicy nie mają adresów email" 
          : "Błąd wysyłki wiadomości")
        return
      }

      // Sukces - zamknij dialog i wyczyść formularz
      setMessageDialogOpen(false)
      setMessageSubject("")
      setMessageBody("")
      setSelectedTemplateId("")
      setSelectedRows([])
    } catch (error) {
      console.error("Error sending message:", error)
      setAddError("Błąd wysyłki wiadomości")
    } finally {
      setSendingMessage(false)
    }
  }

  const handleDeleteParticipants = async (participantsToDelete: Participant[]) => {
    if (participantsToDelete.length === 0) {
      return
    }

    setDeleting(true)
    setAddError(null)

    try {
      const supabase = createClient()
      const participantIds = participantsToDelete.map((p) => p.id)

      const { error } = await supabase
        .from("participants")
        .delete()
        .in("id", participantIds)

      if (error) {
        console.error("Failed to delete participants", error)
        setAddError("Nie udało się usunąć uczestników")
        return
      }

      // Sukces - odśwież dane
      await loadData()
      setSelectedRows([])
      setDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting participants:", error)
      setAddError("Błąd podczas usuwania uczestników")
    } finally {
      setDeleting(false)
    }
  }

  const columns = useMemo<ColumnDef<Participant>[]>(
    () => [
      {
        id: "name",
        header: "Imię i nazwisko",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.first_name} {row.original.last_name}
          </span>
        ),
      },
      {
        accessorKey: "pesel",
        header: "PESEL",
        cell: ({ row }) => row.original.pesel || <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) =>
          row.original.email || <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "phone",
        header: "Telefon",
        cell: ({ row }) =>
          row.original.phone || <span className="text-muted-foreground">—</span>,
      },
      {
        id: "booking",
        header: "Rezerwacja",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.bookings?.booking_ref || "—"}</span>
        ),
      },
      {
        id: "actions",
        header: "Akcje",
        cell: ({ row }) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/trip-dashboard/uczestnicy/${row.original.id}`)}
          >
            Szczegóły
          </Button>
        ),
      },
    ],
    [router]
  )

  if (!selectedTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Wybierz wycieczkę</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>
  }

  return (
    <div className="space-y-4">
      {addError && (
        <p className="text-sm text-red-500">
          {addError}
        </p>
      )}
      <div className="text-sm text-muted-foreground">
        Wycieczka: <span className="font-medium">{selectedTrip.title}</span>
      </div>
      <ReusableTable
        columns={columns}
        data={participants}
        searchable={true}
        searchPlaceholder="Szukaj po imieniu, nazwisku lub PESEL..."
        customGlobalFilterFn={(row, filterValue) => {
          const searchLower = filterValue.toLowerCase()
          const firstName = (row.first_name || "").toLowerCase()
          const lastName = (row.last_name || "").toLowerCase()
          const pesel = (row.pesel || "").toLowerCase()
          const email = (row.email || "").toLowerCase()
          const phone = (row.phone || "").toLowerCase()
          
          return (
            firstName.includes(searchLower) ||
            lastName.includes(searchLower) ||
            pesel.includes(searchLower) ||
            email.includes(searchLower) ||
            phone.includes(searchLower)
          )
        }}
        customToolbarButtons={(selectedCount) => (
          <>
            <Button
              onClick={() => setMessageDialogOpen(true)}
              size="sm"
              variant="default"
              disabled={selectedCount === 0}
            >
              <Mail className="mr-2 h-4 w-4" />
              Wyślij wiadomość
              {selectedCount > 0 && ` (${selectedCount})`}
            </Button>
            <Button
              onClick={() => setDeleteDialogOpen(true)}
              size="sm"
              variant="destructive"
              disabled={selectedCount === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Usuń
              {selectedCount > 0 && ` (${selectedCount})`}
            </Button>
          </>
        )}
        enableRowSelection={true}
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak uczestników dla tej wycieczki"
        onSelectionChange={handleSelectionChange}
      />

      {/* Dialog wysyłania wiadomości */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Wyślij wiadomość grupową</DialogTitle>
            <DialogDescription>
              Wyślesz wiadomość do {selectedRows.length} zaznaczonych uczestników.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="message-template">Wybierz szablon (opcjonalnie)</Label>
              <Select
                value={selectedTemplateId || undefined}
                onValueChange={(value) => {
                  if (value === TEMPLATE_NONE_VALUE) {
                    setSelectedTemplateId("")
                    setMessageSubject("")
                    setMessageBody("")
                    return
                  }

                  setSelectedTemplateId(value)
                  if (value) {
                    const template = templates.find((t) => t.id === value)
                    if (template) {
                      setMessageSubject(template.subject)
                      setMessageBody(template.body)
                    }
                  } else {
                    setMessageSubject("")
                    setMessageBody("")
                  }
                }}
              >
                <SelectTrigger id="message-template">
                  <SelectValue placeholder="Brak szablonu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TEMPLATE_NONE_VALUE}>Brak szablonu</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message-subject">Temat *</Label>
              <Input
                id="message-subject"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Temat wiadomości"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message-body">Wiadomość *</Label>
              <Textarea
                id="message-body"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Treść wiadomości"
                rows={8}
              />
            </div>
            {addError && (
              <p className="text-sm text-red-500">{addError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMessageDialogOpen(false)
                setMessageSubject("")
                setMessageBody("")
                setSelectedTemplateId("")
                setAddError(null)
              }}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={sendingMessage || !messageSubject || !messageBody}
            >
              {sendingMessage ? "Wysyłanie..." : "Wyślij"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog potwierdzenia usunięcia */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuń uczestników?</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz usunąć {selectedRows.length} zaznaczonych uczestników? 
              Ta operacja nie może być cofnięta. Uczestnicy powiązani z rezerwacjami zostaną 
              również usunięci wraz z rezerwacjami (jeśli to są jedyni uczestnicy w rezerwacji).
            </DialogDescription>
          </DialogHeader>
          {addError && (
            <p className="text-sm text-red-500">{addError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setAddError(null)
              }}
              disabled={deleting}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteParticipants(selectedRows)}
              disabled={deleting || selectedRows.length === 0}
            >
              {deleting ? "Usuwanie..." : "Usuń"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

