"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { ReusableTable } from "@/components/reusable-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreHorizontal, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MessageTemplate = {
  id: string;
  title: string;
  subject: string;
  body: string;
  created_at: string;
};

export default function KomunikacjaMasowaPage() {
  const [rows, setRows] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<MessageTemplate[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    body: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setAddError(null);
      const supabase = createClient();

      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load message templates", error);
        setAddError("Nie udało się wczytać szablonów");
        setRows([]);
        return;
      }

      setRows(data || []);
    } catch (error) {
      console.error("Error loading templates:", error);
      setAddError("Błąd podczas ładowania szablonów");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectionChange = useCallback((selected: MessageTemplate[]) => {
    setSelectedRows(selected);
  }, []);

  const handleAdd = () => {
    setFormData({ title: "", subject: "", body: "" });
    setEditingTemplate(null);
    setAddDialogOpen(true);
    setAddError(null);
  };

  const handleEdit = (template: MessageTemplate) => {
    setFormData({
      title: template.title,
      subject: template.subject,
      body: template.body,
    });
    setEditingTemplate(template);
    setEditDialogOpen(true);
    setAddError(null);
  };

  const handleConfirmAdd = async () => {
    if (!formData.title || !formData.subject || !formData.body) {
      setAddError("Wszystkie pola są wymagane");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.from("message_templates").insert({
        title: formData.title.trim(),
        subject: formData.subject.trim(),
        body: formData.body.trim(),
      });

      if (error) {
        console.error("Failed to insert template", error);
        setAddError("Nie udało się dodać szablonu");
        return;
      }

      setAddDialogOpen(false);
      setFormData({ title: "", subject: "", body: "" });
      setAddError(null);
      await loadData();
    } catch (error) {
      console.error("Error adding template:", error);
      setAddError("Błąd podczas dodawania szablonu");
    }
  };

  const handleConfirmEdit = async () => {
    if (!editingTemplate) return;
    if (!formData.title || !formData.subject || !formData.body) {
      setAddError("Wszystkie pola są wymagane");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("message_templates")
        .update({
          title: formData.title.trim(),
          subject: formData.subject.trim(),
          body: formData.body.trim(),
        })
        .eq("id", editingTemplate.id);

      if (error) {
        console.error("Failed to update template", error);
        setAddError("Nie udało się zaktualizować szablonu");
        return;
      }

      setEditDialogOpen(false);
      setEditingTemplate(null);
      setFormData({ title: "", subject: "", body: "" });
      setAddError(null);
      await loadData();
    } catch (error) {
      console.error("Error updating template:", error);
      setAddError("Błąd podczas aktualizacji szablonu");
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedRows.length === 0) return;

    try {
      const supabase = createClient();
      const templateIds = selectedRows.map((row) => row.id);

      const { error } = await supabase
        .from("message_templates")
        .delete()
        .in("id", templateIds);

      if (error) {
        console.error("Failed to delete templates", error);
        setAddError("Nie udało się usunąć szablonów");
        return;
      }

      setDeleteDialogOpen(false);
      setSelectedRows([]);
      setAddError(null);
      await loadData();
    } catch (error) {
      console.error("Error deleting templates:", error);
      setAddError("Błąd podczas usuwania szablonów");
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const columns = useMemo<ColumnDef<MessageTemplate>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Tytuł",
        cell: ({ row }) => <div className="font-medium">{row.original.title}</div>,
        enableSorting: true,
      },
      {
        accessorKey: "subject",
        header: "Temat",
        cell: ({ row }) => <div className="text-sm">{row.original.subject}</div>,
        enableSorting: true,
      },
      {
        id: "body_preview",
        header: "Podgląd treści",
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground max-w-md">
            {truncateText(row.original.body, 80)}
          </div>
        ),
        enableSorting: false,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(row.original);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edytuj
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        enableSorting: false,
      },
    ],
    []
  );

  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      {addError && <p className="text-sm text-red-500">{addError}</p>}

      <ReusableTable
        columns={columns}
        data={rows}
        searchable
        searchPlaceholder="Szukaj po tytule lub temacie..."
        customGlobalFilterFn={(row, filterValue) => {
          const searchLower = filterValue.toLowerCase();
          const title = (row.title || "").toLowerCase();
          const subject = (row.subject || "").toLowerCase();
          return title.includes(searchLower) || subject.includes(searchLower);
        }}
        enableRowSelection={true}
        enablePagination
        pageSize={20}
        emptyMessage="Brak szablonów"
        addButtonLabel="Dodaj szablon"
        onAdd={handleAdd}
        enableDeleteDialog={true}
        onConfirmDelete={handleConfirmDelete}
        deleteDialogTitle="Usuń zaznaczone szablony?"
        deleteDialogDescription={`Czy na pewno chcesz usunąć ${selectedRows.length} zaznaczonych szablonów? Ta operacja nie może być cofnięta.`}
        deleteButtonLabel="Usuń zaznaczone"
        onSelectionChange={handleSelectionChange}
      />

      {/* Dialog dodawania */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Dodaj nowy szablon</DialogTitle>
            <DialogDescription>
              Utwórz nowy szablon wiadomości grupowej. Szablon będzie dostępny przy wysyłaniu wiadomości do uczestników i koordynatorów.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-title">Tytuł szablonu *</Label>
              <Input
                id="add-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Np. Potwierdzenie rezerwacji"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-subject">Temat wiadomości *</Label>
              <Input
                id="add-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Temat emaila"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-body">Treść wiadomości *</Label>
              <Textarea
                id="add-body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Treść wiadomości"
                rows={10}
              />
            </div>
            {addError && <p className="text-sm text-red-500">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleConfirmAdd} disabled={!formData.title || !formData.subject || !formData.body}>
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog edycji */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edytuj szablon</DialogTitle>
            <DialogDescription>
              Zaktualizuj dane szablonu wiadomości.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Tytuł szablonu *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Np. Potwierdzenie rezerwacji"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-subject">Temat wiadomości *</Label>
              <Input
                id="edit-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Temat emaila"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-body">Treść wiadomości *</Label>
              <Textarea
                id="edit-body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Treść wiadomości"
                rows={10}
              />
            </div>
            {addError && <p className="text-sm text-red-500">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleConfirmEdit} disabled={!formData.title || !formData.subject || !formData.body}>
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog usuwania */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuń zaznaczone szablony?</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz usunąć {selectedRows.length} zaznaczonych szablonów? Ta operacja nie może być cofnięta.
            </DialogDescription>
          </DialogHeader>
          {addError && <p className="text-sm text-red-500">{addError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Anuluj
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Usuń
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

