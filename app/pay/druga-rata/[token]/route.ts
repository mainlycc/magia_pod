import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startSecondInstallmentPaynowPayment } from "@/lib/payments/start-second-installment-payment";
import { resolvePublicBaseUrl } from "@/lib/url/resolve-public-base-url";

export const dynamic = "force-dynamic";

function htmlPage(title: string, message: string, status: number): NextResponse {
  const body = `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: sans-serif; max-width: 36rem; margin: 4rem auto; padding: 0 1rem; color: #111;">
  <h1 style="font-size: 1.25rem;">${title}</h1>
  <p>${message}</p>
</body>
</html>`;
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function isBookingRef(value: string): boolean {
  return value.startsWith("BK-");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await context.params;
  const token = decodeURIComponent(rawToken || "").trim();
  const baseUrl = resolvePublicBaseUrl(request.url);

  const result = await startSecondInstallmentPaynowPayment({
    adminClient: createAdminClient(),
    baseUrl,
    accessToken: isBookingRef(token) ? null : token,
    bookingRef: isBookingRef(token) ? token : null,
  });

  if (result.ok) {
    return NextResponse.redirect(result.redirectUrl);
  }

  if (result.reason === "already_paid" && result.bookingPath) {
    return NextResponse.redirect(`${baseUrl}${result.bookingPath}`);
  }

  if (result.reason === "not_found") {
    return htmlPage(
      "Nie znaleziono rezerwacji",
      "Link do płatności jest nieprawidłowy albo wygasł. Napisz do biura Magii Podróżowania.",
      404,
    );
  }

  if (result.reason === "no_amount") {
    return htmlPage(
      "Brak kwoty do zapłaty",
      "Dla tej rezerwacji nie ma teraz drugiej raty do opłacenia online. Jeśli wpłata nadal jest wymagana, napisz do biura.",
      400,
    );
  }

  return htmlPage(
    "Płatność chwilowo niedostępna",
    "Nie udało się otworzyć płatności Paynow. Spróbuj ponownie za chwilę albo napisz do biura.",
    502,
  );
}
