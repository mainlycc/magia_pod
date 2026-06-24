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
  /** Nazwa sprzedawcy — często wymagana przez API (KSeF / wiele oddziałów); można też ustawić FAKTUROWNIA_SELLER_NAME w env */
  sellerName?: string;
  sellerTaxNo?: string;
  sellerStreet?: string;
  sellerCity?: string;
  sellerPostCode?: string;
  sellerCountry?: string;
}

export interface FakturowniaInvoiceItem {
  name: string;
  quantity: number;
  price_net: number;
  total_price_gross: number;
  tax: string; // "np" (nie podlega), "disabled" (marża), "0", "5", "8", "23", "zw"
  /** Stawka VAT od marży (dla pozycji marżowych `tax: "disabled"`), np. "23". */
  vat_margin_tax?: string | number;
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
  /** KSeF: czy nabywca jest firmą. Dla osób prywatnych ustaw `false` (NIP wtedy zbędny). */
  buyer_company?: boolean;
  /** KSeF: wymagane dla osób prywatnych (`buyer_company=false`). */
  buyer_first_name?: string;
  buyer_last_name?: string;
  /** KSeF: rodzaj identyfikatora nabywcy: "" (PL NIP), "nip_ue", "other", "empty". */
  buyer_tax_no_kind?: string;
  // Procedura marży (m.in. VAT marża / turystyka)
  margin_procedure?: boolean;
  margin_kind?: string;
  /**
   * KSeF: rodzaj procedury marży, jedna z 4 wartości dokumentacji, np.
   * "procedura marży dla biur podróży".
   */
  procedure_vat_margin?: string;
  /** KSeF: oznaczenia procedur, np. ["MR_T"] dla usług turystyki (art. 119). */
  procedure_designations?: string[];
  /**
   * ID dokumentu „Zamówienie” (estimate) **w Fakturowni** — wymagane dla zaliczki (KSeF).
   * W API trafia jako **`invoice_id`** (powiązanie z zamówieniem), nie jako `oid`
   * (`oid` w dokumentacji to zewnętrzny numer zamówienia, np. ze sklepu).
   */
  oid?: number;
  /** @deprecated użyj `oid` — to samo co `oid` */
  order_id?: number;
  /** Opcjonalnie: zewnętrzny numer zamówienia → pole API `oid` (np. booking_ref) */
  external_order_ref?: string;
  // Powiązanie z poprzednią fakturą zaliczkową (dla advance_to_advance)
  from_invoice_id?: number;
  /**
   * Zwykłe faktury — pozycje ręczne.
   * Dla zaliczki KSeF z zamówieniem ustawiamy `advance_creation_mode` + `advance_value` + `position_name` (bez pozycji).
   */
  positions?: FakturowniaInvoiceItem[];
  /** KSeF: tryb z dokumentacji API — `amount` lub `percent` + `advance_value` */
  advance_creation_mode?: "amount" | "percent";
  /** Kwota brutto (tryb amount) lub procent (tryb percent) — jako liczba lub string */
  advance_value?: number | string;
  /** Nagłówek pozycji zaliczki przy copy_invoice_from */
  position_name?: string;
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

/**
 * Dane sprzedawcy w dokumencie — przy niektórych kontach API zwraca 422 „seller_name nie może być puste”.
 * Wartości z config mają pierwszeństwo; potem zmienne FAKTUROWNIA_SELLER_*.
 */
function mergeSellerIntoPayload(
  payload: Record<string, any>,
  config: FakturowniaConfig
): void {
  const name =
    (config.sellerName && String(config.sellerName).trim()) ||
    (process.env.FAKTUROWNIA_SELLER_NAME && process.env.FAKTUROWNIA_SELLER_NAME.trim()) ||
    "";
  const taxNo =
    (config.sellerTaxNo && String(config.sellerTaxNo).trim()) ||
    (process.env.FAKTUROWNIA_SELLER_TAX_NO && process.env.FAKTUROWNIA_SELLER_TAX_NO.trim()) ||
    "";
  const street =
    (config.sellerStreet && String(config.sellerStreet).trim()) ||
    (process.env.FAKTUROWNIA_SELLER_STREET && process.env.FAKTUROWNIA_SELLER_STREET.trim()) ||
    "";
  const city =
    (config.sellerCity && String(config.sellerCity).trim()) ||
    (process.env.FAKTUROWNIA_SELLER_CITY && process.env.FAKTUROWNIA_SELLER_CITY.trim()) ||
    "";
  const postCode =
    (config.sellerPostCode && String(config.sellerPostCode).trim()) ||
    (process.env.FAKTUROWNIA_SELLER_POST_CODE && process.env.FAKTUROWNIA_SELLER_POST_CODE.trim()) ||
    "";
  const country =
    (config.sellerCountry && String(config.sellerCountry).trim()) ||
    (process.env.FAKTUROWNIA_SELLER_COUNTRY && process.env.FAKTUROWNIA_SELLER_COUNTRY.trim()) ||
    "";

  if (name) payload.seller_name = name;
  if (taxNo) payload.seller_tax_no = taxNo;
  if (street) payload.seller_street = street;
  if (city) payload.seller_city = city;
  if (postCode) payload.seller_post_code = postCode;
  if (country) payload.seller_country = country;
}

/**
 * Pola KSeF nabywcy + procedury marży do payloadu faktury.
 * Ustawiane tylko gdy obecne — nie nadpisujemy domyślnych wartości Fakturowni.
 */
function mergeKsefFieldsIntoPayload(
  payload: Record<string, any>,
  data: FakturowniaInvoiceData
): void {
  if (typeof data.buyer_company === "boolean") payload.buyer_company = data.buyer_company;
  if (data.buyer_first_name) payload.buyer_first_name = data.buyer_first_name;
  if (data.buyer_last_name) payload.buyer_last_name = data.buyer_last_name;
  if (data.buyer_tax_no_kind) payload.buyer_tax_no_kind = data.buyer_tax_no_kind;
  if (data.procedure_vat_margin) payload.procedure_vat_margin = data.procedure_vat_margin;
  if (data.procedure_designations && data.procedure_designations.length > 0) {
    payload.procedure_designations = data.procedure_designations;
  }
}

/** Konfiguracja z env — użyteczna w route’ach API (jeden punkt wejścia). */
export function buildFakturowniaConfigFromEnv(): FakturowniaConfig {
  return {
    apiToken: process.env.FAKTUROWNIA_API_TOKEN || "",
    subdomain: process.env.FAKTUROWNIA_SUBDOMAIN || "",
    sellerName: process.env.FAKTUROWNIA_SELLER_NAME?.trim() || undefined,
    sellerTaxNo: process.env.FAKTUROWNIA_SELLER_TAX_NO?.trim() || undefined,
    sellerStreet: process.env.FAKTUROWNIA_SELLER_STREET?.trim() || undefined,
    sellerCity: process.env.FAKTUROWNIA_SELLER_CITY?.trim() || undefined,
    sellerPostCode: process.env.FAKTUROWNIA_SELLER_POST_CODE?.trim() || undefined,
    sellerCountry: process.env.FAKTUROWNIA_SELLER_COUNTRY?.trim() || undefined,
  };
}

function serializeNestedErrors(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    return val.map((v) => serializeNestedErrors(v)).filter(Boolean).join(", ");
  }
  if (typeof val === "object") {
    const o = val as Record<string, unknown>;
    if ("total_price_gross" in o || "price_net" in o) {
      return serializeNestedErrors(Object.values(o));
    }
    return JSON.stringify(val);
  }
  return String(val);
}

