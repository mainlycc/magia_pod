"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Coordinator = {
  id: string;
  full_name: string | null;
  allowed_trip_ids: string[] | null;
};

export default function NewTripPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [price, setPrice] = useState("");
  const [seats, setSeats] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [selectedCoordinators, setSelectedCoordinators] = useState<Set<string>>(new Set());
  const [loadingCoordinators, setLoadingCoordinators] = useState(true);

  const effectivePublicSlug = isPublic ? (publicSlug || slug) : "";

  useEffect(() => {
    const loadCoordinators = async () => {
      try {
        const res = await fetch("/api/coordinators");
        if (res.ok) {
          const data = await res.json();
          setCoordinators(data);
        }
      } catch (err) {
        toast.error("Nie udało się wczytać koordynatorów");
      } finally {
        setLoadingCoordinators(false);
      }
    };
    loadCoordinators();
  }, []);

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

  const save = async () => {
    if (!title || !slug) {
      setError("Nazwa i slug są wymagane");
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          description: description || null,
          start_date: startDate || null,
          end_date: endDate || null,
          price_cents: price ? Math.round(parseFloat(price) * 100) : null,
          seats_total: seats ? parseInt(seats) : 0,
          is_active: true,
          is_public: isPublic,
          public_slug: effectivePublicSlug || null,
          category: category || null,
          location: location || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.error || "Błąd tworzenia wycieczki");
        setSaving(false);
        return;
      }

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

      // Przekieruj do strony edycji treści
      router.push(`/admin/trips/${tripId}/content`);
    } catch (err) {
      setError("Błąd podczas dodawania wycieczki");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Nazwa *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nazwa wycieczki" />
          </div>
          <div className="grid gap-2">
            <Label>Slug *</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug-wycieczki" />
          </div>
          <div className="grid gap-2">
            <Label>Opis</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opis wycieczki"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Data rozpoczęcia</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Data zakończenia</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Kategoria</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="np. Wycieczki górskie"
              />
            </div>
            <div className="grid gap-2">
              <Label>Miejsce</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="np. Islandia"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Cena (PLN)</Label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="grid gap-2">
            <Label>Liczba miejsc</Label>
            <Input
              type="number"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="mt-2 space-y-3 rounded-md border p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="is-public"
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(Boolean(checked))}
              />
              <div className="space-y-1">
                <Label htmlFor="is-public">Wygeneruj publiczną podstronę wycieczki</Label>
                <p className="text-xs text-muted-foreground">
                  Strona informacyjno-spzedażowa będzie dostępna publicznie pod adresem URL z poniższym slugiem.
                </p>
              </div>
            </div>

            {isPublic && (
              <div className="grid gap-2">
                <Label>Publiczny slug (opcjonalnie)</Label>
                <Input
                  placeholder="np. magicka-wycieczka-wlochy"
                  value={publicSlug}
                  onChange={(e) => setPublicSlug(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL: <span className="font-mono">/trip/{effectivePublicSlug || slug || "twoj-slug"}</span>
                </p>
              </div>
            )}
          </div>

          {coordinators.length > 0 && (
            <div className="grid gap-2">
              <Label>Koordynatorzy</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {loadingCoordinators ? (
                  <div className="text-sm text-muted-foreground">Ładowanie koordynatorów...</div>
                ) : (
                  coordinators.map((coord) => (
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
                  ))
                )}
              </div>
              {selectedCoordinators.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  Wybrano {selectedCoordinators.size} koordynatorów
                </p>
              )}
            </div>
          )}
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>Anuluj</Button>
          <Button disabled={saving || !title || !slug} onClick={save}>
            {saving ? "Zapisywanie..." : "Zapisz i przejdź do treści"}
          </Button>
        </div>
      </Card>
    </div>
  );
}


