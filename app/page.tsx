import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Jeśli użytkownik jest zalogowany, przekieruj go do panelu trip-dashboard
  if (user) {
    redirect("/trip-dashboard/wycieczki");
  }

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md p-5">
          <div className="w-full mb-6 text-center">
            <h1 className="text-3xl font-bold mb-2">Witamy!</h1>
            <p className="text-muted-foreground">Zaloguj się, aby uzyskać dostęp do panelu</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
