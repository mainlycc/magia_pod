import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "no_file" }, { status: 400 });
    }

    // Sprawdź czy to obraz
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
    }

    // Generuj unikalną nazwę pliku
    const fileExt = file.name.split(".").pop();
    const fileName = `${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload do Supabase Storage
    const adminClient = createAdminClient();
    
    // Sprawdź czy bucket istnieje, jeśli nie - utwórz go
    const { data: buckets } = await adminClient.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.id === "trip-gallery");
    
    if (!bucketExists) {
      // Utwórz bucket jeśli nie istnieje
      const { error: createBucketError } = await adminClient.storage.createBucket("trip-gallery", {
        public: true,
        allowedMimeTypes: ["image/*"],
      });
      
      if (createBucketError) {
        console.error("Error creating bucket:", createBucketError);
        // Spróbuj kontynuować - może bucket już istnieje
      }
    }
    
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("trip-gallery")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }

    // Pobierz publiczny URL
    const {
      data: { publicUrl },
    } = adminClient.storage.from("trip-gallery").getPublicUrl(fileName);

    // Dodaj URL do gallery_urls w trips
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("gallery_urls")
      .eq("id", id)
      .single();

    if (tripError || !trip) {
      // Usuń plik jeśli nie udało się zaktualizować bazy
      await adminClient.storage.from("trip-gallery").remove([fileName]);
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }

    const currentUrls = (trip.gallery_urls as string[]) || [];
    const updatedUrls = [...currentUrls, publicUrl];

    const { error: updateError } = await supabase
      .from("trips")
      .update({ gallery_urls: updatedUrls })
      .eq("id", id);

    if (updateError) {
      // Usuń plik jeśli nie udało się zaktualizować bazy
      await adminClient.storage.from("trip-gallery").remove([fileName]);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    return NextResponse.json({ url: publicUrl, success: true });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json({ error: "no_url" }, { status: 400 });
    }

    // Pobierz aktualne gallery_urls
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("gallery_urls")
      .eq("id", id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }

    const currentUrls = (trip.gallery_urls as string[]) || [];
    const updatedUrls = currentUrls.filter((url) => url !== imageUrl);

    // Usuń z bazy danych
    const { error: updateError } = await supabase
      .from("trips")
      .update({ gallery_urls: updatedUrls })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    // Usuń plik z Storage (wyciągnij ścieżkę z URL)
    try {
      const urlObj = new URL(imageUrl);
      const pathParts = urlObj.pathname.split("/");
      const fileName = pathParts.slice(pathParts.indexOf("trip-gallery") + 1).join("/");

      const adminClient = createAdminClient();
      await adminClient.storage.from("trip-gallery").remove([fileName]);
    } catch (storageError) {
      // Loguj błąd, ale nie przerywaj - plik może już nie istnieć
      console.error("Error removing file from storage:", storageError);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

