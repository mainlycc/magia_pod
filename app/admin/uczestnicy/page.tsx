"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Mail, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ParticipantListRow = {
  id: string;
  first_name: string;
  last_name: string;
  pesel: string | null;
  birth_date: string | null;
  notes: string | null;
  age: number | null;
  trips_count: number;
  last_trip_title: string | null;
  last_trip_start: string | null;
  last_trip_end: string | null;
  last_trip_year: number | null;
  upcoming_trip_title: string | null;
  upcoming_trip_start: string | null;
  upcoming_trip_end: string | null;
  group_name: string | null;
  email?: string | null;
};

const calculateAgeFromBirthDate = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
};

const calculateAgeFromPesel = (pesel: string | null): number | null => {
  if (!pesel || pesel.length !== 11 || !/^\d{11}$/.test(pesel)) return null;
  const year = parseInt(pesel.slice(0, 2), 10);
  const monthRaw = parseInt(pesel.slice(2, 4), 10);
  const day = parseInt(pesel.slice(4, 6), 10);

  let century = 1900;
  let month = monthRaw;

  if (monthRaw > 80) {
    century = 1800;
    month = monthRaw - 80;
  } else if (monthRaw > 60) {
    century = 2200;
    month = monthRaw - 60;
  } else if (monthRaw > 40) {
    century = 2100;
    month = monthRaw - 40;
  } else if (monthRaw > 20) {
    century = 2000;
    month = monthRaw - 20;
  }

  const fullYear = century + year;
  const birthDate = new Date(fullYear, month - 1, day);
  if (Number.isNaN(birthDate.getTime())) return null;

  const diffMs = Date.now() - birthDate.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
};

const getAgeBucket = (age: number | null): string | null => {
  if (age == null) return null;
  if (age < 18) return "<18";
  if (age <= 25) return "18-25";
  if (age <= 40) return "26-40";
  return "40+";
};