function serializeError(responseData: any): string {
  try {
    if (typeof responseData === "string") return responseData;
    if (Array.isArray(responseData)) {
      return responseData
        .map((e: any) => (typeof e === "string" ? e : serializeNestedErrors(e)))
        .join(", ");
    }
    if (responseData?.message && typeof responseData.message === "object") {
      const parts: string[] = [];
      for (const [field, errors] of Object.entries(responseData.message)) {
        parts.push(`${field}: ${serializeNestedErrors(errors)}`);
      }
      return parts.join(" | ");
    }
    if (responseData?.message != null && typeof responseData.message !== "object") {
      return String(responseData.message);
    }
    if (responseData?.errors) {
      return Array.isArray(responseData.errors)
        ? responseData.errors
            .map((e: any) => (typeof e === "string" ? e : serializeNestedErrors(e)))
            .join(", ")
        : serializeNestedErrors(responseData.errors);
    }
    return JSON.stringify(responseData);
  } catch {
    try {
      return JSON.stringify(responseData);
    } catch {
      return String(responseData);
    }
  }
}

/** Kwoty pozycji jako liczby — API akceptuje JSON number; unika pustych/niepoprawnych stringów. */
function mapPositionForApi(item: FakturowniaInvoiceItem): Record<string, string | number> {
  const net = Number(item.price_net);
  const gross = Number(item.total_price_gross);
  if (!Number.isFinite(net) || !Number.isFinite(gross)) {
    throw new Error(
      `Invalid invoice position amounts (price_net=${item.price_net}, total_price_gross=${item.total_price_gross})`
    );
  }
  const netRounded = Math.round(net * 100) / 100;
  const grossRounded = Math.round(gross * 100) / 100;
  const mapped: Record<string, string | number> = {
    name: item.name,
    quantity: item.quantity,
    price_net: netRounded,
    total_price_gross: grossRounded,
    tax: item.tax,
  };
  if (item.vat_margin_tax !== undefined && item.vat_margin_tax !== null && item.vat_margin_tax !== "") {
    mapped.vat_margin_tax = item.vat_margin_tax;
  }
  return mapped;
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

    /**
     * Fakturownia nie ma osobnego endpointu /orders.json.
     * Dokument nieksięgowy „Zamówienie” tworzy się przez /invoices.json z kind="estimate".
     */
    const orderAsInvoicePayload: Record<string, any> = {
      kind: "estimate",
      buyer_name: data.buyer_name,
      currency: data.currency || "PLN",
      lang: data.lang || "pl",
      positions: data.positions.map((item) => mapPositionForApi(item)),
    };

    if (data.buyer_tax_no) orderAsInvoicePayload.buyer_tax_no = data.buyer_tax_no;
    if (data.buyer_street) orderAsInvoicePayload.buyer_street = data.buyer_street;
    if (data.buyer_city) orderAsInvoicePayload.buyer_city = data.buyer_city;
    if (data.buyer_post_code) orderAsInvoicePayload.buyer_post_code = data.buyer_post_code;
    if (data.buyer_email) orderAsInvoicePayload.buyer_email = data.buyer_email;
    if (data.description) orderAsInvoicePayload.description = data.description;

    mergeSellerIntoPayload(orderAsInvoicePayload, config);

    console.log("[Fakturownia Client] Creating order:", {
      buyerName: data.buyer_name,
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
        invoice: orderAsInvoicePayload,
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

    const orderDocumentId = data.oid ?? data.order_id;

    /**
     * KSeF — oficjalny przykład z README API:
     * copy_invoice_from (ID dokumentu „Zamówienie” estimate) + advance_creation_mode + advance_value (+ position_name).
     * Samo invoice_id + positions nie podpina zaliczki do zamówienia w aktualnym API.
     */
    const useAdvanceFromOrderDoc =
      data.kind === "advance" &&
      orderDocumentId != null &&
      Number(orderDocumentId) > 0 &&
      data.advance_creation_mode != null &&
      data.advance_value !== undefined &&
      data.advance_value !== null &&
      String(data.advance_value).trim() !== "";

    let invoicePayload: Record<string, any>;

    if (useAdvanceFromOrderDoc) {
      const gross =
        typeof data.advance_value === "number"
          ? Math.round(data.advance_value * 100) / 100
          : parseFloat(String(data.advance_value).replace(",", "."));
      if (!Number.isFinite(gross)) {
        return {
          success: false,
          error: "advance_value musi być poprawną kwotą brutto (zaliczka)",
        };
      }

      invoicePayload = {
        copy_invoice_from: Number(orderDocumentId),
        kind: "advance",
        advance_creation_mode: data.advance_creation_mode,
        advance_value: String(gross),
        issue_date: data.issue_date,
        sell_date: data.sell_date,
        payment_type: data.payment_type,
        currency: data.currency,
        lang: data.lang || "pl",
        buyer_name: data.buyer_name,
      };

      if (data.position_name) invoicePayload.position_name = data.position_name;
      if (data.from_invoice_id) invoicePayload.from_invoice_id = data.from_invoice_id;
      if (data.external_order_ref) invoicePayload.oid = data.external_order_ref;
      if (data.number) invoicePayload.number = data.number;
      if (data.payment_to) invoicePayload.payment_to = data.payment_to;
      if (data.buyer_tax_no) invoicePayload.buyer_tax_no = data.buyer_tax_no;
      if (data.buyer_street) invoicePayload.buyer_street = data.buyer_street;
      if (data.buyer_city) invoicePayload.buyer_city = data.buyer_city;
      if (data.buyer_post_code) invoicePayload.buyer_post_code = data.buyer_post_code;
      if (data.buyer_country) invoicePayload.buyer_country = data.buyer_country;
      if (data.buyer_email) invoicePayload.buyer_email = data.buyer_email;
      if (data.buyer_phone) invoicePayload.buyer_phone = data.buyer_phone;
      if (data.description) invoicePayload.description = data.description;
      if (data.internal_note) invoicePayload.internal_note = data.internal_note;

      if (data.margin_procedure === true || process.env.FAKTUROWNIA_MARGIN_PROCEDURE === "true") {
        invoicePayload.margin_procedure = true;
      }

      mergeKsefFieldsIntoPayload(invoicePayload, data);
      mergeSellerIntoPayload(invoicePayload, config);

      console.log("[Fakturownia Client] Creating advance invoice (KSeF copy_invoice_from):", {
        copy_invoice_from: orderDocumentId,
        advance_creation_mode: data.advance_creation_mode,
        advance_value: invoicePayload.advance_value,
        from_invoice_id: data.from_invoice_id,
      });
    } else {
      if (!data.positions || data.positions.length === 0) {
        return {
          success: false,
          error:
            "Brak pozycji faktury — dla zaliczki z zamówieniem ustaw advance_creation_mode i advance_value",
        };
      }

      invoicePayload = {
        kind: data.kind,
        sell_date: data.sell_date,
        issue_date: data.issue_date,
        payment_type: data.payment_type,
        currency: data.currency,
        lang: data.lang || "pl",
        buyer_name: data.buyer_name,
        positions: data.positions.map((item) => mapPositionForApi(item)),
      };

      if (data.margin_procedure === true || process.env.FAKTUROWNIA_MARGIN_PROCEDURE === "true") {
        invoicePayload.margin_procedure = true;
      }

      if (data.number) invoicePayload.number = data.number;
      if (data.payment_to) invoicePayload.payment_to = data.payment_to;

      if (data.kind === "advance" && orderDocumentId) {
        invoicePayload.invoice_id = orderDocumentId;
      } else if (orderDocumentId) {
        invoicePayload.oid = orderDocumentId;
      }
      if (data.external_order_ref) {
        invoicePayload.oid = data.external_order_ref;
      }
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

      mergeKsefFieldsIntoPayload(invoicePayload, data);
      mergeSellerIntoPayload(invoicePayload, config);

      console.log("[Fakturownia Client] Creating invoice:", {
        kind: data.kind,
        buyerName: data.buyer_name,
        orderDocumentId,
        fromInvoiceId: data.from_invoice_id,
        positions: data.positions.length,
      });
    }

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
 * Z odpowiedzi GET /invoices/:id.json — ID dokumentu zamówienia (estimate) do zapisu w booking.
 * API zwraca m.in. `invoice_id` (zaliczka → zamówienie) lub starsze pola.
 */
export function extractOrderIdFromInvoiceJson(raw: Record<string, unknown>): number | undefined {
  const tryParse = (v: unknown): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return (
    tryParse(raw.invoice_id) ?? tryParse(raw.oid) ?? tryParse(raw.order_id)
  );
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

/** URL podglądu HTML faktury (z api_token) — do renderowania PDF przez headless browser. */
export function buildInvoiceHtmlViewUrl(
  config: FakturowniaConfig,
  invoiceId: number | string,
): string {
  const baseUrl = getBaseUrl(config);
  return `${baseUrl}/invoices/${invoiceId}?api_token=${encodeURIComponent(config.apiToken)}`;
}

/**
 * Pobiera PDF faktury przez render strony podglądu w headless browser.
 * Działa dla faktur zaliczkowych, gdy bezpośredni endpoint .pdf zwraca HTTP 422.
 */
export async function downloadInvoicePdfViaBrowser(
  config: FakturowniaConfig,
  invoiceId: number | string,
): Promise<Buffer> {
  const viewUrl = buildInvoiceHtmlViewUrl(config, invoiceId);
  const isDev = process.env.NODE_ENV === "development";
  const forceNoChromium = process.env.PDF_FORCE_NO_CHROMIUM === "1";

  if (isDev && !forceNoChromium) {
    // eslint-disable-next-line no-eval
    let playwrightModule: any = await eval('import("playwright")').catch(() => null);
    if (!playwrightModule) {
      // eslint-disable-next-line no-eval
      playwrightModule = await eval('import("@playwright/test")').catch(() => null);
    }
    if (playwrightModule?.chromium) {
      const browser = await playwrightModule.chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(viewUrl, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(2000);
        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
        });
        const buf = Buffer.from(pdfBuffer);
        if (buf.length < 1000 || buf.subarray(0, 4).toString() !== "%PDF") {
          throw new Error("Browser render did not produce a valid PDF");
        }
        console.log("[Fakturownia Client] PDF via Playwright, size:", buf.length);
        return buf;
      } finally {
        await browser.close();
      }
    }
  }

  if (!forceNoChromium) {
    // eslint-disable-next-line no-eval
    const puppeteerModule = await eval('import("puppeteer-core")').catch(() => null);
    // eslint-disable-next-line no-eval
    const chromiumModule = await eval('import("@sparticuz/chromium")').catch(() => null);
    if (puppeteerModule && chromiumModule) {
      const chromium = chromiumModule.default;
      if (typeof chromium.setGraphicsMode === "function") {
        chromium.setGraphicsMode(false);
      }
      const browser = await puppeteerModule.default.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless ?? true,
      });
      try {
        const page = await browser.newPage();
        await page.goto(viewUrl, { waitUntil: "networkidle0", timeout: 60000 });
        await page.waitForTimeout(2000);
        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
        });
        const buf = Buffer.from(pdfBuffer);
        if (buf.length < 1000 || buf.subarray(0, 4).toString() !== "%PDF") {
          throw new Error("Browser render did not produce a valid PDF");
        }
        console.log("[Fakturownia Client] PDF via puppeteer/chromium, size:", buf.length);
        return buf;
      } finally {
        await browser.close();
      }
    }
  }

  throw new Error("Brak headless browser do renderowania PDF faktury");
}

