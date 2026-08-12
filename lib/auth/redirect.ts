/**
 * Ścieżka docelowa po udanym logowaniu / zmianie hasła.
 * Koordynator trafia do panelu /coord; pozostali do trip-dashboard.
 */
export async function getPostAuthRedirectPath(): Promise<string> {
  try {
    const res = await fetch("/api/profile");
    if (res.ok) {
      const profile = (await res.json()) as { role?: string };
      if (profile.role === "coordinator") {
        return "/coord";
      }
    }
  } catch {
    // fallback poniżej
  }
  return "/trip-dashboard/wycieczki";
}
