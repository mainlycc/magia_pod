import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const { data: today } = await supabase
    .from("bookings")
    .select("id, created_at")
    .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const { data: week } = await supabase
    .from("bookings")
    .select("id, created_at")
    .gte("created_at", weekStart.toISOString());

  const { count: total } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-5"><div className="text-sm text-muted-foreground">Rezerwacje dziś</div><div className="text-2xl font-bold">{today?.length ?? 0}</div></Card>
      <Card className="p-5"><div className="text-sm text-muted-foreground">Rezerwacje tydzień</div><div className="text-2xl font-bold">{week?.length ?? 0}</div></Card>
      <Card className="p-5"><div className="text-sm text-muted-foreground">Łącznie</div><div className="text-2xl font-bold">{total ?? 0}</div></Card>
    </div>
  );
}


