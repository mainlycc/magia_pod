"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getPostAuthRedirectPath } from "@/lib/auth/redirect";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparingSession, setIsPreparingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const router = useRouter();

  // Obsługa starych linków z ?code= bezpośrednio na /auth/update-password
  // oraz weryfikacja, że sesja recovery jest aktywna.
  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      try {
        const supabase = createClient();
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (!cancelled) {
              setError(exchangeError.message);
              setHasSession(false);
            }
            return;
          }
          window.history.replaceState({}, "", "/auth/update-password");
        }

        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          setHasSession(!!data.session);
          if (!data.session) {
            setError(
              "Link resetujący jest nieprawidłowy lub wygasł. Poproś o nowy link.",
            );
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setHasSession(false);
          setError(
            err instanceof Error
              ? err.message
              : "Nie udało się przygotować sesji resetu hasła.",
          );
        }
      } finally {
        if (!cancelled) setIsPreparingSession(false);
      }
    };

    void prepare();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      const redirectPath = await getPostAuthRedirectPath();
      router.push(redirectPath);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (
          error.message.includes("fetch") ||
          error.message.includes("Failed to fetch")
        ) {
          setError(
            "Nie można połączyć się z serwerem. Sprawdź połączenie internetowe oraz czy zmienne środowiskowe Supabase są poprawnie skonfigurowane.",
          );
        } else if (error.message.includes("Missing Supabase")) {
          setError(error.message);
        } else {
          setError(error.message);
        }
      } else {
        setError("Wystąpił nieoczekiwany błąd podczas aktualizacji hasła.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Ustaw nowe hasło</CardTitle>
          <CardDescription>
            Wprowadź nowe hasło poniżej, a następnie zaloguj się do panelu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPreparingSession ? (
            <p className="text-sm text-muted-foreground">
              Przygotowywanie sesji…
            </p>
          ) : hasSession ? (
            <form onSubmit={handleUpdatePassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="password">Nowe hasło</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Nowe hasło"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Zapisywanie…" : "Zapisz nowe hasło"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button asChild className="w-full">
                <Link href="/auth/forgot-password">Wyślij nowy link</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