/**
 * Downloads a PDF from a URL and returns it as a Buffer.
 */
export async function downloadPdf(pdfUrl: string): Promise<Buffer> {
  const response = await fetch(pdfUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to download PDF: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  if (buf.length < 4 || buf.subarray(0, 4).toString() !== "%PDF") {
    const contentType = response.headers.get("content-type") ?? "unknown";
    throw new Error(`Response is not a PDF (content-type: ${contentType})`);
  }
  return buf;
}

/**
 * Wysyła fakturę e-mailem bezpośrednio z Fakturowni (PDF w załączniku).
 * Fallback gdy API nie zwraca PDF (np. niektóre faktury zaliczkowe / KSeF → HTTP 422).
 */
export async function sendInvoiceByEmail(
  config: FakturowniaConfig,
  invoiceId: number | string,
  emailTo: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const baseUrl = getBaseUrl(config);
    const params = new URLSearchParams({
      api_token: config.apiToken,
      email_to: emailTo,
      email_pdf: "true",
    });

    const response = await fetch(
      `${baseUrl}/invoices/${invoiceId}/send_by_email.json?${params.toString()}`,
      { method: "POST", headers: { Accept: "application/json" } },
    );

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: serializeError(responseData) || `HTTP ${response.status}`,
      };
    }

    if (responseData?.status === "ok") {
      return { success: true, message: responseData.message };
    }

    return {
      success: false,
      error: serializeError(responseData) || "Unexpected send_by_email response",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Nieznany błąd",
    };
  }
}

