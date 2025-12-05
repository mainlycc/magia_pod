"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { X } from "lucide-react";

type Coordinator = {
  id: string;
  full_name: string | null;
};

export default function EditTripPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("");
  const [seats, setSeats] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [publicSlug, setPublicSlug] = useState<string>("");
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [availableCoordinators, setAvailableCoordinators] = useState<Coordinator[]>([]);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState<string>("");
  const [loadingCoordinators, setLoadingCoordinators] = useState(true);

  const loadCoordinators = async (tripId: string) => {
    if (!tripId) return;
    try {
      const [assignedRes, allRes] = await Promise.all([
        fetch(`/api/trips/${tripId}/coordinators`),
        fetch(`/api/coordinators`),
      ]);

      if (assignedRes.ok) {
        const assigned = await assignedRes.json();
        setCoordinators(assigned);
      }

      if (allRes.ok) {
        const all = await allRes.json();
        setAvailableCoordinators(all);
      }
    } catch (err) {
      toast.error("Nie udało się wczytać koordynatorów");
    } finally {
      setLoadingCoordinators(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Brak ID wycieczki");
      return;
    }
    
    const loadTrip = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/trips/${id}`);
        if (res.ok) {
          const t = await res.json();
          console.log("Trip data loaded:", t);
          // Ustaw wszystkie pola, nawet jeśli są null/undefined
          setTitle(t.title || "");
          setPrice(t.price_cents != null ? String(t.price_cents / 100) : "");
          setSeats(t.seats_total != null ? String(t.seats_total) : "");
          setIsPublic(Boolean(t.is_public));
          setPublicSlug(t.public_slug || "");
        } else {
          const errorText = await res.text();
          console.error("Failed to load trip:", res.status, errorText);
          setError("Nie udało się wczytać wycieczki");
        }
      } catch (err) {
        console.error("Error loading trip:", err);
        setError("Nie udało się wczytać wycieczki");
      } finally {
        setLoading(false);
      }
    };

    loadTrip();
    loadCoordinators(id);
  }, [id]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/trips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        price_cents: price ? Math.round(parseFloat(price) * 100) : null,
        seats_total: seats ? parseInt(seats) : null,
        is_public: isPublic,
        public_slug: isPublic ? publicSlug || undefined : null,
      }),
    });
    if (!res.ok) setError("Błąd zapisu");
    else router.push("/admin/trips");
    setSaving(false);
  };

  const assignCoordinator = async () => {
    if (!selectedCoordinatorId) return;

    try {
      const res = await fetch(`/api/trips/${id}/coordinators`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinator_id: selectedCoordinatorId,
          action: "assign",
        }),
      });

      if (res.ok) {
        toast.success("Koordynator został przypisany");
        setSelectedCoordinatorId("");
        if (id) {
          await loadCoordinators(id);
        }
      } else {
        toast.error("Nie udało się przypisać koordynatora");
      }
    } catch (err) {
      toast.error("Błąd podczas przypisywania koordynatora");
    }
  };

  const unassignCoordinator = async (coordinatorId: string) => {
    try {
      const res = await fetch(`/api/trips/${id}/coordinators`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinator_id: coordinatorId,
          action: "unassign",
        }),
      });

      if (res.ok) {
        toast.success("Koordynator został odpięty");
        if (id) {
          await loadCoordinators(id);
        }
      } else {
        toast.error("Nie udało się odpiąć koordynatora");
      }
    } catch (err) {
      toast.error("Błąd podczas odpinania koordynatora");
    }
  };

  if (loading) return <div>Ładowanie...</div>;

  // Filtruj dostępnych koordynatorów (nie przypisanych do tej wycieczki)
  const unassignedCoordinators = availableCoordinators.filter(
    (c) => !coordinators.some((assigned) => assigned.id === c.id)
  );

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Nazwa</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Cena (PLN)</Label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Liczba miejsc</Label>
            <Input value={seats} onChange={(e) => setSeats(e.target.value)} />
          </div>

          <div className="mt-2 space-y-3 rounded-md border p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="is-public"
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(Boolean(checked))}
              />
              <div className="space-y-1">
                <Label htmlFor="is-public">Publiczna podstrona wycieczki</Label>
                <p className="text-xs text-muted-foreground">
                  Gdy włączone, wycieczka będzie dostępna publicznie pod adresem URL z poniższym slugiem.
                </p>
              </div>
            </div>

            {isPublic && (
              <div className="grid gap-2">
                <Label>Publiczny slug</Label>
                <Input
                  placeholder="np. magicka-wycieczka-wlochy"
                  value={publicSlug}
                  onChange={(e) => setPublicSlug(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL: <span className="font-mono">/trip/{publicSlug || "twoj-slug"}</span>
                </p>
              </div>
            )}
          </div>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>Anuluj</Button>
          <Button disabled={saving} onClick={save}>Zapisz</Button>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-4">Koordynatorzy</h2>
          <Separator className="mb-4" />
        </div>

        {loadingCoordinators ? (
          <div className="text-sm text-muted-foreground">Ładowanie koordynatorów...</div>
        ) : (
          <>
            {/* Lista przypisanych koordynatorów */}
            {coordinators.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {coordinators.map((coordinator) => (
                  <Badge key={coordinator.id} variant="secondary" className="text-sm px-3 py-1.5">
                    {coordinator.full_name || "Brak imienia i nazwiska"}
                    <button
                      onClick={() => unassignCoordinator(coordinator.id)}
                      className="ml-2 hover:bg-destructive/20 rounded-full p-0.5"
                      aria-label="Usuń koordynatora"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Brak przypisanych koordynatorów</div>
            )}

            {/* Formularz przypisania nowego koordynatora */}
            {unassignedCoordinators.length > 0 && (
              <div className="flex gap-2 items-end">
                <div className="flex-1 grid gap-2">
                  <Label>Przypisz koordynatora</Label>
                  <Select value={selectedCoordinatorId} onValueChange={setSelectedCoordinatorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz koordynatora" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedCoordinators.map((coordinator) => (
                        <SelectItem key={coordinator.id} value={coordinator.id}>
                          {coordinator.full_name || "Brak imienia i nazwiska"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={assignCoordinator} disabled={!selectedCoordinatorId}>
                  Przypisz
                </Button>
              </div>
            )}

            {unassignedCoordinators.length === 0 && coordinators.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Wszyscy dostępni koordynatorzy są już przypisani do tej wycieczki
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}


