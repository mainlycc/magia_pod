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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ tripId: string; type: string }> }
) {
  try {
    const { tripId, type } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    const isCoordinator = await checkCoordinator(supabase, tripId);
    
    if (!isAdmin && !isCoordinator) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const validDocumentTypes = [
      "rodo", "terms", "conditions",
      "agreement", "conditions_de_pl", "standard_form",
      "electronic_services", "rodo_info", "insurance_terms"
    ];
    if (!validDocumentTypes.includes(type)) {
      return NextResponse.json({ error: "invalid_document_type" }, { status: 400 });
    }

    // Pobierz dokument przed usunięciem
    const { data: document, error: fetchError } = await supabase
      .from("trip_documents")
      .select("file_name")
      .eq("trip_id", tripId)
      .eq("document_type", type)
      .single();

    if (fetchError || !document) {
      return NextResponse.json({ error: "document_not_found" }, { status: 404 });
    }

    // Usuń z bazy danych
    const { error: deleteError } = await supabase
      .from("trip_documents")
      .delete()
      .eq("trip_id", tripId)
      .eq("document_type", type);

    if (deleteError) {
      console.error("Database delete error:", deleteError);
      return NextResponse.json({ error: "database_error" }, { status: 500 });
    }

    // Usuń plik z Storage
    const adminClient = createAdminClient();
    try {
      await adminClient.storage.from("documents").remove([document.file_name]);
    } catch (storageError) {
      console.error("Error removing file from storage:", storageError);
      // Nie przerywamy - plik może już nie istnieć
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/documents/trip/[tripId]/[type] error", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