// ===================== KSeF =====================

export interface KsefStatusResult {
  success: boolean;
  govStatus?: string | null;
  govId?: string | null;
  govErrorMessages?: string[] | null;
  error?: string;
}

function parseKsefFields(raw: Record<string, any> | null | undefined): KsefStatusResult {
  if (!raw) return { success: false, error: "Brak danych faktury" };
  const errs = raw.gov_error_messages;
  return {
    success: true,
    govStatus: (raw.gov_status as string) ?? null,
    govId: (raw.gov_id as string) ?? null,
    govErrorMessages: Array.isArray(errs) ? (errs as string[]) : errs ? [String(errs)] : null,
  };
}

/**
 * Wysyła istniejącą fakturę do KSeF (`send_to_ksef=yes`).
 * Odpowiedź zawiera wstępny `gov_status` (np. "processing"/"send_error").
 */
export async function sendInvoiceToKsef(
  config: FakturowniaConfig,
  invoiceId: number | string
): Promise<KsefStatusResult> {
  try {
    const baseUrl = getBaseUrl(config);
    const params = new URLSearchParams({
      send_to_ksef: "yes",
      api_token: config.apiToken,
    });
    const response = await fetch(`${baseUrl}/invoices/${invoiceId}.json?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const responseData = await response.json().catch(() => null);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${serializeError(responseData)}` };
    }
    return parseKsefFields(responseData);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Nieznany błąd" };
  }
}

/**
 * Odczytuje status KSeF faktury (`gov_status`, `gov_id`, `gov_error_messages`).
 */
export async function getInvoiceKsefStatus(
  config: FakturowniaConfig,
  invoiceId: number | string
): Promise<KsefStatusResult> {
  try {
    const baseUrl = getBaseUrl(config);
    const params = new URLSearchParams({ api_token: config.apiToken });
    params.append("fields[invoice]", "gov_status,gov_id,gov_error_messages");
    const response = await fetch(`${baseUrl}/invoices/${invoiceId}.json?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const responseData = await response.json().catch(() => null);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    return parseKsefFields(responseData);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Nieznany błąd" };
  }
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
