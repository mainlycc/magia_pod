import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { demoParticipants, demoMessages, demoTrips } from "@/lib/demo/mock-data";

export default function DemoCoordPage() {
  const trip = demoTrips[0];
  return (
    <div className="mx-auto max-w-screen-2xl px-4 pb-10">
      <div className="mx-auto max-w-5xl py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Panel Koordynator (demo)</CardTitle>
            <CardDescription>
              {trip.title} • Uczestnicy i komunikacja
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium">Uczestnicy</div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imię i nazwisko</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoParticipants.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "confirmed" ? "secondary" : p.status === "pending" ? "outline" : "destructive"}>
                            {p.status === "confirmed" ? "Potwierdzony" : p.status === "pending" ? "Oczekuje" : "Anulowany"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Wiadomości</div>
              <div className="space-y-3">
                {demoMessages.map((m) => (
                  <div key={m.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{m.author}</div>
                      <div className="text-xs text-muted-foreground">{m.createdAt}</div>
                    </div>
                    <div className="text-sm mt-1">{m.content}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


