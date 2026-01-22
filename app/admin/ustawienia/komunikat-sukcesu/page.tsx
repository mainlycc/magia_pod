"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripContentEditor } from "@/components/trip-content-editor";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type SuccessMessage = {
  id: string | null;
  title: string;
  message: string;
  is_active: boolean;
};

export default function PaymentSuccessMessagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadMessage();
  }, []);

  const loadMessage = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/payment-success-message");
      
      if (response.ok) {
        const data: SuccessMessage = await response.json();
        setTitle(data.title || "");
        setMessage(data.message || "");
        setIsActive(data.is_active ?? true);
      } else {
        // Fallback do domyślnych wartości
        setTitle("Rezerwacja i płatność zakończone pomyślnie!");
        setMessage('<p class="mb-2">Dziękujemy za rezerwację i płatność! Twoja rezerwacja została potwierdzona, a płatność została zaksięgowana.</p><p class="mt-2 text-sm">Wszystkie dokumenty (umowa, potwierdzenie płatności) zostały wysłane na Twój adres e-mail.</p><p class="mt-2 text-sm">Nie musisz ręcznie wgrywać podpisanej umowy - wszystko zostało automatycznie przetworzone.</p>');
        setIsActive(true);
      }
    } catch (error) {
      console.error("Error loading message:", error);
      toast.error("Nie udało się załadować komunikatu");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Tytuł jest wymagany");
      return;
    }

    if (!message.trim()) {
      toast.error("Treść komunikatu jest wymagana");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/payment-success-message", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          is_active: isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Nie udało się zapisać komunikatu");
      }

      toast.success("Komunikat został zapisany");
    } catch (error) {
      console.error("Error saving message:", error);
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać komunikatu");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Komunikat sukcesu płatności</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Komunikat sukcesu płatności</h1>
          <p className="text-sm text-muted-foreground">
            Edytuj komunikat wyświetlany użytkownikom po pomyślnej płatności
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Treść komunikatu</CardTitle>
          <CardDescription>
            Ten komunikat będzie wyświetlany na stronie /payments/success po pomyślnej płatności
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Tytuł</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Rezerwacja i płatność zakończone pomyślnie!"
            />
          </div>

          <div className="space-y-2">
            <Label>Treść komunikatu</Label>
            <TripContentEditor
              content={message}
              onChange={setMessage}
              label="Treść komunikatu"
            />
            <p className="text-sm text-muted-foreground">
              Możesz użyć HTML do formatowania tekstu. W komunikacie automatycznie będzie wyświetlany numer rezerwacji, jeśli jest dostępny.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is-active">Aktywny</Label>
              <p className="text-sm text-muted-foreground">
                Tylko aktywny komunikat będzie wyświetlany użytkownikom
              </p>
            </div>
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                "Zapisz"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
