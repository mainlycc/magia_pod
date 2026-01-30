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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    
    if (!isAdmin) {
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
      .from("global_documents")
      .select("file_name")
      .eq("document_type", type)
      .single();

    if (fetchError || !document) {
      return NextResponse.json({ error: "document_not_found" }, { status: 404 });
    }

    // Usuń z bazy danych
    const { error: deleteError } = await supabase
      .from("global_documents")
      .delete()
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
    console.error("DELETE /api/documents/global/[type] error", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

