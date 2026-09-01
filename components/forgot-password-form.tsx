"use client";

import { cn } from "@/lib/utils";
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
import { useState } from "react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          data?.error === "email_send_failed"
            ? "Nie udało się wysłać wiadomości e-mail. Spróbuj ponownie później."
            : "Wystąpił błąd podczas resetowania hasła.",
        );
      }

      setSuccess(true);
    } catch (error: unknown) {
      if (error instanceof Error) {
        // Sprawdź czy to błąd sieciowy
        if (error.message.includes("fetch") || error.message.includes("Failed to fetch")) {
          setError(
            "Nie można połączyć się z serwerem. Sprawdź połączenie internetowe oraz czy zmienne środowiskowe Supabase są poprawnie skonfigurowane."
          );
        } else if (error.message.includes("Missing Supabase")) {
          setError(error.message);
        } else {
          setError(error.message);
        }
      } else {
        setError("Wystąpił nieoczekiwany błąd podczas resetowania hasła.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Sprawdź swoją skrzynkę e-mail</CardTitle>
            <CardDescription>Instrukcje resetowania hasła zostały wysłane</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Jeśli zarejestrowałeś się za pomocą e-maila i hasła, otrzymasz
              wiadomość z linkiem do resetowania hasła.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Zresetuj hasło</CardTitle>
            <CardDescription>
              Wpisz swój adres e-mail, a wyślemy Ci link do zresetowania hasła
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Wysyłanie..." : "Wyślij link do resetowania"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Masz już konto?{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  Zaloguj się
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
