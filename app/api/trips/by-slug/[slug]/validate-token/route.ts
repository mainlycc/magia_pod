import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertRegistrationAccess,
  registrationAccessErrorStatus,
  resolveTripBySlug,
} from "@/lib/trips/registration-access";
import { canManageTrip } from "@/lib/trips/can-manage-trip";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const token = request.nextUrl.searchParams.get("token");
    const admin = createAdminClient();

    const access = await assertRegistrationAccess(admin, slug, token);
    if (access.ok) {
      return NextResponse.json({ ok: true });
    }

    if (
      access.error === "missing_token" ||
      access.error === "invalid_token"
    ) {
      const { trip } = await resolveTripBySlug(admin, slug);
      if (trip && (await canManageTrip(await createClient(), trip.id))) {
        return NextResponse.json({ ok: true, bypass: true });
      }
    }

    return NextResponse.json(
      { error: access.error },
      { status: registrationAccessErrorStatus(access.error) },
    );
  } catch (err) {
    console.error("Error in GET validate-token:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
