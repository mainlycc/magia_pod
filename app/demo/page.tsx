import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DemoHubPage() {
  const tiles = [
    {
      href: "/demo/public",
      title: "Publiczny widok wycieczki",
      desc: "Karta wycieczki z podstawowymi danymi i CTA."
    },
    {
      href: "/demo/booking",
      title: "Rezerwacja",
      desc: "Formularz rezerwacji (disabled) i podsumowanie."
    },
    {
      href: "/demo/admin",
      title: "Panel Admin",
      desc: "Lista wycieczek, statusy, akcje wyszarzone."
    },
    {
      href: "/demo/coord",
      title: "Panel Koordynator",
      desc: "Uczestnicy, wiadomości, organizacja wyjazdu."
    }
  ];

  return (
    <div className="mx-auto max-w-screen-2xl px-0 pb-0">
      <div className="mx-auto max-w-5xl py-4 px-4">
        <h1 className="text-2xl font-semibold">Tryb demonstracyjny</h1>
        <p className="text-muted-foreground mt-1">Szybki przegląd kluczowych trybów interfejsu.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {tiles.map((t) => (
            <Card key={t.href}>
              <CardHeader>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>{t.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href={t.href}>Zobacz</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}


