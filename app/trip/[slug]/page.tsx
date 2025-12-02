import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Trip = {
  id: string;
  title: string;
  slug: string;
  public_slug?: string | null;
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
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await (params instanceof Promise ? params : Promise.resolve(params));
  const supabase = await createClient();

  // RLS automatycznie filtruje tylko aktywne i publiczne wycieczki (is_active = true AND is_public = true)
  // Więc nie musimy jawnie sprawdzać tych pól w zapytaniu
  // Szukamy po public_slug lub slug używając .or()
  const { data: trip, error } = await supabase
    .from("trips")
    .select(
      "id,title,slug,public_slug,description,start_date,end_date,price_cents,seats_total,seats_reserved,is_active,gallery_urls",
    )
    .or(`public_slug.eq.${slug},slug.eq.${slug}`)
    .maybeSingle<Trip>();

  if (error || !trip) {
    return (
      <div className="container mx-auto max-w-3xl space-y-3 p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Strona główna</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/trip">Wycieczki</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Nie znaleziono</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardHeader>
            <CardTitle>Wycieczka nie została znaleziona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">
              Sprawdź poprawność linku lub skontaktuj się z naszym biurem podróży.
            </p>
            <Button asChild variant="secondary">
              <Link href="/">Wróć na stronę główną</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const seatsLeft = Math.max(
    0,
    (trip.seats_total ?? 0) - (trip.seats_reserved ?? 0),
  );
  const price = trip.price_cents ? (trip.price_cents / 100).toFixed(2) : "-";

  return (
    <div className="container mx-auto max-w-5xl space-y-8 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Strona główna</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/trip">Wycieczki</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{trip.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={trip.is_active ? "default" : "secondary"}>
              {trip.is_active ? "Aktywna" : "W przygotowaniu"}
            </Badge>
            <div className="text-muted-foreground text-sm">
              {trip.start_date && new Date(trip.start_date).toLocaleDateString("pl-PL", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {" — "}
              {trip.end_date && new Date(trip.end_date).toLocaleDateString("pl-PL", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">{trip.title}</h1>
          <p className="text-muted-foreground max-w-2xl">
            Odkryj wyjątkową podróż przygotowaną przez Magię Podróżowania. Poniżej znajdziesz szczegółowy
            opis, informacje o dostępnych miejscach oraz możliwość rezerwacji.
          </p>
        </div>

        <Card className="w-full max-w-sm self-stretch md:self-auto">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-medium">Informacje o rezerwacji</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="text-xs uppercase text-muted-foreground">Cena za osobę</div>
              <div className="text-3xl font-semibold">{price} PLN</div>
            </div>
            <div className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Pozostało miejsc</span>
              <span className="text-base font-medium">{seatsLeft}</span>
            </div>
            <Separator />
            <div className="grid gap-3 text-sm text-muted-foreground">
              <p>Do rezerwacji potrzebne będą dane kontaktowe oraz lista uczestników.</p>
              <p>Po złożeniu rezerwacji otrzymasz e-mail z potwierdzeniem i wzorem umowy.</p>
            </div>
            <Button asChild disabled={seatsLeft <= 0} className="w-full">
              <Link href={`/trip/${trip.slug}/reserve`}>
                {seatsLeft > 0 ? "Przejdź do rezerwacji" : "Brak wolnych miejsc"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {Array.isArray(trip.gallery_urls) && trip.gallery_urls.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Galeria</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {trip.gallery_urls.slice(0, 8).map((url, index) => (
              <div
                key={url ?? index}
                className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
              >
                <Image
                  src={url}
                  alt={`Zdjęcie ${index + 1}`}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Tabs defaultValue="overview" className="w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Poznaj wycieczkę</h2>
              <p className="text-muted-foreground text-sm">
                Szczegóły programu, świadczenia oraz ważne informacje organizacyjne.
              </p>
            </div>
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="overview">Opis</TabsTrigger>
              <TabsTrigger value="details">Szczegóły</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Program i atrakcji</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap leading-relaxed">{trip.description}</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Najważniejsze informacje</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Termin wyjazdu</span>
                  <span className="font-medium">
                    {trip.start_date
                      ? new Date(trip.start_date).toLocaleDateString("pl-PL")
                      : "Do ustalenia"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Powrót</span>
                  <span className="font-medium">
                    {trip.end_date
                      ? new Date(trip.end_date).toLocaleDateString("pl-PL")
                      : "Do ustalenia"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Miejsca łącznie</span>
                  <span className="font-medium">{trip.seats_total ?? "Brak danych"}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Rezerwacje</span>
                  <span className="font-medium">{trip.seats_reserved ?? 0}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">
                    {trip.is_active ? "Aktywna" : "W przygotowaniu / archiwalna"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Dodatkowe świadczenia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>• Bezpłatne konsultacje z koordynatorem przed wyjazdem.</p>
            <p>• Pomoc w przygotowaniu dokumentów oraz formalności.</p>
            <p>• Możliwość rozszerzenia ubezpieczenia podróżnego.</p>
            <p>• Szczegółowy plan dnia w wersji elektronicznej.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}


