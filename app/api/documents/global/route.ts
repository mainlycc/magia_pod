import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("global_documents")
      .select("*")
      .order("document_type");

    if (error) {
      console.error("Error fetching global documents:", error);
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/documents/global error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentType = formData.get("document_type") as string;
    const displayName = formData.get("display_name") as string | null;

    if (!file) {
      return NextResponse.json({ error: "no_file" }, { status: 400 });
    }

    if (!documentType || !["rodo", "terms", "conditions"].includes(documentType)) {
      return NextResponse.json({ error: "invalid_document_type" }, { status: 400 });
    }

    // Sprawdź czy to PDF
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
    }

    // Sprawdź rozmiar pliku (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }

    // Generuj unikalną nazwę pliku
    const fileExt = "pdf";
    const fileName = `global/${documentType}-${Date.now()}.${fileExt}`;

    // Upload do Supabase Storage
    const adminClient = createAdminClient();
    
    // Sprawdź czy bucket istnieje, jeśli nie - utwórz go
    const { data: buckets } = await adminClient.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.id === "documents");
    
    if (!bucketExists) {
      const { error: createBucketError } = await adminClient.storage.createBucket("documents", {
        public: true,
        allowedMimeTypes: ["application/pdf"],
      });
      
      if (createBucketError) {
        console.error("Error creating bucket:", createBucketError);
      }
    }

    // Pobierz istniejący dokument, jeśli istnieje
    const { data: existingDoc } = await supabase
      .from("global_documents")
      .select("file_name")
      .eq("document_type", documentType)
      .single();

    // Upload nowego pliku
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const { error: uploadError } = await adminClient.storage
      .from("documents")
      .upload(fileName, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }

    // Zapisz lub zaktualizuj rekord w bazie danych
    const documentData = {
      document_type: documentType,
      file_name: fileName,
      display_name: displayName || null,
    };

    const { data: savedDoc, error: dbError } = await supabase
      .from("global_documents")
      .upsert(documentData, {
        onConflict: "document_type",
      })
      .select()
      .single();

    if (dbError) {
      // Usuń plik jeśli nie udało się zapisać do bazy
      await adminClient.storage.from("documents").remove([fileName]);
      console.error("Database error:", dbError);
      return NextResponse.json({ error: "database_error" }, { status: 500 });
    }

    // Usuń stary plik jeśli został zastąpiony
    if (existingDoc?.file_name && existingDoc.file_name !== fileName) {
      try {
        await adminClient.storage.from("documents").remove([existingDoc.file_name]);
      } catch (removeError) {
        console.error("Error removing old file:", removeError);
        // Nie przerywamy - stary plik może już nie istnieć
      }
    }

    // Pobierz publiczny URL
    const {
      data: { publicUrl },
    } = adminClient.storage.from("documents").getPublicUrl(fileName);

    return NextResponse.json({
      ...savedDoc,
      url: publicUrl,
      success: true,
    });
  } catch (error) {
    console.error("POST /api/documents/global error", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

