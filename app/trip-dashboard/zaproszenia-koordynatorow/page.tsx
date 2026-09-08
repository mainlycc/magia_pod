"use client"

import { useEffect, useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ReusableTable } from "@/components/reusable-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { RefreshCw, X } from "lucide-react"

type Invitation = {
  id: string
  email: string
  status: "pending" | "accepted" | "expired"
  token?: string
  created_at: string
  expires_at: string
  accepted_at: string | null
  invited_by_email: string | null
}

export default function ZaproszeniaKoordynatorowPage() {
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Invitation[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const loadInvitations = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/coordinators/invitations")
      if (res.ok) {
        const data = await res.json()
        setInvitations(data)
      } else {
        toast.error("Nie udało się wczytać zaproszeń")
      }
    } catch (err) {
      toast.error("Błąd podczas ładowania zaproszeń")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvitations()
  }, [])

  const sendInvitation = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Podaj prawidłowy adres email")
      return
    }

    setSending(true)
    try {
      const res = await fetch("/api/coordinators/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (res.ok) {
        toast.success("Zaproszenie zostało wysłane")
        setEmail("")
        setInviteDialogOpen(false)
        await loadInvitations()
      } else {
        const error = await res.json()
        if (error.error === "user_already_exists") {
          toast.error("Użytkownik z tym emailem już istnieje")
        } else if (error.error === "invitation_already_exists") {
          toast.error("Aktywne zaproszenie dla tego emaila już istnieje")
        } else {
          toast.error("Nie udało się wysłać zaproszenia")
        }
      }
    } catch (err) {
      toast.error("Błąd podczas wysyłania zaproszenia")
    } finally {
      setSending(false)
    }
  }

  const handleBulkResend = async () => {
    if (selectedRows.length === 0) {
      toast.error("Wybierz przynajmniej jedno zaproszenie")
      return
    }

    try {
      const promises = selectedRows.map((inv) =>
        fetch(`/api/coordinators/invitations/${inv.id}/resend`, {
          method: "POST",
        })
      )

      await Promise.all(promises)
      toast.success(
        `Wysłano ponownie ${selectedRows.length} zaproszeń`
      )
      await loadInvitations()
      setSelectedRows([])
    } catch (err) {
      toast.error("Błąd podczas ponownego wysyłania zaproszeń")
    }
  }

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) {
      toast.error("Wybierz przynajmniej jedno zaproszenie")
      return
    }

    try {
      const promises = selectedRows.map((inv) =>
        fetch(`/api/coordinators/invitations/${inv.id}`, {
          method: "DELETE",
        })
      )

      await Promise.all(promises)
      toast.success(`Usunięto ${selectedRows.length} zaproszeń`)
      await loadInvitations()
      setSelectedRows([])
      setDeleteDialogOpen(false)
    } catch (err) {
      toast.error("Błąd podczas usuwania zaproszeń")
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Oczekujące",
      accepted: "Zaakceptowane",
      expired: "Wygasłe",
    }
    return labels[status] || status
  }

  const getStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "accepted":
        return "default"
      case "expired":
        return "destructive"
      default:
        return "outline"
    }
  }

  const columns = useMemo<ColumnDef<Invitation>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => <span className="font-medium">{row.original.email}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={getStatusVariant(row.original.status)}>
            {getStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Data utworzenia",
        cell: ({ row }) => {
          const date = new Date(row.original.created_at)
          return date.toLocaleDateString("pl-PL")
        },
      },
      {
        accessorKey: "expires_at",
        header: "Wygasa",
        cell: ({ row }) => {
          const date = new Date(row.original.expires_at)
          return date.toLocaleDateString("pl-PL")
        },
      },
    ],
    []
  )

  const canResendSelected =
    selectedRows.length > 0 && selectedRows.every((r) => r.status === "pending")

  return (
    <div className="space-y-4">
      {invitations.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Łącznie zaproszeń: {invitations.length} | Oczekujące:{" "}
          {invitations.filter((i) => i.status === "pending").length} |
          Zaakceptowane:{" "}
          {invitations.filter((i) => i.status === "accepted").length}
        </div>
      )}

      <ReusableTable
        columns={columns}
        data={invitations}
        searchable={true}
        searchPlaceholder="Szukaj po emailu..."
        searchColumn="email"
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak zaproszeń"
        onSelectionChange={setSelectedRows}
        onAdd={() => setInviteDialogOpen(true)}
        addButtonLabel="Dodaj zaproszenie"
        customToolbarButtons={(selectedCount) => (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkResend}
              disabled={!canResendSelected}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Wyślij ponownie
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={selectedCount === 0}
            >
              <X className="h-4 w-4 mr-2" />
              Usuń
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
          </>
        )}
      />

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj zaproszenie</DialogTitle>
            <DialogDescription>
              Wprowadź adres email koordynatora, którego chcesz zaprosić
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="koordynator@example.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendInvitation()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={sendInvitation} disabled={sending || !email}>
              {sending ? "Wysyłanie..." : "Wyślij zaproszenie"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usunąć zaproszenia?</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz usunąć wybrane zaproszenia? Tej operacji nie
              można cofnąć.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Anuluj
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              Usuń
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

