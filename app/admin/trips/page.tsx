import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminTripsPage() {
  const supabase = await createClient();
  const { data: trips } = await supabase
    .from("trips")
    .select("id,title,start_date,end_date,price_cents,seats_total,seats_reserved,is_active")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wycieczki</h1>
        <Button asChild>
          <Link href="/admin/trips/new">Dodaj</Link>
        </Button>
      </div>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa</TableHead>
              <TableHead>Termin</TableHead>
              <TableHead>Cena</TableHead>
              <TableHead>Miejsca</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(trips ?? []).map((t) => {
              const price = t.price_cents ? (t.price_cents / 100).toFixed(2) : "-";
              const seatsLeft = Math.max(0, (t.seats_total ?? 0) - (t.seats_reserved ?? 0));
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>
                    {(t.start_date && new Date(t.start_date).toLocaleDateString()) || "-"} — {(t.end_date && new Date(t.end_date).toLocaleDateString()) || "-"}
                  </TableCell>
                  <TableCell>{price} PLN</TableCell>
                  <TableCell>{seatsLeft}/{t.seats_total}</TableCell>
                  <TableCell className="capitalize">{t.is_active ? "aktywny" : "archiwum"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button asChild variant="outline" size="sm"><Link href={`/admin/trips/${t.id}/edit`}>Edytuj</Link></Button>
                      <Button asChild variant="secondary" size="sm"><Link href={`/admin/trips/${t.id}/bookings`}>Rezerwacje</Link></Button>
                      <Button asChild variant="ghost" size="sm"><Link href={`/api/trips/${t.id}/toggle-active`}>{t.is_active ? "Archiwizuj" : "Aktywuj"}</Link></Button>
                      <Button asChild variant="ghost" size="sm"><Link href={`/api/trips/${t.id}/duplicate`}>Duplikuj</Link></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}


