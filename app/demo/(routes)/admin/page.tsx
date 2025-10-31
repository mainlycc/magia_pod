import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { demoTrips } from "@/lib/demo/mock-data";

export default function DemoAdminPage() {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 pb-10">
      <div className="mx-auto max-w-5xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Panel Admin (demo)</CardTitle>
            <CardDescription>Lista wycieczek, akcje wyłączone</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazwa</TableHead>
                    <TableHead>Termin</TableHead>
                    <TableHead>Miejsce</TableHead>
                    <TableHead>Miejsca</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoTrips.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell>{t.dateRange}</TableCell>
                      <TableCell>{t.location}</TableCell>
                      <TableCell>
                        {t.spotsTotal - t.spotsLeft}/{t.spotsTotal}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.isActive ? "secondary" : "outline"}>
                          {t.isActive ? "Aktywna" : "Wyłączona"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" disabled>
                          Edytuj
                        </Button>
                        <Button size="sm" variant="outline" disabled>
                          Zduplikuj
                        </Button>
                        <Button size="sm" variant="destructive" disabled>
                          Usuń
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


