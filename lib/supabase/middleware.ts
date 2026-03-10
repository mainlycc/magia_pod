import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip middleware check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Public paths that should NOT require auth (allow anonymous access)
  const path = request.nextUrl.pathname;

  const isPublicPath =
    path === "/" ||
    path === "/trip" ||
    path.startsWith("/trip/") ||
    path === "/register" ||
    path === "/booking" ||
    path.startsWith("/booking/") ||
    path.startsWith("/api/bookings") ||
    path.startsWith("/api/pdf") ||
    path.startsWith("/api/email") ||
    path.startsWith("/api/agreements") ||
    // webhook Paynow musi być dostępny bez logowania
    path.startsWith("/api/payments/paynow/webhook") ||
    path.startsWith("/auth") ||
    path.startsWith("/login");

  if (!user && !isPublicPath) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    const redirectResponse = NextResponse.redirect(url);
    // Copy cookies from supabaseResponse to maintain session
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  // RBAC: admin and coordinator areas
  const requiresAdmin = path.startsWith("/admin");
  const requiresCoordinator = path.startsWith("/coord");

  if (user && (requiresAdmin || requiresCoordinator)) {
    // Fetch profile to check role
    const { data: profileRes } = await fetch(`${request.nextUrl.origin}/api/profile`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    }).then(async (r) => ({ data: r.ok ? await r.json() : null }));

    const role = profileRes?.role as string | undefined;

    if (requiresAdmin && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      const redirectResponse = NextResponse.redirect(url);
      // Copy cookies from supabaseResponse to maintain session
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }
    if (requiresCoordinator && !(role === "coordinator" || role === "admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      const redirectResponse = NextResponse.redirect(url);
      // Copy cookies from supabaseResponse to maintain session
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
