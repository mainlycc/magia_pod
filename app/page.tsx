import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
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
          <div className="w-full mb-6 flex flex-col items-center gap-4 text-center">
            <div className="flex flex-col items-center gap-3">
              <Image
                src="/logo23.png"
                alt="Magia podróżowania"
                width={72}
                height={72}
                className="size-[72px] object-contain"
                priority
              />
              <div className="text-sm font-semibold leading-none tracking-tight">
                <span className="block">MAGIA</span>
                <span className="block mt-0.5">PODRÓŻOWANIA</span>
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Witamy!</h1>
              <p className="text-muted-foreground">
                Zaloguj się, aby uzyskać dostęp do panelu
              </p>
            </div>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
