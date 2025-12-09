"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
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
import { Mail, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CoordinatorListRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  allowed_trip_ids: string[] | null;
  trips_count: number;
  assigned_trips?: Array<{
    id: string;
    title: string;
    start_date: string | null;
  }>;
};

export default function AdminCoordinatorsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CoordinatorListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<CoordinatorListRow[]>([]);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; subject: string; body: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  useEffect(() => {
    loadData();
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch("/api/message-templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data || []);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setAddError(null);
      
      const response = await fetch("/api/coordinators/list");
      if (!response.ok) {
        throw new Error("Failed to load coordinators");
      }

      const data = await response.json();
      const mapped: CoordinatorListRow[] = (data || []).map((coordinator: any) => ({
        id: coordinator.id,
        full_name: coordinator.full_name || null,
        email: coordinator.email || null,
        allowed_trip_ids: coordinator.allowed_trip_ids || null,
        trips_count: coordinator.allowed_trip_ids && Array.isArray(coordinator.allowed_trip_ids) 
          ? coordinator.allowed_trip_ids.length 
          : 0,
        assigned_trips: coordinator.assigned_trips || [],
      }));

      setRows(mapped);
    } catch (error) {
      console.error("Failed to load coordinators", error);
      setAddError("Nie udało się wczytać koordynatorów");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectionChange = useCallback((selected: CoordinatorListRow[]) => {
    setSelectedRows(selected);
  }, []);

  const handleSendMessage = async () => {
    if (!messageSubject || !messageBody || selectedRows.length === 0) {
      setAddError("Wypełnij temat i treść wiadomości");
      return;
    }

    setSendingMessage(true);
    setAddError(null);

    try {
      const coordinatorIds = selectedRows.map((row) => row.id);
      const response = await fetch("/api/coordinators/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinatorIds,
          subject: messageSubject,
          body: messageBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAddError(data.error === "no_emails" 
          ? "Wybrani koordynatorzy nie mają adresów email" 
          : "Błąd wysyłki wiadomości");
        return;
      }

      // Sukces - zamknij dialog i wyczyść formularz
      setMessageDialogOpen(false);
      setMessageSubject("");
      setMessageBody("");
      setSelectedTemplateId("");
      setSelectedRows([]);
    } catch (error) {
      console.error("Error sending message:", error);
      setAddError("Błąd wysyłki wiadomości");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteCoordinators = async (coordinatorsToDelete: CoordinatorListRow[]) => {
    if (coordinatorsToDelete.length === 0) {
      return;
    }

    setDeleting(true);
    setAddError(null);

    try {
      const coordinatorIds = coordinatorsToDelete.map((c) => c.id);

      const response = await fetch("/api/coordinators/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinatorIds }),
      });

      if (!response.ok) {
        const data = await response.json();
        setAddError(data.error || "Nie udało się usunąć koordynatorów");
        return;
      }

      // Sukces - odśwież dane
      await loadData();
      setSelectedRows([]);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting coordinators:", error);
      setAddError("Błąd podczas usuwania koordynatorów");
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<CoordinatorListRow>[]>(
    () => [
      {
        accessorKey: "full_name",
        header: "Imię i nazwisko",
        cell: ({ row }) => (
          <div className="font-medium">
            {row.original.full_name || <span className="text-muted-foreground">Brak danych</span>}
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "E-mail",
        cell: ({ row }) => (
          <div className="text-sm">
            {row.original.email || <span className="text-muted-foreground">-</span>}
          </div>
        ),
      },
      {
        accessorKey: "trips_count",
        header: "Liczba wyjazdów",
        cell: ({ row }) => <div>{row.original.trips_count}</div>,
      },
      {
        id: "assigned_trips",
        header: "Przypisane wyjazdy",
        cell: ({ row }) => {
          const trips = row.original.assigned_trips || [];
          if (trips.length === 0) {
            return <span className="text-sm text-muted-foreground">Brak przypisanych wyjazdów</span>;
          }
          return (
            <div className="text-sm space-y-1">
              {trips.map((trip) => (
                <div key={trip.id} className="flex items-center gap-2">
                  <span className="font-medium">{trip.title}</span>
                  {trip.start_date && (
                    <span className="text-muted-foreground">
                      ({new Date(trip.start_date).toLocaleDateString("pl-PL")})
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        },
      },
    ],
    [],
  );

  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      {addError && (
        <p className="text-sm text-red-500">
          {addError}
        </p>
      )}

      <ReusableTable
        columns={columns}
        data={rows}
        searchable
        searchPlaceholder="Szukaj po imieniu, nazwisku, emailu..."
        customGlobalFilterFn={(row, filterValue) => {
          const searchLower = filterValue.toLowerCase();
          const fullName = (row.full_name || "").toLowerCase();
          const email = (row.email || "").toLowerCase();
          const tripTitles = (row.assigned_trips || [])
            .map((trip: { id: string; title: string; start_date: string | null }) => trip.title.toLowerCase())
            .join(" ");
          
          return (
            fullName.includes(searchLower) ||
            email.includes(searchLower) ||
            tripTitles.includes(searchLower)
          );
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
        enablePagination
        pageSize={20}
        emptyMessage="Brak koordynatorów"
        onRowClick={(row) => {
          router.push(`/admin/coordinators/invite`);
        }}
        onSelectionChange={handleSelectionChange}
      />

      {/* Dialog wysyłania wiadomości */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Wyślij wiadomość grupową</DialogTitle>
            <DialogDescription>
              Wyślesz wiadomość do {selectedRows.length} zaznaczonych koordynatorów.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="message-template">Wybierz szablon (opcjonalnie)</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={(value) => {
                  setSelectedTemplateId(value);
                  if (value) {
                    const template = templates.find((t) => t.id === value);
                    if (template) {
                      setMessageSubject(template.subject);
                      setMessageBody(template.body);
                    }
                  } else {
                    setMessageSubject("");
                    setMessageBody("");
                  }
                }}
              >
                <SelectTrigger id="message-template">
                  <SelectValue placeholder="Brak szablonu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Brak szablonu</SelectItem>
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
                setMessageDialogOpen(false);
                setMessageSubject("");
                setMessageBody("");
                setSelectedTemplateId("");
                setAddError(null);
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
            <DialogTitle>Usuń koordynatorów?</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz usunąć {selectedRows.length} zaznaczonych koordynatorów? 
              Ta operacja nie może być cofnięta. Konta koordynatorów zostaną całkowicie usunięte.
            </DialogDescription>
          </DialogHeader>
          {addError && (
            <p className="text-sm text-red-500">{addError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setAddError(null);
              }}
              disabled={deleting}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteCoordinators(selectedRows)}
              disabled={deleting || selectedRows.length === 0}
            >
              {deleting ? "Usuwanie..." : "Usuń"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

