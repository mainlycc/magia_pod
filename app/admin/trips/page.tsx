"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    start_date: "",
    end_date: "",
    price: "",
    seats: "",
    category: "",
    location: "",
  });
  const [selectedCoordinators, setSelectedCoordinators] = useState<Set<string>>(new Set());

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEditDialog(row.original.id)}
            >
              Edytuj
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/admin/trips/${row.original.id}/bookings`}>
                Rezerwacje
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

  const toggleCoordinator = (coordinatorId: string) => {
    setSelectedCoordinators((prev) => {
      const next = new Set(prev);
      if (next.has(coordinatorId)) {
        next.delete(coordinatorId);
      } else {
        next.add(coordinatorId);
      }
      return next;
    });
  };

  const openEditDialog = async (tripId: string) => {
    setEditingTripId(tripId);
    setEditDialogOpen(true);
    
    // Załaduj dane wycieczki
    try {
      const tripRes = await fetch(`/api/trips/${tripId}`);
      if (tripRes.ok) {
        const trip = await tripRes.json();
        const formatDate = (dateStr: string | null) => {
          if (!dateStr) return "";
          const date = new Date(dateStr);
          return date.toISOString().split("T")[0];
        };
        setFormData({
          title: trip.title ?? "",
          slug: trip.slug ?? "",
          description: trip.description ?? "",
          start_date: formatDate(trip.start_date),
          end_date: formatDate(trip.end_date),
          price: trip.price_cents ? String(trip.price_cents / 100) : "",
          seats: String(trip.seats_total ?? ""),
          category: trip.category ?? "",
          location: trip.location ?? "",
        });
      }

      // Załaduj przypisanych koordynatorów
      const coordinatorsRes = await fetch(`/api/trips/${tripId}/coordinators`);
      if (coordinatorsRes.ok) {
        const assignedCoordinators = await coordinatorsRes.json();
        setSelectedCoordinators(new Set(assignedCoordinators.map((c: Coordinator) => c.id)));
      }
    } catch (err) {
      toast.error("Nie udało się wczytać danych wycieczki");
    }
  };

  const handleEditTrip = async () => {
    if (!editingTripId || !formData.title) {
      toast.error("Nazwa jest wymagana");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/trips/${editingTripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          price_cents: formData.price ? Math.round(parseFloat(formData.price) * 100) : null,
          seats_total: formData.seats ? parseInt(formData.seats) : null,
          category: formData.category || null,
          location: formData.location || null,
        }),
      });

      if (res.ok) {
        // Aktualizuj przypisanie koordynatorów
        const currentCoordinators = getCoordinatorsForTrip(editingTripId);
        const currentCoordinatorIds = new Set(currentCoordinators.map((c) => c.id));

        // Znajdź koordynatorów do przypisania (nowi)
        const toAssign = Array.from(selectedCoordinators).filter(
          (id) => !currentCoordinatorIds.has(id)
        );
        // Znajdź koordynatorów do odpięcia (usunięci)
        const toUnassign = Array.from(currentCoordinatorIds).filter(
          (id) => !selectedCoordinators.has(id)
        );

        // Wykonaj przypisania i odpięcia
        const assignPromises = toAssign.map((coordinatorId) =>
          fetch(`/api/trips/${editingTripId}/coordinators`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              coordinator_id: coordinatorId,
              action: "assign",
            }),
          })
        );

        const unassignPromises = toUnassign.map((coordinatorId) =>
          fetch(`/api/trips/${editingTripId}/coordinators`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              coordinator_id: coordinatorId,
              action: "unassign",
            }),
          })
        );

        const allPromises = [...assignPromises, ...unassignPromises];
        if (allPromises.length > 0) {
          const results = await Promise.allSettled(allPromises);
          const failed = results.filter((r) => r.status === "rejected" || !r.value?.ok).length;

          if (failed > 0) {
            toast.warning(`Wycieczka została zaktualizowana, ale nie udało się zaktualizować ${failed} przypisań koordynatorów`);
          } else {
            toast.success("Wycieczka została zaktualizowana");
          }
        } else {
          toast.success("Wycieczka została zaktualizowana");
        }

        setEditDialogOpen(false);
        setEditingTripId(null);
        setFormData({ title: "", slug: "", description: "", start_date: "", end_date: "", price: "", seats: "", category: "", location: "" });
        setSelectedCoordinators(new Set());
        await loadData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Nie udało się zaktualizować wycieczki");
      }
    } catch (err) {
      toast.error("Błąd podczas aktualizacji wycieczki");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTrip = async () => {
    if (!formData.title || !formData.slug) {
      toast.error("Nazwa i slug są wymagane");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          slug: formData.slug,
          description: formData.description || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          price_cents: formData.price ? Math.round(parseFloat(formData.price) * 100) : null,
          seats_total: formData.seats ? parseInt(formData.seats) : 0,
          is_active: true,
          category: formData.category || null,
          location: formData.location || null,
        }),
      });

      if (res.ok) {
        const tripData = await res.json();
        const tripId = tripData.id;

        // Jeśli wybrano koordynatorów, przypisz ich do wycieczki
        if (selectedCoordinators.size > 0 && tripId) {
          const assignPromises = Array.from(selectedCoordinators).map((coordinatorId) =>
            fetch(`/api/trips/${tripId}/coordinators`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                coordinator_id: coordinatorId,
                action: "assign",
              }),
            })
          );

          const results = await Promise.allSettled(assignPromises);
          const failed = results.filter((r) => r.status === "rejected" || !r.value?.ok).length;
          
          if (failed > 0) {
            toast.warning(`Wycieczka została dodana, ale nie udało się przypisać ${failed} koordynatorów`);
          } else {
            toast.success("Wycieczka została dodana i koordynatorzy przypisani");
          }
        } else {
          toast.success("Wycieczka została dodana");
        }

        setDialogOpen(false);
        setFormData({ title: "", slug: "", description: "", start_date: "", end_date: "", price: "", seats: "", category: "", location: "" });
        setSelectedCoordinators(new Set());
        await loadData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Nie udało się dodać wycieczki");
      }
    } catch (err) {
      toast.error("Błąd podczas dodawania wycieczki");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-4">Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Wycieczki</h1>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Dodaj nową wycieczkę</DialogTitle>
              <DialogDescription>
                Wypełnij formularz, aby dodać nową wycieczkę do systemu.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Nazwa *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Nazwa wycieczki"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="slug-wycieczki"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Opis</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Opis wycieczki"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start_date">Data rozpoczęcia</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_date">Data zakończenia</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="category">Kategoria</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="np. Wycieczki górskie"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Miejsce</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="np. Islandia"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Cena (PLN)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="seats">Liczba miejsc</Label>
                <Input
                  id="seats"
                  type="number"
                  value={formData.seats}
                  onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                  placeholder="0"
                />
              </div>
              {coordinators.length > 0 && (
                <div className="grid gap-2">
                  <Label>Koordynatorzy</Label>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {coordinators.map((coord) => (
                      <div key={coord.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`coord-${coord.id}`}
                          checked={selectedCoordinators.has(coord.id)}
                          onCheckedChange={() => toggleCoordinator(coord.id)}
                        />
                        <Label
                          htmlFor={`coord-${coord.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {coord.full_name || "Brak imienia i nazwiska"}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedCoordinators.size > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Wybrano {selectedCoordinators.size} koordynatorów
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setFormData({ title: "", slug: "", description: "", start_date: "", end_date: "", price: "", seats: "", category: "", location: "" });
                  setSelectedCoordinators(new Set());
                }}
              >
                Anuluj
              </Button>
              <Button disabled={saving || !formData.title || !formData.slug} onClick={handleAddTrip}>
                {saving ? "Zapisywanie..." : "Zapisz"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Dialog edycji wycieczki */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edytuj wycieczkę</DialogTitle>
            <DialogDescription>
              Zmień dane wycieczki i zarządzaj przypisanymi koordynatorami.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Nazwa *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Nazwa wycieczki"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Opis</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Opis wycieczki"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-start_date">Data rozpoczęcia</Label>
                <Input
                  id="edit-start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-end_date">Data zakończenia</Label>
                <Input
                  id="edit-end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-category">Kategoria</Label>
                <Input
                  id="edit-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="np. Wycieczki górskie"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-location">Miejsce</Label>
                <Input
                  id="edit-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="np. Islandia"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-price">Cena (PLN)</Label>
              <Input
                id="edit-price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-seats">Liczba miejsc</Label>
              <Input
                id="edit-seats"
                type="number"
                value={formData.seats}
                onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                placeholder="0"
              />
            </div>
            {coordinators.length > 0 && (
              <div className="grid gap-2">
                <Label>Koordynatorzy</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {coordinators.map((coord) => (
                    <div key={coord.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-coord-${coord.id}`}
                        checked={selectedCoordinators.has(coord.id)}
                        onCheckedChange={() => toggleCoordinator(coord.id)}
                      />
                      <Label
                        htmlFor={`edit-coord-${coord.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {coord.full_name || "Brak imienia i nazwiska"}
                      </Label>
                    </div>
                  ))}
                </div>
                {selectedCoordinators.size > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Wybrano {selectedCoordinators.size} koordynatorów
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingTripId(null);
                setFormData({ title: "", slug: "", description: "", start_date: "", end_date: "", price: "", seats: "", category: "", location: "" });
                setSelectedCoordinators(new Set());
              }}
            >
              Anuluj
            </Button>
            <Button disabled={saving || !formData.title} onClick={handleEditTrip}>
              {saving ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReusableTable
        columns={columns}
        data={trips}
        searchable={true}
        searchPlaceholder="Szukaj wycieczek..."
        searchColumn="title"
        onAdd={() => setDialogOpen(true)}
        addButtonLabel="Dodaj wycieczkę"
        enableRowSelection={true}
        enablePagination={true}
        pageSize={10}
        emptyMessage="Brak wycieczek"
      />
    </div>
  );
}
