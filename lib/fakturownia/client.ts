/**
 * Fakturownia API Client
 * REST JSON API - https://github.com/fakturownia/api
 *
 * Authentication: api_token in request body (POST) or query param (GET)
 * Base URL: https://{subdomain}.fakturownia.pl
 */

// ===================== TYPES =====================

export interface FakturowniaConfig {
  apiToken: string;
  subdomain: string;
}

export interface FakturowniaInvoiceItem {
  name: string;
  quantity: number;
  price_net: number;
  total_price_gross: number;
  tax: string; // "np" (nie podlega VAT - procedura marży), "0", "5", "8", "23", "zw"
}

export interface FakturowniaInvoiceData {
  kind: "advance" | "vat" | "proforma" | "final_invoice";
  number?: string;
  sell_date: string;
  issue_date: string;
  payment_to?: string;
  payment_type: string; // "transfer", "cash", "card"
  currency: string;
  use_gross?: boolean;
  lang?: string;
  buyer_name: string;
  buyer_tax_no?: string;
  buyer_street?: string;
  buyer_city?: string;
  buyer_post_code?: string;
  buyer_country?: string;
  buyer_email?: string;
  buyer_phone?: string;
  // Procedura marży (m.in. VAT marża / turystyka)
  margin_procedure?: boolean;
  margin_kind?: string;
  // Powiązanie z zamówieniem (wymagane dla kind: "advance" od KSeF)
  order_id?: number;
  // Powiązanie z poprzednią fakturą zaliczkową (dla advance_to_advance)
  from_invoice_id?: number;
  positions: FakturowniaInvoiceItem[];
  description?: string;
  internal_note?: string;
}

export interface FakturowniaInvoiceResponse {
  success: boolean;
  invoiceId?: number;
  invoiceNumber?: string;
  pdfUrl?: string;
  viewUrl?: string;
  error?: string;
  rawResponse?: any;
}

export interface FakturowniaOrderData {
  buyer_name: string;
  buyer_tax_no?: string;
  buyer_street?: string;
  buyer_city?: string;
  buyer_post_code?: string;
  buyer_email?: string;
  positions: FakturowniaInvoiceItem[];
  description?: string;
  currency?: string;
  lang?: string;
}

export interface FakturowniaOrderResponse {
  success: boolean;
  orderId?: number;
  error?: string;
  rawResponse?: any;
}

export interface FakturowniaClient {
  id?: number;
  name: string;
  tax_no?: string;
  street?: string;
  city?: string;
  post_code?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

export interface FakturowniaClientListResponse {
  success: boolean;
  clients: FakturowniaClient[];
  error?: string;
}

export interface FakturowniaClientCreateResponse {
  success: boolean;
  clientId?: number;
  client?: FakturowniaClient;
  error?: string;
}

// ===================== HELPERS =====================

function getBaseUrl(config: FakturowniaConfig): string {
  return `https://${config.subdomain}.fakturownia.pl`;
}

function serializeError(responseData: any): string {
  if (typeof responseData === "string") return responseData;
  if (Array.isArray(responseData)) {
    return responseData
      .map((e: any) => (typeof e === "string" ? e : JSON.stringify(e)))
      .join(", ");
  }
  if (responseData?.message && typeof responseData.message === "object") {
    // Fakturownia zwraca message jako obiekt z polami błędów
    const parts: string[] = [];
    for (const [field, errors] of Object.entries(responseData.message)) {
      if (Array.isArray(errors)) {
        parts.push(`${field}: ${errors.join(", ")}`);
      } else {
        parts.push(`${field}: ${JSON.stringify(errors)}`);
      }
    }
    return parts.join(" | ");
  }
  if (responseData?.message) return String(responseData.message);
  if (responseData?.errors) {
    return Array.isArray(responseData.errors)
      ? responseData.errors
          .map((e: any) => (typeof e === "string" ? e : JSON.stringify(e)))
          .join(", ")
      : JSON.stringify(responseData.errors);
  }
  return JSON.stringify(responseData);
}

// ===================== ORDERS =====================

/**
 * Creates an order (zamówienie) in Fakturownia.
 * Required as a basis for advance invoices (KSeF requirement).
 */
export async function createOrder(
  config: FakturowniaConfig,
  data: FakturowniaOrderData
): Promise<FakturowniaOrderResponse> {
  try {
    const baseUrl = getBaseUrl(config);

    const orderPayload: Record<string, any> = {
      buyer_name: data.buyer_name,
      currency: data.currency || "PLN",
      lang: data.lang || "pl",
      positions: data.positions.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price_net: item.price_net.toFixed(2),
        total_price_gross: item.total_price_gross.toFixed(2),
        tax: item.tax,
      })),
    };

    if (data.buyer_tax_no) orderPayload.buyer_tax_no = data.buyer_tax_no;
    if (data.buyer_street) orderPayload.buyer_street = data.buyer_street;
    if (data.buyer_city) orderPayload.buyer_city = data.buyer_city;
    if (data.buyer_post_code) orderPayload.buyer_post_code = data.buyer_post_code;
    if (data.buyer_email) orderPayload.buyer_email = data.buyer_email;
    if (data.description) orderPayload.description = data.description;

    console.log("[Fakturownia Client] Creating order:", {
      buyerName: data.buyer_name,
      positions: data.positions.length,
    });

    const response = await fetch(`${baseUrl}/orders.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        api_token: config.apiToken,
        order: orderPayload,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("[Fakturownia] Raw order error response:", JSON.stringify(responseData, null, 2));
      return {
        success: false,
        error: `HTTP ${response.status}: ${serializeError(responseData)}`,
        rawResponse: responseData,
      };
    }

    console.log("[Fakturownia Client] Order created:", { orderId: responseData.id });

    return {
      success: true,
      orderId: responseData.id,
      rawResponse: responseData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Nieznany błąd",
    };
  }
}

// ===================== INVOICES =====================

/**
 * Creates an invoice in Fakturownia.
 * For advance invoices, order_id is required (KSeF).
 * For advance-to-advance, from_invoice_id links to previous advance.
 */
export async function createInvoice(
  config: FakturowniaConfig,
  data: FakturowniaInvoiceData
): Promise<FakturowniaInvoiceResponse> {
  try {
    const baseUrl = getBaseUrl(config);

    const invoicePayload: Record<string, any> = {
      kind: data.kind,
      sell_date: data.sell_date,
      issue_date: data.issue_date,
      payment_type: data.payment_type,
      currency: data.currency,
      lang: data.lang || "pl",
      buyer_name: data.buyer_name,
      positions: data.positions.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price_net: item.price_net.toFixed(2),
        total_price_gross: item.total_price_gross.toFixed(2),
        tax: item.tax,
      })),
    };

    if (data.number) invoicePayload.number = data.number;
    if (data.payment_to) invoicePayload.payment_to = data.payment_to;
    if (data.order_id) invoicePayload.order_id = data.order_id;
    if (data.from_invoice_id) invoicePayload.from_invoice_id = data.from_invoice_id;
    if (data.buyer_tax_no) invoicePayload.buyer_tax_no = data.buyer_tax_no;
    if (data.buyer_street) invoicePayload.buyer_street = data.buyer_street;
    if (data.buyer_city) invoicePayload.buyer_city = data.buyer_city;
    if (data.buyer_post_code) invoicePayload.buyer_post_code = data.buyer_post_code;
    if (data.buyer_country) invoicePayload.buyer_country = data.buyer_country;
    if (data.buyer_email) invoicePayload.buyer_email = data.buyer_email;
    if (data.buyer_phone) invoicePayload.buyer_phone = data.buyer_phone;
    if (data.description) invoicePayload.description = data.description;
    if (data.internal_note) invoicePayload.internal_note = data.internal_note;

    console.log("[Fakturownia Client] Creating invoice:", {
      kind: data.kind,
      buyerName: data.buyer_name,
      orderId: data.order_id,
      fromInvoiceId: data.from_invoice_id,
      positions: data.positions.length,
    });

    const response = await fetch(`${baseUrl}/invoices.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        api_token: config.apiToken,
        invoice: invoicePayload,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("[Fakturownia] Raw error response:", JSON.stringify(responseData, null, 2));
      return {
        success: false,
        error: `HTTP ${response.status}: ${serializeError(responseData)}`,
        rawResponse: responseData,
      };
    }

    return {
      success: true,
      invoiceId: responseData.id,
      invoiceNumber: responseData.number,
      pdfUrl: responseData.pdf_url,
      viewUrl: responseData.view_url,
      rawResponse: responseData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Nieznany błąd",
    };
  }
}

