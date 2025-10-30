import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Trip = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  price_cents: number | null;
  seats_total: number | null;
  seats_reserved: number | null;
  is_active: boolean | null;
  gallery_urls: string[] | null;
};

export default async function TripPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const supabase = await createClient();

  const { data: trip, error } = await supabase
    .from("trips")
    .select(
      "id,title,slug,description,start_date,end_date,price_cents,seats_total,seats_reserved,is_active,gallery_urls",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .single<Trip>();

  if (error || !trip) {
    return (
      <div className="container mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold mb-2">Wycieczka nie została znaleziona</h1>
        <p className="text-muted-foreground">Sprawdź link lub skontaktuj się z biurem.</p>
      </div>
    );
  }

  const seatsLeft = Math.max(
    0,
    (trip.seats_total ?? 0) - (trip.seats_reserved ?? 0),
  );
  const price = trip.price_cents ? (trip.price_cents / 100).toFixed(2) : "-";

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{trip.title}</h1>
        <p className="text-muted-foreground">
          {trip.start_date && new Date(trip.start_date).toLocaleDateString()} —
          {" "}
          {trip.end_date && new Date(trip.end_date).toLocaleDateString()}
        </p>
      </div>

      {/* Galeria (prosty placeholder; rozbudujemy po dodaniu komponentów) */}
      {Array.isArray(trip.gallery_urls) && trip.gallery_urls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {trip.gallery_urls.slice(0, 6).map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Zdjęcie ${i + 1}`}
              className="h-40 w-full object-cover rounded-md"
            />
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-5 md:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold">Opis wycieczki</h2>
          <p className="whitespace-pre-wrap">{trip.description}</p>
        </Card>

        <Card className="p-5 space-y-4 h-fit">
          <div>
            <div className="text-sm text-muted-foreground">Cena</div>
            <div className="text-2xl font-bold">{price} PLN</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Miejsca</div>
            <div className="text-lg font-medium">Pozostało: {seatsLeft}</div>
          </div>
          <Button asChild disabled={seatsLeft <= 0} className="w-full">
            <Link href={`/trip/${trip.slug}/reserve`}>Zarezerwuj</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}


