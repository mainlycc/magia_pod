import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const currency = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 0,
});

type LatestBooking = {
  id: string;
  booking_ref: string;
  created_at: string;
  status: string;
  payment_status: string;
  trip: {
    title: string | null;
    start_date: string | null;
  } | null;
};

type UpcomingTrip = {
  id: string;
  title: string;
  start_date: string | null;
  seats_total: number | null;
  seats_reserved: number | null;
};

type SalesBooking = {
  trip: {
    price_cents: number | null;
  } | null;
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const [
    todayCountRes,
    weekCountRes,
    totalCountRes,
    activeTripsRes,
    salesRes,
    latestBookingsRes,
    upcomingTripsRes,
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart.toISOString()),
    supabase.from("bookings").select("id", { count: "exact", head: true }),
    supabase.from("trips").select("seats_total, seats_reserved").eq("is_active", true),
    supabase
      .from("bookings")
      .select("trip:trips(price_cents)")
      .eq("status", "confirmed"),
    supabase
      .from("bookings")
      .select(
        "id, booking_ref, created_at, status, payment_status, trip:trips(title, start_date)",
      )
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("trips")
      .select("id, title, start_date, seats_total, seats_reserved, is_active")
      .eq("is_active", true)
      .order("start_date", { ascending: true })
      .limit(5),
  ]);

  const todayCount = todayCountRes.count ?? 0;
  const weekCount = weekCountRes.count ?? 0;
  const totalCount = totalCountRes.count ?? 0;

  const totalSeats = activeTripsRes.data?.reduce((acc, trip) => acc + (trip.seats_total ?? 0), 0) ?? 0;
  const reservedSeats =
    activeTripsRes.data?.reduce((acc, trip) => acc + (trip.seats_reserved ?? 0), 0) ?? 0;
  const occupancy = totalSeats > 0 ? Math.round((reservedSeats / totalSeats) * 100) : 0;

  const totalSalesCents =
    (salesRes.data as SalesBooking[] | null)?.reduce(
      (acc, booking) => acc + (booking.trip?.price_cents ?? 0),
      0,
    ) ?? 0;

  const latestBookings = (latestBookingsRes.data ?? []) as LatestBooking[];
  const upcomingTrips = (upcomingTripsRes.data ?? []) as UpcomingTrip[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Podsumowanie</h1>
        <p className="text-muted-foreground text-sm">
          Bieżące wskaźniki sprzedaży, obłożenia oraz ostatnie rezerwacje.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rezerwacje dziś
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{todayCount}</div>
            <p className="text-xs text-muted-foreground">Od północy do teraz</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rezerwacje (7 dni)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{weekCount}</div>
            <p className="text-xs text-muted-foreground">Łącznie od ostatnich 7 dni</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Łącznie rezerwacji
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">Potwierdzone rezerwacje</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sprzedaż (potwierdzona)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {currency.format(totalSalesCents / 100)}
            </div>
            <p className="text-xs text-muted-foreground">Suma cen z potwierdzonych rezerwacji</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Obłożenie aktywnych wycieczek</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div>
            <div className="text-4xl font-semibold">{occupancy}%</div>
            <p className="text-sm text-muted-foreground">
              {reservedSeats} / {totalSeats} miejsc zarezerwowanych
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Łączne miejsca</span>
              <span className="font-medium text-foreground">{totalSeats}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Zarezerwowane</span>
              <span className="font-medium text-foreground">{reservedSeats}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Wolne</span>
              <span className="font-medium text-foreground">
                {Math.max(totalSeats - reservedSeats, 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Ostatnie rezerwacje</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Wycieczka</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status płatności</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestBookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Brak rezerwacji do wyświetlenia.
                    </TableCell>
                  </TableRow>
                ) : (
                  latestBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.booking_ref}</TableCell>
                      <TableCell className="flex flex-col gap-1">
                        <span>{booking.trip?.title ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">
                          {booking.trip?.start_date
                            ? new Date(booking.trip.start_date).toLocaleDateString("pl-PL")
                            : "Termin w przygotowaniu"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(booking.created_at).toLocaleString("pl-PL", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={booking.payment_status === "paid" ? "default" : "secondary"}>
                          {booking.payment_status === "paid"
                            ? "Opłacona"
                            : booking.payment_status === "partial"
                              ? "Częściowa"
                              : booking.payment_status === "overpaid"
                                ? "Nadpłata"
                                : "Nieopłacona"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Nadchodzące wycieczki</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingTrips.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Brak aktywnych wycieczek w kalendarzu.
              </p>
            ) : (
              upcomingTrips.map((trip) => {
                const total = trip.seats_total ?? 0;
                const reserved = trip.seats_reserved ?? 0;
                const percentage = total > 0 ? Math.round((reserved / total) * 100) : 0;
                return (
                  <div key={trip.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-medium">{trip.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {trip.start_date
                            ? new Date(trip.start_date).toLocaleDateString("pl-PL")
                            : "Termin w przygotowaniu"}
                        </p>
                      </div>
                      <Badge variant={percentage >= 80 ? "default" : "secondary"}>
                        {percentage}%
                      </Badge>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Zarezerwowane: {reserved}</span>
                      <span>Miejsca: {total}</span>
                      <span>Wolne: {Math.max(total - reserved, 0)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
