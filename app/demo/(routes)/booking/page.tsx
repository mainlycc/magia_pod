"use client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { demoTrips } from "@/lib/demo/mock-data";

export default function DemoBookingPage() {
  const trip = demoTrips[0];
  return (
    <div className="mx-auto max-w-screen-2xl px-0 pb-0">
      <div className="mx-auto max-w-3xl py-6 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Rezerwacja (demo)</CardTitle>
            <CardDescription>
              {trip.title} • {trip.dateRange} — {trip.price} PLN
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name">Imię i nazwisko</Label>
              <Input id="name" placeholder="Jan Kowalski" disabled />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" placeholder="jan@example.com" type="email" disabled />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="notes">Uwagi</Label>
              <Input id="notes" placeholder="Preferencje, pytania…" disabled />
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <div className="text-sm text-muted-foreground">Wersja pokazowa — wysyłka wyłączona</div>
            <Button disabled>Wyślij rezerwację</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}


