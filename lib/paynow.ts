import crypto from "crypto";

type CreatePaynowPaymentInput = {
  amountCents: number;
  externalId: string;
  description: string;
  continueUrl: string;
  notificationUrl: string;
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
    throw new Error("Paynow is not configured");
  }

  const baseUrl =
    environment === "production" ? "https://api.paynow.pl" : "https://api.sandbox.paynow.pl";

  return {
    apiKey,
    signatureKey,
    baseUrl,
  };
}

export async function createPaynowPayment(
  input: CreatePaynowPaymentInput,
): Promise<CreatePaynowPaymentResult> {
  const { apiKey, signatureKey, baseUrl } = getPaynowConfig();

  const body = {
    amount: {
      value: input.amountCents,
      currency: "PLN",
    },
    externalId: input.externalId,
    description: input.description,
    continueUrl: input.continueUrl,
    notificationUrl: input.notificationUrl,
  };

  const jsonBody = JSON.stringify(body);
  const signature = crypto.createHmac("sha256", signatureKey).update(jsonBody).digest("hex");

  const res = await fetch(`${baseUrl}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Signature": signature,
      "Idempotency-Key": input.externalId,
    },
    body: jsonBody,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Paynow payment failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    paymentId: string;
    redirectUrl?: string;
  };

  return {
    paymentId: data.paymentId,
    redirectUrl: data.redirectUrl,
  };
}


