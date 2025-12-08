"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReusableTable } from "@/components/reusable-table";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

type Trip = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  price_cents: number | null;
  seats_total: number | null;
  seats_reserved: number | null;
  is_active: boolean | null;
  slug: string;
  public_slug: string | null;
  is_public: boolean | null;
};

type Coordinator = {
  id: string;
  full_name: string | null;
  allowed_trip_ids: string[] | null;
};

export default function AdminTripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      // Najpierw sprawdź, czy użytkownik jest zalogowany i jest adminem
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("User not authenticated:", userError);
        toast.error("Musisz być zalogowany jako administrator");
        setTrips([]);
        return;
      }

      // Sprawdź, czy użytkownik jest adminem
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      
      if (!profile || profile.role !== "admin") {
        console.error("User is not admin:", profile);
        toast.error("Brak uprawnień administratora");
        setTrips([]);
        return;
      }

      const [tripsRes, profilesRes] = await Promise.all([
        supabase
          .from("trips")
          .select("id,title,start_date,end_date,price_cents,seats_total,seats_reserved,is_active,slug,public_slug,is_public")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, allowed_trip_ids")
          .eq("role", "coordinator"),
      ]);

      if (tripsRes.error) {
        console.error("Error loading trips:", tripsRes.error);
        console.error("Error details:", JSON.stringify(tripsRes.error, null, 2));
        const error = tripsRes.error as any;
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Error hint:", error.hint);
        const errorMessage = error.message || error.code || error.hint || "Nieznany błąd";
        toast.error(`Błąd wczytywania wycieczek: ${errorMessage}`);
        setTrips([]);
        return;
      }

      if (tripsRes.data) {
        // Mapuj dane, aby upewnić się, że wszystkie pola są poprawnie ustawione
        const mappedTrips = tripsRes.data.map(trip => ({
          ...trip,
          public_slug: trip.public_slug ?? null,
          is_public: trip.is_public ?? false,
        }));
        setTrips(mappedTrips);
      } else {
        console.warn("No trips data returned");
        setTrips([]);
      }

      if (profilesRes.data) {
        // Pobierz emaile z auth.users używając admin client
        // W client component musimy użyć API route
        const usersRes = await fetch("/api/coordinators");
        if (usersRes.ok) {
          const coordinatorsData = await usersRes.json();
          setCoordinators(coordinatorsData);
        }
      }
    } catch (err) {
      toast.error("Nie udało się wczytać danych");
    } finally {
      setLoading(false);
    }
  };

  // Funkcja pomocnicza do znalezienia koordynatorów dla wycieczki
  const getCoordinatorsForTrip = (tripId: string): Coordinator[] => {
    return coordinators.filter(
      (coord) => coord.allowed_trip_ids && coord.allowed_trip_ids.includes(tripId)
    );
  };

  const handleDeleteSelected = async (selectedTrips: Trip[]) => {
    if (selectedTrips.length === 0) return;

    try {
      const deletePromises = selectedTrips.map((trip) =>
        fetch(`/api/trips/${trip.id}`, {
          method: "DELETE",
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const failed: Array<{ trip: Trip; reason: string }> = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "rejected") {
          failed.push({ trip: selectedTrips[i], reason: "Błąd sieci" });
        } else if (!result.value.ok) {
          const errorData = await result.value.json().catch(() => ({ error: "Unknown error" }));
          failed.push({
            trip: selectedTrips[i],
            reason: errorData.message || errorData.error || "Nieznany błąd",
          });
        }
      }

      if (failed.length > 0) {
        const failedNames = failed.map((f) => f.trip.title).join(", ");
        toast.error(
          `Nie udało się usunąć ${failed.length} z ${selectedTrips.length} wycieczek: ${failedNames}`
        );
      } else {
        toast.success(`Usunięto ${selectedTrips.length} wycieczek`);
      }

      await loadData();
    } catch (err) {
      toast.error("Błąd podczas usuwania wycieczek");
      console.error(err);
    }
  };

  // Definicja kolumn dla tabeli
  const columns = useMemo<ColumnDef<Trip>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Nazwa",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.title}</div>
        ),
      },
      {
        id: "dates",
        header: "Termin",
        cell: ({ row }) => {
          const start = row.original.start_date
            ? new Date(row.original.start_date).toLocaleDateString()
            : "-";
          const end = row.original.end_date
            ? new Date(row.original.end_date).toLocaleDateString()
            : "-";
          return <div>{start} — {end}</div>;
        },
      },
      {
        id: "price",
        header: "Cena",
        cell: ({ row }) => {
          const price = row.original.price_cents
            ? (row.original.price_cents / 100).toFixed(2)
            : "-";
          return <div>{price} PLN</div>;
        },
      },
      {
        id: "seats",
        header: "Miejsca",
        cell: ({ row }) => {
          const seatsLeft = Math.max(
            0,
            (row.original.seats_total ?? 0) - (row.original.seats_reserved ?? 0)
          );
          return <div>{seatsLeft}/{row.original.seats_total}</div>;
        },
      },
      {
        id: "coordinators",
        header: "Koordynatorzy",
        cell: ({ row }) => {
          const tripCoordinators = getCoordinatorsForTrip(row.original.id);
          return tripCoordinators.length > 0 ? (
            <div className="flex flex-wrap gap-1 max-w-xs">
              {tripCoordinators.map((coord) => (
                <Badge key={coord.id} variant="secondary" className="text-xs">
                  {coord.full_name || "Brak imienia i nazwiska"}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          );
        },
      },
      {
        id: "link",
        header: "Link",
        cell: ({ row }) => {
          const slug = row.original.public_slug || row.original.slug;
          if (!slug) {
            return <span className="text-sm text-muted-foreground">-</span>;
          }
          return (
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link href={`/trip/${slug}`} target="_blank" rel="noopener noreferrer">
                Otwórz
              </Link>
            </Button>
          );
        },
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => (
          <div className="capitalize">
            {row.original.is_active ? "aktywny" : "archiwum"}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-2 justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/trips/${row.original.id}/edit`}>
                Edytuj
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/trips/${row.original.id}/content`}>
                    Edytuj treść
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/api/trips/${row.original.id}/toggle-active`}>
                    {row.original.is_active ? "Archiwizuj" : "Aktywuj"}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/api/trips/${row.original.id}/duplicate`}>
                    Duplikuj
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [coordinators]
  );

  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      <ReusableTable
        columns={columns}
        data={trips}
        searchable={true}
        searchPlaceholder="Szukaj wycieczek..."
        searchColumn="title"
        onAdd={() => router.push("/admin/trips/new")}
        addButtonLabel="Dodaj wycieczkę"
        enableRowSelection={true}
        enablePagination={true}
        pageSize={10}
        emptyMessage="Brak wycieczek"
        enableDeleteDialog={true}
        onConfirmDelete={handleDeleteSelected}
        deleteDialogTitle="Usuń zaznaczone wycieczki?"
        deleteDialogDescription="Czy na pewno chcesz usunąć zaznaczone wycieczki? Ta operacja nie może być cofnięta. Nie można usunąć wycieczek z istniejącymi rezerwacjami."
        deleteButtonLabel="Usuń zaznaczone"
      />
    </div>
  );
}
