import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function CoordHomePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;

  let trips: { id: string; title: string }[] = [];
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("allowed_trip_ids")
      .eq("id", userId)
      .single();

    if (profile?.allowed_trip_ids?.length) {
      const { data } = await supabase
        .from("trips")
        .select("id,title")
        .in("id", profile.allowed_trip_ids as string[]);
      trips = data ?? [];
    }
  }

  return (
    <div className="space-y-4">
      {trips.length === 0 ? (
        <Card className="p-5 text-sm text-muted-foreground">Brak przypisanych wyjazdów.</Card>
      ) : (
        <div className="grid gap-3">
          {trips.map((t) => (
            <Card key={t.id} className="p-4 flex items-center justify-between">
              <div className="font-medium">{t.title}</div>
              <Button asChild>
                <Link href={`/coord/trips/${t.id}/participants`}>Uczestnicy</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


