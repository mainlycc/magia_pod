"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { createClient } from "@/lib/supabase/client"
import { ReusableTable } from "@/components/reusable-table"
import { Button } from "@/components/ui/button"
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
import { Trash2 } from "lucide-react"

type MessageTemplate = {
  id: string
  title: string
  subject: string
  body: string
  created_at: string
}

export default function KomunikacjaMasowaPage() {
  const [rows, setRows] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [addError, setAddError] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<MessageTemplate[]>([])
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    body: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setAddError(null)
      const supabase = createClient()

      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Failed to load message templates", error)
        setAddError("Nie udało się wczytać szablonów")
        setRows([])
        return
      }

      setRows(data || [])
    } catch (error) {
      console.error("Error loading templates:", error)
      setAddError("Błąd podczas ładowania szablonów")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectionChange = useCallback((selected: MessageTemplate[]) => {
    setSelectedRows(selected)
  }, [])

  const handleAdd = () => {
    setFormData({ title: "", subject: "", body: "" })
    setEditingTemplate(null)
    setAddDialogOpen(true)
    setAddError(null)
  }

  const handleEdit = (template: MessageTemplate) => {
    setFormData({
      title: template.title,
      subject: template.subject,
      body: template.body,
    })
    setEditingTemplate(template)
    setEditDialogOpen(true)
    setAddError(null)
  }

  const handleConfirmAdd = async () => {
    if (!formData.title || !formData.subject || !formData.body) {
      setAddError("Wszystkie pola są wymagane")
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.from("message_templates").insert({
        title: formData.title.trim(),
        subject: formData.subject.trim(),
        body: formData.body.trim(),
      })

      if (error) {
        console.error("Failed to insert template", error)
        setAddError("Nie udało się dodać szablonu")
        return
      }

      setAddDialogOpen(false)
      setFormData({ title: "", subject: "", body: "" })
      setAddError(null)
      await loadData()
    } catch (error) {
      console.error("Error adding template:", error)
      setAddError("Błąd podczas dodawania szablonu")
    }
  }

  const handleConfirmEdit = async () => {
    if (!editingTemplate) return
    if (!formData.title || !formData.subject || !formData.body) {
      setAddError("Wszystkie pola są wymagane")
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("message_templates")
        .update({
          title: formData.title.trim(),
          subject: formData.subject.trim(),
          body: formData.body.trim(),
        })
        .eq("id", editingTemplate.id)

      if (error) {
        console.error("Failed to update template", error)
        setAddError("Nie udało się zaktualizować szablonu")
        return
      }

      setEditDialogOpen(false)
      setFormData({ title: "", subject: "", body: "" })
      setEditingTemplate(null)
      setAddError(null)
      await loadData()
    } catch (error) {
      console.error("Error updating template:", error)
      setAddError("Błąd podczas aktualizacji szablonu")
    }
  }

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return

    try {
      const supabase = createClient()
      const ids = selectedRows.map((r) => r.id)
      const { error } = await supabase
        .from("message_templates")
        .delete()
        .in("id", ids)

      if (error) {
        console.error("Failed to delete templates", error)
        return
      }

      await loadData()
      setSelectedRows([])
      setDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting templates:", error)
    }
  }

  const columns = useMemo<ColumnDef<MessageTemplate>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Tytuł",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title}</span>
        ),
      },
      {
        accessorKey: "subject",
        header: "Temat",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.subject}</span>
        ),
      },
    ],
    []
  )

  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>
  }

  return (
    <div className="space-y-4">
      {addError && (
        <div className="text-sm text-destructive">{addError}</div>
      )}

      <ReusableTable
        columns={columns}
        data={rows}
        searchable={true}
        searchPlaceholder="Szukaj po tytule lub temacie..."
        searchColumn="title"
        enablePagination={true}
        pageSize={20}
        emptyMessage="Brak szablonów wiadomości"
        onRowClick={handleEdit}
        onSelectionChange={handleSelectionChange}
        onAdd={handleAdd}
        addButtonLabel="Dodaj szablon"
        customToolbarButtons={(selectedCount) => (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={selectedCount === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Usuń
            {selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>
        )}
      />

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dodaj szablon wiadomości</DialogTitle>
            <DialogDescription>
              Utwórz nowy szablon wiadomości do komunikacji masowej
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Tytuł</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Nazwa szablonu"
              />
            </div>
            <div>
              <Label htmlFor="subject">Temat</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                placeholder="Temat wiadomości email"
              />
            </div>
            <div>
              <Label htmlFor="body">Treść</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) =>
                  setFormData({ ...formData, body: e.target.value })
                }
                placeholder="Treść wiadomości"
                className="min-h-[200px]"
              />
            </div>
            {addError && (
              <div className="text-sm text-destructive">{addError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleConfirmAdd}>Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edytuj szablon wiadomości</DialogTitle>
            <DialogDescription>
              Zaktualizuj szablon wiadomości
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Tytuł</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Nazwa szablonu"
              />
            </div>
            <div>
              <Label htmlFor="edit-subject">Temat</Label>
              <Input
                id="edit-subject"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                placeholder="Temat wiadomości email"
              />
            </div>
            <div>
              <Label htmlFor="edit-body">Treść</Label>
              <Textarea
                id="edit-body"
                value={formData.body}
                onChange={(e) =>
                  setFormData({ ...formData, body: e.target.value })
                }
                placeholder="Treść wiadomości"
                className="min-h-[200px]"
              />
            </div>
            {addError && (
              <div className="text-sm text-destructive">{addError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleConfirmEdit}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usunąć szablony?</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz usunąć wybrane szablony? Tej operacji nie
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

