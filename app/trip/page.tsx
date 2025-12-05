import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Trip type can be inferred from the query; explicit type removed to avoid unused symbol

export default async function TripsIndexPage() {
  const supabase = await createClient();
  const { data: trips, error } = await supabase
    .from("trips")
    .select("id,title,slug,public_slug,start_date,end_date,price_cents")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="container mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold mb-2">Błąd wczytywania</h1>
        <p className="text-muted-foreground">Spróbuj ponownie później.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wycieczki</h1>
      {(!trips || trips.length === 0) ? (
        <Card className="p-5">
          <p className="text-muted-foreground">Brak aktywnych wycieczek. Dodaj rekord w tabeli <code>trips</code>.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {trips.map((t) => {
            const price = t.price_cents ? (t.price_cents / 100).toFixed(2) : "-";
            return (
              <Card key={t.id} className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{t.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {t.start_date && new Date(t.start_date).toLocaleDateString()} — {t.end_date && new Date(t.end_date).toLocaleDateString()} • {price} PLN
                  </div>
                </div>
                <Button asChild>
                  <Link href={`/trip/${t.slug}`}>Szczegóły</Link>
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


