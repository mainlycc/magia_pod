"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export default function NewTripPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [seats, setSeats] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");

  const effectivePublicSlug = isPublic ? (publicSlug || slug) : "";

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug,
        price_cents: price ? Math.round(parseFloat(price) * 100) : null,
        seats_total: seats ? parseInt(seats) : 0,
        is_active: true,
        is_public: isPublic,
        public_slug: effectivePublicSlug || null,
      }),
    });
    if (!res.ok) setError("Błąd tworzenia wycieczki");
    else router.push("/admin/trips");
    setSaving(false);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label>Nazwa</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
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
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Anuluj</Button>
        <Button disabled={saving || !title || !slug} onClick={save}>Zapisz</Button>
      </div>
    </Card>
  );
}


