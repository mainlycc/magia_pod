import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { demoTrips } from "@/lib/demo/mock-data";

export default function DemoPublicPage() {
  const trip = demoTrips[0];
  return (
    <div className="mx-auto max-w-screen-2xl px-0 pb-0">
      <div className="mx-auto max-w-3xl py-6 px-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">{trip.title}</CardTitle>
                <CardDescription>
                  {trip.location} • {trip.dateRange}
                </CardDescription>
              </div>
              <Badge variant="secondary">{trip.spotsLeft} wolne</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{trip.shortDescription}</p>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-lg font-semibold">{trip.price} PLN</div>
              <Button asChild>
                <Link href="/demo/booking">Zarezerwuj (demo)</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


