import crypto from "crypto";

type CreatePaynowPaymentInput = {
  amountCents: number;
  externalId: string;
  description: string;
  buyerEmail: string;
  continueUrl: string;
  notificationUrl?: string; // Opcjonalne - nie obsługiwane przez API Paynow v3, webhooki konfiguruje się w panelu
};

type CreatePaynowPaymentResult = {
  paymentId: string;
  redirectUrl?: string;
};

function getPaynowConfig() {
  const apiKey = process.env.PAYNOW_API_KEY;
  const signatureKey = process.env.PAYNOW_SIGNATURE_KEY;
  const environment = process.env.PAYNOW_ENV ?? "sandbox";

  if (!apiKey || !signatureKey) {
    throw new Error("Paynow is not configured - missing PAYNOW_API_KEY or PAYNOW_SIGNATURE_KEY");
  }

  // Sprawdź czy klucze nie są puste
  if (apiKey.trim() === "" || signatureKey.trim() === "") {
    throw new Error("Paynow keys cannot be empty");
  }

  const baseUrl =
    environment === "production" ? "https://api.paynow.pl" : "https://api.sandbox.paynow.pl";

  return {
    apiKey: apiKey.trim(),
    signatureKey: signatureKey.trim(),
    baseUrl,
  };
}

export async function createPaynowPayment(
  input: CreatePaynowPaymentInput,
): Promise<CreatePaynowPaymentResult> {
  const { apiKey, signatureKey, baseUrl } = getPaynowConfig();

  // Paynow v3 format zgodnie z dokumentacją:
  // Przykład z dokumentacji (Quick Start):
  // {
  //   "amount": 100,
  //   "externalId": 234567898654,
  //   "description": "Test transaction from quick quide",
  //   "buyer": {
  //     "email": "jan.kowalski@melements.pl"
  //   }
  // }
  //
  // UWAGA: W przykładzie z Quick Start NIE MA continueUrl i notificationUrl w body!
  // Te pola mogą być konfigurowane w panelu sklepu lub mogą być opcjonalne.
  // Spróbujmy najpierw bez nich, zgodnie z przykładem z dokumentacji.
  const body = {
    amount: input.amountCents,
    externalId: input.externalId,
    description: input.description,
    buyer: {
      email: input.buyerEmail,
    },
    // continueUrl jest dozwolone przez API Paynow v3
    // notificationUrl nie jest obsługiwane w body - webhooki konfiguruje się w panelu sklepu
    ...(input.continueUrl && { continueUrl: input.continueUrl }),
  };

  // Serializuj body jako JSON string
  const jsonBody = JSON.stringify(body);
  
  // WAŻNE: Paynow v3 wymaga obliczenia sygnatury z obiektu zawierającego:
  // - headers (alfabetycznie uporządkowane: Api-Key, Idempotency-Key)
  // - parameters (alfabetycznie uporządkowane, puste obiekt {} jeśli brak parametrów URL)
  // - body (jako string JSON)
  const signaturePayload = {
    headers: {
      "Api-Key": apiKey,
      "Idempotency-Key": input.externalId,
    },
    parameters: {},
    body: jsonBody,
  };
  
  // Serializuj obiekt do podpisania
  const signaturePayloadJson = JSON.stringify(signaturePayload);
  
  // Oblicz sygnaturę HMAC SHA256 w formacie base64
  // Klucz sygnatury to "Klucz obliczania podpisu" z panelu Paynow
  const signature = crypto
    .createHmac("sha256", signatureKey)
    .update(signaturePayloadJson, "utf8")
    .digest("base64");
  
  // Debug logging - tylko w development
  if (process.env.NODE_ENV === "development") {
    console.log("Paynow payment request debug:", {
      url: `${baseUrl}/v3/payments`,
      body: jsonBody,
      signaturePayload: signaturePayloadJson,
      signatureLength: signature.length,
      signature: signature,
      hasApiKey: !!apiKey,
      hasSignatureKey: !!signatureKey,
      signatureKeyLength: signatureKey?.length || 0,
    });
  }

  const res = await fetch(`${baseUrl}/v3/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "Signature": signature,
      "Idempotency-Key": input.externalId,
    },
    body: jsonBody,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Paynow payment failed: ${res.status} ${text}`);
  }

  const responseText = await res.text();
  let data: { paymentId: string; redirectUrl?: string; [key: string]: any };
  
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error("Failed to parse Paynow response:", responseText);
    throw new Error(`Paynow payment failed: Invalid JSON response`);
  }

  // Debug logging - tylko w development
  if (process.env.NODE_ENV === "development") {
    console.log("Paynow payment response:", {
      paymentId: data.paymentId,
      redirectUrl: data.redirectUrl,
      fullResponse: data,
    });
  }

  if (!data.paymentId) {
    throw new Error(`Paynow payment failed: Missing paymentId in response`);
  }

  return {
    paymentId: data.paymentId,
    redirectUrl: data.redirectUrl,
  };
}

/**
 * Sprawdza status płatności Paynow przez API
 */
export async function getPaynowPaymentStatus(
  paymentId: string,
): Promise<{ status: string; amount?: number; externalId?: string } | null> {
  const { apiKey, signatureKey, baseUrl } = getPaynowConfig();

  // Paynow v3 wymaga sygnatury również dla GET requestów
  // Sygnatura dla GET: headers (alfabetycznie: Api-Key, Idempotency-Key) + parameters + body (pusty string dla GET)
  // Idempotency-Key jest wymagany również dla GET requestów
  const idempotencyKey = paymentId; // Używamy paymentId jako Idempotency-Key
  
  const signaturePayload = {
    headers: {
      "Api-Key": apiKey,
      "Idempotency-Key": idempotencyKey,
    },
    parameters: {},
    body: "",
  };

  const signaturePayloadJson = JSON.stringify(signaturePayload);
  const signature = crypto
    .createHmac("sha256", signatureKey)
    .update(signaturePayloadJson, "utf8")
    .digest("base64");

  // Debug logging - tylko w development
  if (process.env.NODE_ENV === "development") {
    console.log("Paynow get payment status request debug:", {
      url: `${baseUrl}/v3/payments/${paymentId}/status`,
      signaturePayload: signaturePayloadJson,
      signatureLength: signature.length,
      hasApiKey: !!apiKey,
      hasSignatureKey: !!signatureKey,
    });
  }

  // Paynow v3 endpoint do sprawdzania statusu: /v3/payments/{paymentId}/status
  const res = await fetch(`${baseUrl}/v3/payments/${paymentId}/status`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "Signature": signature,
      "Idempotency-Key": idempotencyKey,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Failed to get Paynow payment status: ${res.status} ${text}`);
    // Jeśli 404, może to oznaczać że płatność nie istnieje lub paymentId jest niepoprawny
    if (res.status === 404) {
      console.error(`Payment ${paymentId} not found in Paynow`);
    }
    return null;
  }

  const data = (await res.json()) as {
    paymentId?: string;
    status: string;
    amount?: number;
    externalId?: string;
  };

  return {
    status: data.status,
    amount: data.amount,
    externalId: data.externalId,
  };
}