/**
 * Fetches invoice details from Fakturownia, including current pdf_url.
 */
export async function getInvoice(
  config: FakturowniaConfig,
  invoiceId: number | string
): Promise<FakturowniaInvoiceResponse> {
  try {
    const baseUrl = getBaseUrl(config);
    const response = await fetch(
      `${baseUrl}/invoices/${invoiceId}.json?api_token=${encodeURIComponent(config.apiToken)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const responseData = await response.json();

    return {
      success: true,
      invoiceId: responseData.id,
      invoiceNumber: responseData.number,
      pdfUrl: responseData.pdf_url,
      viewUrl: responseData.view_url,
      rawResponse: responseData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Nieznany błąd",
    };
  }
}

/**
 * Returns a direct PDF download URL for a Fakturownia invoice.
 */
export function buildInvoicePdfUrl(
  config: FakturowniaConfig,
  invoiceId: number | string
): string {
  const baseUrl = getBaseUrl(config);
  return `${baseUrl}/invoices/${invoiceId}.pdf?api_token=${encodeURIComponent(config.apiToken)}`;
}

/**
 * Downloads a PDF from a URL and returns it as a Buffer.
 */
export async function downloadPdf(pdfUrl: string): Promise<Buffer> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ===================== CLIENTS =====================

export async function fetchClients(
  config: FakturowniaConfig,
  page: number = 1
): Promise<FakturowniaClientListResponse> {
  try {
    const baseUrl = getBaseUrl(config);
    const response = await fetch(
      `${baseUrl}/clients.json?api_token=${encodeURIComponent(config.apiToken)}&page=${page}&per_page=100`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      return { success: false, clients: [], error: `HTTP ${response.status}` };
    }

    const clients = await response.json();
    return {
      success: true,
      clients: Array.isArray(clients) ? clients : [],
    };
  } catch (error) {
    return {
      success: false,
      clients: [],
      error: error instanceof Error ? error.message : "Nieznany błąd",
    };
  }
}

export async function createClient(
  config: FakturowniaConfig,
  data: FakturowniaClient
): Promise<FakturowniaClientCreateResponse> {
  try {
    const baseUrl = getBaseUrl(config);
    const response = await fetch(`${baseUrl}/clients.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        api_token: config.apiToken,
        client: data,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${serializeError(responseData)}`,
      };
    }

    return {
      success: true,
      clientId: responseData.id,
      client: responseData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Nieznany błąd",
    };
  }
}
