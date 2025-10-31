"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function EditTripPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("");
  const [seats, setSeats] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/trips/${params.id}`);
      if (res.ok) {
        const t = await res.json();
        setTitle(t.title ?? "");
        setPrice(t.price_cents ? String(t.price_cents / 100) : "");
        setSeats(String(t.seats_total ?? ""));
      } else {
        setError("Nie udało się wczytać wycieczki");
      }
      setLoading(false);
    })();
  }, [params.id]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/trips/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        price_cents: price ? Math.round(parseFloat(price) * 100) : null,
        seats_total: seats ? parseInt(seats) : null,
      }),
    });
    if (!res.ok) setError("Błąd zapisu");
    else router.push("/admin/trips");
    setSaving(false);
  };

  if (loading) return <div>Ładowanie...</div>;

  return (
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
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Anuluj</Button>
        <Button disabled={saving} onClick={save}>Zapisz</Button>
      </div>
    </Card>
  );
}


