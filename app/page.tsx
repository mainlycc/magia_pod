import { LoginForm } from "@/components/login-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Jeśli użytkownik jest zalogowany, przekieruj go do odpowiedniego panelu
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", (user as { sub: string }).sub)
      .maybeSingle();

    if (profile?.role === "admin") {
      redirect("/admin");
    }
    if (profile?.role === "coordinator") {
      redirect("/coord");
    }
    redirect("/protected");
  }

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md p-5">
          <div className="w-full mb-6 text-center">
            <h1 className="text-3xl font-bold mb-2">Witamy!</h1>
            <p className="text-muted-foreground">Zaloguj się, aby uzyskać dostęp do panelu</p>
          </div>
          <Button asChild variant="outline" className="w-full mb-4">
            <Link href="/trip">Zobacz wycieczki</Link>
          </Button>
          <LoginForm />
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}
