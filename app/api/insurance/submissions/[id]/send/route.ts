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
      paymentSchemeCode = "ONE_TIME",
      paymentMethodCode = "PAY_BY_LINK",
      languageCode = "PL",
    } = body;

    const insuranceService = await getInsuranceService();

    // 1. Walidacja danych uczestników
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

    // 2. Kalkulacja oferty
    let offerID: string;
    try {
      const offerResult = await insuranceService.calculateInsuranceOffer({
        batchId: id,
        productCode,
        variantCode,
      });
      offerID = offerResult.external_offer_id || '';
    } catch (error: any) {
      return NextResponse.json(
        {
          success: false,
          error: "calculate_failed",
          message: error.message || "Błąd podczas kalkulacji oferty",
        },
        { status: 500 }
      );
    }

    // 3. Rejestracja polisy
    try {
      await insuranceService.registerInsurancePolicy({
        batchId: id,
        offerId: offerID,
        variantCode: variantCode || "DEFAULT",
        paymentSchemeCode,
        languageCode,
      });
    } catch (error: any) {
      return NextResponse.json(
        {
          success: false,
          error: "register_failed",
          message: error.message || "Błąd podczas rejestracji polisy",
        },
        { status: 500 }
      );
    }

    // 4. Wystawienie polisy
    let policyResult;
    try {
      policyResult = await insuranceService.issueInsurancePolicy({
        batchId: id,
        offerId: offerID,
        paymentMethodCode,
      });
    } catch (error: any) {
      return NextResponse.json(
        {
          success: false,
          error: "issue_failed",
          message: error.message || "Błąd podczas wystawiania polisy",
        },
        { status: 500 }
      );
    }

    // Pobierz zaktualizowane zgłoszenie
    const { data: updatedSubmission } = await supabase
      .from("insurance_submissions")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({
      success: true,
      message: "Polisa została pomyślnie wystawiona",
      policy: {
        policyId: policyResult.external_policy_id,
        policyNumber: policyResult.external_policy_number,
        policyStatusCode: policyResult.policy_status_code,
      },
      submission: updatedSubmission,
    });
  } catch (err: any) {
    console.error("Unexpected error in send:", err);
    return NextResponse.json(
      { success: false, error: "unexpected", message: err.message || "Nieoczekiwany błąd" },
      { status: 500 }
    );
  }
}

