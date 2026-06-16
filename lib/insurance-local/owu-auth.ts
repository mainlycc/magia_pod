import { createClient } from "@/lib/supabase/server";

export async function checkInsuranceOwuAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
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

export async function checkInsuranceOwuCoordinator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
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

export async function canManageInsuranceOwu(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
): Promise<boolean> {
  const isAdmin = await checkInsuranceOwuAdmin(supabase);
  if (isAdmin) return true;
  return checkInsuranceOwuCoordinator(supabase, tripId);
}
