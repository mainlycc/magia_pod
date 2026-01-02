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

async function checkCoordinator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string
): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "coordinator") return false;

  const { data: coordinator } = await supabase
    .from("trip_coordinators")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .single();

  return !!coordinator;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await context.params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Pobierz dokumenty specyficzne dla wycieczki
    const { data: tripDocs, error: tripDocsError } = await supabase
      .from("trip_documents")
      .select("*")
      .eq("trip_id", tripId);

    if (tripDocsError) {
      console.error("Error fetching trip documents:", tripDocsError);
    }

    // Pobierz wszystkie dokumenty globalne
    const { data: globalDocs, error: globalDocsError } = await supabase
      .from("global_documents")
      .select("*");

    if (globalDocsError) {
      console.error("Error fetching global documents:", globalDocsError);
    }

    // Utwórz mapę dokumentów dla wycieczki (nadpisują globalne)
    const tripDocsMap = new Map(
      (tripDocs || []).map((doc) => [doc.document_type, doc])
    );

    // Utwórz mapę dokumentów globalnych
    const globalDocsMap = new Map(
      (globalDocs || []).map((doc) => [doc.document_type, doc])
    );

    // Zwróć dokumenty z fallbackiem: jeśli jest dokument dla wycieczki, użyj go, w przeciwnym razie użyj globalnego
    const documentTypes = ["rodo", "terms", "conditions"];
    const result = documentTypes.map((type) => {
      const tripDoc = tripDocsMap.get(type);
      const globalDoc = globalDocsMap.get(type);

      if (tripDoc) {
        const { data: { publicUrl } } = adminClient.storage
          .from("documents")
          .getPublicUrl(tripDoc.file_name);
        return {
          ...tripDoc,
          url: publicUrl,
          source: "trip" as const,
        };
      } else if (globalDoc) {
        const { data: { publicUrl } } = adminClient.storage
          .from("documents")
          .getPublicUrl(globalDoc.file_name);
        return {
          ...globalDoc,
          url: publicUrl,
          source: "global" as const,
        };
      }
      return null;
    }).filter(Boolean);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/documents/trip/[tripId] error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    const isCoordinator = await checkCoordinator(supabase, tripId);
    
    if (!isAdmin && !isCoordinator) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Sprawdź czy wycieczka istnieje
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
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
    const fileName = `trips/${tripId}/${documentType}-${Date.now()}.${fileExt}`;

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
      .from("trip_documents")
      .select("file_name")
      .eq("trip_id", tripId)
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
      trip_id: tripId,
      document_type: documentType,
      file_name: fileName,
      display_name: displayName || null,
    };

    const { data: savedDoc, error: dbError } = await supabase
      .from("trip_documents")
      .upsert(documentData, {
        onConflict: "trip_id,document_type",
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
    console.error("POST /api/documents/trip/[tripId] error", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

