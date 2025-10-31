import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function CoordLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid md:grid-cols-[240px_1fr]">
      <aside className="border-r p-4 space-y-4">
        <div className="text-lg font-semibold">Koordynator</div>
        <nav className="grid gap-2">
          <Button asChild variant="ghost" className="justify-start">
            <Link href="/coord">Wyjazdy</Link>
          </Button>
        </nav>
      </aside>
      <main className="p-6 space-y-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Panel koordynatora</div>
        </Card>
        {children}
      </main>
    </div>
  );
}


