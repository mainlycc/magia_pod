"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { ReusableTable } from "@/components/reusable-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
};

type TripFilterOption = {
  id: string;
  title: string;
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setAddError(null);
      const supabase = createClient();

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
      <h1 className="text-2xl font-semibold">Uczestnicy</h1>
      {addError && (
        <p className="text-sm text-red-500">
          {addError}
        </p>
      )}

      <ReusableTable
        columns={columns}
        data={rows}
        searchable
        searchPlaceholder="Szukaj po imieniu, nazwisku..."
        searchColumn="last_name"
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
      />
    </div>
  );
}


