"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { X, CalendarIcon } from "lucide-react";
import { format } from "date-fns/format";
import { pl } from "date-fns/locale";
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor";
import { PaymentScheduleItem } from "@/contexts/trip-context";

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
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const startDateRef = useRef<HTMLDivElement>(null);
  const endDateRef = useRef<HTMLDivElement>(null);

  // Zamykanie kalendarza po kliknięciu poza nim
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (startDateRef.current && !startDateRef.current.contains(event.target as Node)) {
        setStartDateOpen(false);
      }
      if (endDateRef.current && !endDateRef.current.contains(event.target as Node)) {
        setEndDateOpen(false);
      }
    };

    if (startDateOpen || endDateOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [startDateOpen, endDateOpen]);
  const [price, setPrice] = useState<string>("");
  const [seats, setSeats] = useState<string>("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [publicSlug, setPublicSlug] = useState<string>("");
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [availableCoordinators, setAvailableCoordinators] = useState<Coordinator[]>([]);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState<string>("");
  const [loadingCoordinators, setLoadingCoordinators] = useState(true);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>([]);

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
          setSlug(t.slug || "");
          setDescription(t.description || "");
          setStartDate(t.start_date ? new Date(t.start_date) : undefined);
          setEndDate(t.end_date ? new Date(t.end_date) : undefined);
          setPrice(t.price_cents != null ? String(t.price_cents / 100) : "");
          setSeats(t.seats_total != null ? String(t.seats_total) : "");
          setLocation(t.location || "");
          setIsPublic(Boolean(t.is_public));
          setPublicSlug(t.public_slug || "");
          // Załaduj harmonogram płatności
          if (t.payment_schedule && Array.isArray(t.payment_schedule)) {
            setPaymentSchedule(t.payment_schedule);
          } else {
            // Fallback: utwórz harmonogram z starych danych lub domyślny
            const firstPercent = t.payment_split_first_percent ?? 30;
            const secondPercent = t.payment_split_second_percent ?? 70;
            const defaultDate1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0];
            const defaultDate2 = t.start_date
              ? new Date(
                  new Date(t.start_date).getTime() - 14 * 24 * 60 * 60 * 1000
                )
                  .toISOString()
                  .split("T")[0]
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0];
            setPaymentSchedule([
              {
                installment_number: 1,
                percent: firstPercent,
                due_date: defaultDate1,
              },
              {
                installment_number: 2,
                percent: secondPercent,
                due_date: defaultDate2,
              },
            ]);
          }
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
    if (!title) {
      setError("Nazwa jest wymagana");
      return;
    }

    // Walidacja harmonogramu płatności
    const totalPercent = paymentSchedule.reduce(
      (sum, item) => sum + item.percent,
      0
    );
    if (totalPercent !== 100) {
      setError("Suma procentów w harmonogramie musi równać się 100%");
      return;
    }
    if (paymentSchedule.length === 0) {
      setError("Musisz dodać przynajmniej jedną ratę");
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/trips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          start_date: startDate ? startDate.toISOString().split("T")[0] : null,
          end_date: endDate ? endDate.toISOString().split("T")[0] : null,
          price_cents: price ? Math.round(parseFloat(price) * 100) : null,
          seats_total: seats ? parseInt(seats) : null,
          location: location || null,
          is_public: isPublic,
          public_slug: isPublic ? (publicSlug || null) : null,
          payment_schedule: paymentSchedule,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.error || "Błąd zapisu");
        setSaving(false);
        return;
      }
      
      toast.success("Wycieczka została zaktualizowana");
      // Nie przekierowujemy automatycznie, użytkownik może przejść do treści ręcznie
    } catch (err) {
      setError("Błąd podczas aktualizacji wycieczki");
    } finally {
      setSaving(false);
    }
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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/admin/trips">Wycieczki</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title || "Edytuj wycieczkę"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      <Card className="p-5 space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Nazwa *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nazwa wycieczki" />
          </div>
          <div className="grid gap-2">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug-wycieczki" disabled />
            <p className="text-xs text-muted-foreground">Slug nie może być zmieniony po utworzeniu wycieczki</p>
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
              <div className="relative" ref={startDateRef}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => {
                    setStartDateOpen(!startDateOpen);
                    setEndDateOpen(false);
                  }}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP", { locale: pl }) : "Wybierz datę"}
                </Button>
                {startDateOpen && (
                  <div className="absolute z-50 mt-1 rounded-md border bg-popover shadow-md">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        setStartDate(date);
                        setStartDateOpen(false);
                      }}
                      locale={pl}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Data zakończenia</Label>
              <div className="relative" ref={endDateRef}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => {
                    setEndDateOpen(!endDateOpen);
                    setStartDateOpen(false);
                  }}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP", { locale: pl }) : "Wybierz datę"}
                </Button>
                {endDateOpen && (
                  <div className="absolute z-50 mt-1 rounded-md border bg-popover shadow-md">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        setEndDate(date);
                        setEndDateOpen(false);
                      }}
                      locale={pl}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
            <PaymentScheduleEditor
              schedule={paymentSchedule}
              onChange={setPaymentSchedule}
              tripStartDate={startDate ? startDate.toISOString().split("T")[0] : null}
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
          <Button asChild variant="secondary">
            <Link href={`/admin/trips/${id}/content`}>Przejdź do treści</Link>
          </Button>
          <Button disabled={saving || !title} onClick={save}>
            {saving ? "Zapisywanie..." : "Zapisz"}
          </Button>
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


