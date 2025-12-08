import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInsuranceService } from "@/lib/insurance/service";

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { id } = await context.params;
    const insuranceService = await getInsuranceService();

    // Synchronizuj status
    const updatedBatch = await insuranceService.syncInsuranceBatchStatus(id);

    return NextResponse.json({
      success: true,
      message: "Status został zsynchronizowany",
      submission: updatedBatch,
    });
  } catch (error: any) {
    console.error("Error in sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: "sync_failed",
        message: error.message || "Błąd podczas synchronizacji statusu",
      },
      { status: 500 }
    );
  }
}

