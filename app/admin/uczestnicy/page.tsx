"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { ReusableTable } from "@/components/reusable-table";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
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
        id: "id_data",
        header: "PESEL / data urodzenia",
        cell: ({ row }) => {
          const pesel = row.original.pesel;
          const birthDate = row.original.birth_date
            ? new Date(row.original.birth_date).toLocaleDateString("pl-PL")
            : null;
          return (
            <div className="text-sm">
              {pesel && <div>{pesel}</div>}
              {birthDate && (
                <div className="text-muted-foreground">
                  {birthDate} {row.original.age != null && `(${row.original.age} lat)`}
                </div>
              )}
              {!pesel && !birthDate && <span className="text-muted-foreground">brak danych</span>}
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

      <ReusableTable
        columns={columns}
        data={rows}
        searchable
        searchPlaceholder="Szukaj po imieniu, nazwisku, PESEL..."
        searchColumn="last_name"
        enableRowSelection={true}
        enablePagination
        pageSize={20}
        emptyMessage="Brak uczestników"
        addButtonLabel="Dodaj uczestnika"
        onAdd={() => router.push("/admin/bookings")}
        onRowClick={(row) => {
          const r = row as ParticipantListRow;
          router.push(`/admin/uczestnicy/${r.id}`);
        }}
      />
    </div>
  );
}