export default function AdminParticipantsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ParticipantListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<ParticipantListRow[]>([]);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; subject: string; body: string }>>([]);
  const TEMPLATE_NONE_VALUE = "__none__";
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
      const supabase = createClient();

      // Pobierz wszystkich uczestników
      const { data, error } = await supabase.rpc("get_participants_overview");

      if (error) {
        console.error("Failed to load participants overview", error);
        setRows([]);
        return;
      }

      const mapped: ParticipantListRow[] = (data ?? []).map((row: any) => {
        const birthDate = row.birth_date as string | null;
        const pesel = row.pesel as string | null;
        const age = calculateAgeFromBirthDate(birthDate) ?? calculateAgeFromPesel(pesel);

        const lastTripStart = row.last_trip_start as string | null;
        const year = lastTripStart ? new Date(lastTripStart).getFullYear() : null;

        return {
          id: row.id,
          first_name: row.first_name,
          last_name: row.last_name,
          pesel,
          birth_date: birthDate,
          notes: row.notes ?? null,
          age,
          trips_count: row.trips_count ?? 0,
          last_trip_title: row.last_trip_title ?? null,
          last_trip_start: lastTripStart,
          last_trip_end: row.last_trip_end ?? null,
          last_trip_year: year,
          upcoming_trip_title: row.upcoming_trip_title ?? null,
          upcoming_trip_start: row.upcoming_trip_start ?? null,
          upcoming_trip_end: row.upcoming_trip_end ?? null,
          group_name: row.group_name ?? null,
        };
      });

      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectionChange = useCallback((selected: ParticipantListRow[]) => {
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
      const participantIds = selectedRows.map((row) => row.id);
      const response = await fetch("/api/participants/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds,
          subject: messageSubject,
          body: messageBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAddError(data.error === "no_emails" 
          ? "Wybrani uczestnicy nie mają adresów email" 
          : "Błąd wysyłki wiadomości");
        return;
      }

      // Sukces - zamknij dialog i wyczyść formularz
      setMessageDialogOpen(false);
      setMessageSubject("");
      setMessageBody("");
      setSelectedTemplateId("");
      setSelectedRows([]);
      // Pokaż sukces (możesz dodać toast jeśli masz)
    } catch (error) {
      console.error("Error sending message:", error);
      setAddError("Błąd wysyłki wiadomości");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteParticipants = async (participantsToDelete: ParticipantListRow[]) => {
    if (participantsToDelete.length === 0) {
      return;
    }

    setDeleting(true);
    setAddError(null);

    try {
      const supabase = createClient();
      const participantIds = participantsToDelete.map((p) => p.id);

      const { error } = await supabase
        .from("participants")
        .delete()
        .in("id", participantIds);

      if (error) {
        console.error("Failed to delete participants", error);
        setAddError("Nie udało się usunąć uczestników");
        return;
      }

      // Sukces - odśwież dane
      await loadData();
      setSelectedRows([]);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting participants:", error);
      setAddError("Błąd podczas usuwania uczestników");
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<ParticipantListRow>[]>(
    () => [
      {
        accessorKey: "full_name",
        header: "Imię i nazwisko",
        cell: ({ row }) => (
          <div className="font-medium">
            {row.original.first_name} {row.original.last_name}
          </div>
        ),
      },
      {
        id: "birth_date",
        header: "Data urodzenia",
        cell: ({ row }) => {
          const birthDate = row.original.birth_date
            ? new Date(row.original.birth_date).toLocaleDateString("pl-PL")
            : null;
          return (
            <div className="text-sm">
              {birthDate ? (
                <div>
                  {birthDate} {row.original.age != null && `(${row.original.age} lat)`}
                </div>
              ) : (
                <span className="text-muted-foreground">brak danych</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "trips_count",
        header: "Liczba wyjazdów",
        cell: ({ row }) => <div>{row.original.trips_count}</div>,
      },
      {
        id: "last_trip",
        header: "Ostatni wyjazd",
        cell: ({ row }) => {
          const title = row.original.last_trip_title;
          const start = row.original.last_trip_start
            ? new Date(row.original.last_trip_start).toLocaleDateString("pl-PL")
            : null;
          const end = row.original.last_trip_end
            ? new Date(row.original.last_trip_end).toLocaleDateString("pl-PL")
            : null;

          if (!title && !start) {
            return <span className="text-sm text-muted-foreground">brak</span>;
          }

          return (
            <div className="text-sm">
              {title && <div className="font-medium">{title}</div>}
              {start && (
                <div className="text-muted-foreground">
                  {start}
                  {end && ` — ${end}`}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "upcoming_trip",
        header: "Zaplanowany wyjazd",
        cell: ({ row }) => {
          const title = row.original.upcoming_trip_title;
          const start = row.original.upcoming_trip_start
            ? new Date(row.original.upcoming_trip_start).toLocaleDateString("pl-PL")
            : null;
          const end = row.original.upcoming_trip_end
            ? new Date(row.original.upcoming_trip_end).toLocaleDateString("pl-PL")
            : null;

          if (!title && !start) {
            return <span className="text-sm text-muted-foreground">brak</span>;
          }

          return (
            <div className="text-sm">
              {title && <div className="font-medium">{title}</div>}
              {start && (
                <div className="text-muted-foreground">
                  {start}
                  {end && ` — ${end}`}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "notes",
        header: "Uwagi",
        cell: ({ row }) => (
          <div className="text-sm max-w-xs truncate" title={row.original.notes ?? ""}>
            {row.original.notes || <span className="text-muted-foreground">-</span>}
          </div>
        ),
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
        searchPlaceholder="Szukaj po imieniu, nazwisku, wyjeździe..."
        customGlobalFilterFn={(row, filterValue) => {
          const searchLower = filterValue.toLowerCase();
          const firstName = (row.first_name || "").toLowerCase();
          const lastName = (row.last_name || "").toLowerCase();
          const lastTripTitle = (row.last_trip_title || "").toLowerCase();
          const upcomingTripTitle = (row.upcoming_trip_title || "").toLowerCase();
          const pesel = (row.pesel || "").toLowerCase();
          
          return (
            firstName.includes(searchLower) ||
            lastName.includes(searchLower) ||
            lastTripTitle.includes(searchLower) ||
            upcomingTripTitle.includes(searchLower) ||
            pesel.includes(searchLower)
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
        emptyMessage="Brak uczestników"
        addButtonLabel="Dodaj uczestnika"
        enableAddDialog={true}
        addDialogTitle="Dodaj uczestnika"
        addDialogDescription="Wprowadź podstawowe dane uczestnika. Pozostałe informacje możesz uzupełnić później."
        addFormFields={(formData, setFormData) => (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="first_name">Imię *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  placeholder="Imię"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last_name">Nazwisko *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  placeholder="Nazwisko"
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="pesel">PESEL</Label>
                <Input
                  id="pesel"
                  value={formData.pesel || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, pesel: e.target.value })
                  }
                  placeholder="PESEL (opcjonalnie)"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="birth_date">Data urodzenia</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, birth_date: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="email@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={formData.phone || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="Telefon kontaktowy"
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="group_name">Grupa</Label>
                <Input
                  id="group_name"
                  value={formData.group_name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, group_name: e.target.value })
                  }
                  placeholder="Nazwa grupy (opcjonalnie)"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Uwagi</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Dodatkowe informacje (opcjonalnie)"
                />
              </div>
            </div>
          </>
        )}
        onConfirmAdd={async (formData) => {
          if (!formData.first_name || !formData.last_name) {
            setAddError("Imię i nazwisko są wymagane.");
            return;
          }

          const supabase = createClient();

          const { error } = await supabase.from("participants").insert({
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            pesel: formData.pesel?.trim() || null,
            birth_date: formData.birth_date || null,
            email: formData.email?.trim() || null,
            phone: formData.phone?.trim() || null,
            group_name: formData.group_name?.trim() || null,
            notes: formData.notes?.trim() || null,
          });

          if (error) {
            console.error("Failed to insert participant", JSON.stringify(error, null, 2));
            setAddError(
              "Nie udało się dodać uczestnika. Sprawdź konfigurację tabeli participants w Supabase."
            );
            return;
          }

          setAddError(null);
          await loadData();
        }}
        onRowClick={(row) => {
          const r = row as ParticipantListRow;
          router.push(`/admin/uczestnicy/${r.id}`);
        }}
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
                    setSelectedTemplateId("");
                    setMessageSubject("");
                    setMessageBody("");
                    return;
                  }

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
                setDeleteDialogOpen(false);
                setAddError(null);
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
  );
}


