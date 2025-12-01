import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid md:grid-cols-[240px_1fr]">
      <aside className="border-r p-4 space-y-4">
        <div className="text-lg font-semibold">CRM Admin</div>
        <nav className="grid gap-2">
          <Button asChild variant="ghost" className="justify-start">
            <Link href="/admin">Dashboard</Link>
          </Button>
          <Button asChild variant="ghost" className="justify-start">
            <Link href="/admin/trips">Wycieczki</Link>
          </Button>
          <Button asChild variant="ghost" className="justify-start">
            <Link href="/admin/bookings">Rezerwacje i Umowy</Link>
          </Button>
          <Button asChild variant="ghost" className="justify-start">
            <Link href="/admin/payments">Płatności</Link>
          </Button>
          <Button asChild variant="ghost" className="justify-start">
            <Link href="/admin/uczestnicy">Uczestnicy</Link>
          </Button>
          <Button asChild variant="ghost" className="justify-start">
            <Link href="/admin/coordinators/invite">Zaproszenia koordynatorów</Link>
          </Button>
          <Button asChild variant="ghost" className="justify-start">
            <Link href="/admin/przyklad">Przykład</Link>
          </Button>
        </nav>
      </aside>
      <main className="p-6 space-y-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Panel administracyjny</div>
        </Card>
        {children}
        <Toaster position="top-right" richColors />
      </main>
    </div>
  );
}


