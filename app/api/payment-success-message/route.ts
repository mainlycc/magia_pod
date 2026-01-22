import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Helper do sprawdzenia czy użytkownik to admin
async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return profile?.role === "admin";
}

const updateMessageSchema = z.object({
  title: z.string().min(1, "Tytuł jest wymagany"),
  message: z.string().min(1, "Treść komunikatu jest wymagana"),
  is_active: z.boolean().optional(),
});

// GET - pobiera aktywny komunikat (publiczny dostęp)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Pobierz aktywny komunikat
    const { data: message, error } = await supabase
      .from("payment_success_messages")
      .select("id, title, message, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // Jeśli nie ma aktywnego komunikatu, zwróć domyślny
      return NextResponse.json({
        id: null,
        title: "Rezerwacja i płatność zakończone pomyślnie!",
        message: '<p class="mb-2">Dziękujemy za rezerwację i płatność! Twoja rezerwacja została potwierdzona, a płatność została zaksięgowana.</p><p class="mt-2 text-sm">Wszystkie dokumenty (umowa, potwierdzenie płatności) zostały wysłane na Twój adres e-mail.</p><p class="mt-2 text-sm">Nie musisz ręcznie wgrywać podpisanej umowy - wszystko zostało automatycznie przetworzone.</p>',
        is_active: true,
      });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error("GET /api/payment-success-message error:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}

// PATCH - aktualizuje komunikat (tylko admin)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, message, is_active } = parsed.data;

    // Pobierz aktualny aktywny komunikat
    const { data: currentMessage } = await supabase
      .from("payment_success_messages")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (currentMessage) {
      // Aktualizuj istniejący komunikat
      const { data: updated, error: updateError } = await supabase
        .from("payment_success_messages")
        .update({
          title,
          message,
          ...(is_active !== undefined && { is_active }),
        })
        .eq("id", currentMessage.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating payment success message:", updateError);
        return NextResponse.json(
          { error: "Failed to update message" },
          { status: 500 }
        );
      }

      return NextResponse.json(updated);
    } else {
      // Utwórz nowy komunikat
      const { data: created, error: createError } = await supabase
        .from("payment_success_messages")
        .insert({
          title,
          message,
          is_active: is_active ?? true,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating payment success message:", createError);
        return NextResponse.json(
          { error: "Failed to create message" },
          { status: 500 }
        );
      }

      return NextResponse.json(created);
    }
  } catch (error) {
    console.error("PATCH /api/payment-success-message error:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
