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

export async function POST(
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
    const body = await request.json().catch(() => ({}));
    const {
      productCode = "TRAVEL_INSURANCE",
      variantCode,
    } = body;

    const insuranceService = await getInsuranceService();

    // Walidacja danych uczestników
    const validation = await insuranceService.validateParticipantsData(id);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "validation_failed",
          message: "Dane uczestników są niekompletne",
          validationErrors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Kalkulacja oferty
    const offerResult = await insuranceService.calculateInsuranceOffer({
      batchId: id,
      productCode,
      variantCode,
    });

    // Pobierz zaktualizowane zgłoszenie
    const { data: updatedSubmission } = await supabase
      .from("insurance_submissions")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({
      success: true,
      message: "Oferta została pomyślnie obliczona",
      offer: {
        offerID: offerResult.external_offer_id,
        effectiveDate: offerResult.api_response?.effectiveDate,
        paymentSchemas: offerResult.api_response?.paymentSchemas,
      },
      submission: updatedSubmission,
    });
  } catch (error: any) {
    console.error("Error in calculate:", error);
    return NextResponse.json(
      {
        success: false,
        error: "calculate_failed",
        message: error.message || "Błąd podczas kalkulacji oferty",
      },
      { status: 500 }
    );
  }
}

