import crypto from "crypto";
import zlib from "zlib";
import { promisify } from "util";

const gzip = promisify(zlib.gzip);

export interface SaldeoConfig {
  username: string;
  apiToken: string;
  companyProgramId: string;
  apiUrl: string;
}

export interface SaldeoContractor {
  contractorId: string;
  shortName: string;
  fullName?: string;
  nip?: string;
  city?: string;
  street?: string;
  postcode?: string;
  inactive?: boolean;
}

export interface SaldeoInvoiceItem {
  name: string;
  amount: number;
  unit: string;
  unitValue: number;
  rate?: string;
}

export interface SaldeoInvoiceData {
  NUMBER: string;
  issueDate: string;
  saleDate: string;
  purchaserContractorId: number;
  recipientContractorId?: number;
  currencyIso4217: string;
  paymentType: string;
  dueDate?: string;
  accordingToAgreement?: boolean;
  calculatedFromGross?: boolean;
  noVat?: boolean;
  issuePerson?: string;
  footer?: string;
  items: SaldeoInvoiceItem[];
  // Advance invoice (faktura zaliczkowa) fields
  profitMarginType?: string; // e.g. "TRAVEL_AGENCIES" for Procedura marży biur podróży
  isAdvanceInvoice?: boolean;
  orderSum?: number; // SUM - wartość zamówienia (wymagana dla zaliczkowej)
  paidSum?: number; // PAID_SUM - kwota wpłaconej zaliczki
}

export interface SaldeoResponse {
  success: boolean;
  invoiceId?: string;
  error?: string;
  rawResponse?: string;
}

export interface InvoicePdfResponse {
  success: boolean;
  pdfUrl?: string;
  invoiceNumber?: string;
  error?: string;
  rawResponse?: string;
}

export interface BuyerData {
  name: string;
  nip?: string;
  address?: { street?: string; city?: string; zip?: string };
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface InvoiceData {
  saleDate: string;
  buyer: BuyerData;
  items: InvoiceItem[];
  invoiceNumber?: string;
}

// ===================== HELPERS =====================

function saldeoUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/%20/g, "+")
    .replace(/%([0-9a-f]{2})/gi, (_m: string, hex: string) => "%" + hex.toUpperCase());
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeCDATA(str: string): string {
  return str.replace(/]]>/g, "]]]]><![CDATA[>");
}

function generateReqId(): string {
  return Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9);
}

// ===================== SIGNATURE =====================

export function generateSignature(
  params: Record<string, string>,
  apiToken: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map((key) => key + "=" + params[key]).join("");
  const encoded = saldeoUrlEncode(paramString);
  const stringToHash = encoded + apiToken;
  return crypto.createHash("md5").update(stringToHash).digest("hex");
}

export function generateRequestSignature(
  reqId: string,
  username: string,
  companyProgramId: string,
  command: string,
  apiToken: string
): string {
  return generateSignature(
    { command: command, company_program_id: companyProgramId, req_id: reqId, username: username },
    apiToken
  );
}

// ===================== GZIP + BASE64 =====================

export async function compressAndEncodeXML(xml: string): Promise<string> {
  const compressed = await gzip(Buffer.from(xml, "utf-8"));
  return compressed.toString("base64");
}

// ===================== CONTRACTORS (SS07) =====================

export async function fetchContractors(
  config: SaldeoConfig
): Promise<{ success: boolean; contractors: SaldeoContractor[]; error?: string; rawResponse?: string }> {
  try {
    const reqId = generateReqId();
    const params: Record<string, string> = {
      company_program_id: config.companyProgramId,
      req_id: reqId,
      username: config.username,
    };
    const reqSig = generateSignature(params, config.apiToken);

    const url = config.apiUrl + "/api/xml/2.0/contractor/list" +
      "?username=" + encodeURIComponent(config.username) +
      "&req_id=" + encodeURIComponent(reqId) +
      "&req_sig=" + reqSig +
      "&company_program_id=" + encodeURIComponent(config.companyProgramId);

    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept-Encoding": "gzip, deflate" },
    });
    const responseText = await response.text();

    if (!response.ok) {
      return { success: false, contractors: [], error: "HTTP " + response.status, rawResponse: responseText };
    }

    const statusMatch = responseText.match(/<STATUS>([^<]+)<\/STATUS>/i);
    if (statusMatch && statusMatch[1] !== "OK") {
      const errorMsg = responseText.match(/<ERROR_MESSAGE>([^<]+)<\/ERROR_MESSAGE>/i);
      return { success: false, contractors: [], error: errorMsg ? errorMsg[1] : statusMatch[1], rawResponse: responseText };
    }

    const contractors: SaldeoContractor[] = [];
    const contractorRegex = /<CONTRACTOR>([\s\S]*?)<\/CONTRACTOR>/gi;
    let match;
    while ((match = contractorRegex.exec(responseText)) !== null) {
      const block = match[1];
      const getTag = (tag: string): string | undefined => {
        const m = block.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">", "i"));
        return m ? m[1].trim() : undefined;
      };
      const contractorId = getTag("CONTRACTOR_ID");
      const shortName = getTag("SHORT_NAME");
      if (contractorId && shortName) {
        contractors.push({
          contractorId: contractorId,
          shortName: shortName,
          fullName: getTag("FULL_NAME"),
          nip: getTag("NIP"),
          city: getTag("CITY"),
          street: getTag("STREET"),
          postcode: getTag("POSTCODE"),
          inactive: getTag("INACTIVE") === "true",
        });
      }
    }

    return { success: true, contractors: contractors, rawResponse: responseText };
  } catch (error) {
    return { success: false, contractors: [], error: error instanceof Error ? error.message : "Nieznany blad" };
  }
}

// ===================== INVOICE ADD (SSK06) =====================

/**
 * Builds XML for a standard invoice (non-advance).
 */
export function buildInvoiceAddXML(data: SaldeoInvoiceData): string {
  const itemsXml = data.items
    .map((item) => {
      let xml = "      <INVOICE_ITEM>\n";
      xml += "        <NAME><![CDATA[" + escapeCDATA(item.name) + "]]></NAME>\n";
      xml += "        <AMOUNT>" + item.amount + "</AMOUNT>\n";
      xml += "        <UNIT>" + escapeXML(item.unit) + "</UNIT>\n";
      xml += "        <UNIT_VALUE>" + item.unitValue.toFixed(2) + "</UNIT_VALUE>\n";
      if (item.rate) {
        xml += "        <RATE>" + escapeXML(item.rate) + "</RATE>\n";
      }
      xml += "      </INVOICE_ITEM>";
      return xml;
    })
    .join("\n");

  let paymentTermXml: string;
  if (data.dueDate) {
    paymentTermXml = "    <DUE_DATE>" + data.dueDate + "</DUE_DATE>";
  } else {
    paymentTermXml = "    <ACCORDING_TO_AGREEMENT>true</ACCORDING_TO_AGREEMENT>";
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<ROOT>\n";
  xml += "  <INVOICE>\n";
  xml += "    <NUMBER>" + escapeXML(data.NUMBER) + "</NUMBER>\n";
  xml += "    <ISSUE_DATE>" + data.issueDate + "</ISSUE_DATE>\n";
  xml += "    <SALE_DATE>" + data.saleDate + "</SALE_DATE>\n";
  xml += paymentTermXml + "\n";
  if (data.noVat) {
    xml += "    <NO_VAT>true</NO_VAT>\n";
  }
  if (data.calculatedFromGross) {
    xml += "    <CALCULATED_FROM_GROSS>true</CALCULATED_FROM_GROSS>\n";
  }
  if (data.profitMarginType) {
    xml += "    <PROFIT_MARGIN_TYPE>" + escapeXML(data.profitMarginType) + "</PROFIT_MARGIN_TYPE>\n";
  }
  xml += "    <PURCHASER_CONTRACTOR_ID>" + data.purchaserContractorId + "</PURCHASER_CONTRACTOR_ID>\n";
  if (data.recipientContractorId) {
    xml += "    <RECIPIENT_CONTRACTOR_ID>" + data.recipientContractorId + "</RECIPIENT_CONTRACTOR_ID>\n";
  }
  xml += "    <CURRENCY_ISO4217>" + escapeXML(data.currencyIso4217) + "</CURRENCY_ISO4217>\n";
  xml += "    <PAYMENT_TYPE>" + escapeXML(data.paymentType) + "</PAYMENT_TYPE>\n";
  if (data.issuePerson) {
    xml += "    <ISSUE_PERSON><![CDATA[" + escapeCDATA(data.issuePerson) + "]]></ISSUE_PERSON>\n";
  }
  if (data.footer) {
    xml += "    <FOOTER><![CDATA[" + escapeCDATA(data.footer) + "]]></FOOTER>\n";
  }
  xml += "    <INVOICE_ITEMS>\n";
  xml += itemsXml + "\n";
  xml += "    </INVOICE_ITEMS>\n";
  xml += "  </INVOICE>\n";
  xml += "</ROOT>";

  return xml;
}

/**
 * Builds XML for an advance invoice (faktura zaliczkowa) with Procedura Marży.
 * Uses the same invoice/add endpoint but with additional fields for advance invoices.
 *
 * According to Saldeo API spec SSK06:
 * - PROFIT_MARGIN_TYPE: "TRAVEL_AGENCIES" for travel agency margin procedure
 * - For advance invoices, we include SUM (order total) and PAID_SUM (advance amount)
 * - The invoice items should use rate "NP" (nie podlega) for margin procedure
 */
export function buildAdvanceInvoiceXML(data: SaldeoInvoiceData): string {
  const itemsXml = data.items
    .map((item) => {
      let xml = "      <INVOICE_ITEM>\n";
      xml += "        <NAME><![CDATA[" + escapeCDATA(item.name) + "]]></NAME>\n";
      xml += "        <AMOUNT>" + item.amount + "</AMOUNT>\n";
      xml += "        <UNIT>" + escapeXML(item.unit) + "</UNIT>\n";
      xml += "        <UNIT_VALUE>" + item.unitValue.toFixed(2) + "</UNIT_VALUE>\n";
      // For margin procedure, use "NP" (nie podlega) VAT rate
      xml += "        <RATE>" + escapeXML(item.rate || "NP") + "</RATE>\n";
      xml += "      </INVOICE_ITEM>";
      return xml;
    })
    .join("\n");

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<ROOT>\n";
  xml += "  <INVOICE>\n";
  xml += "    <NUMBER>" + escapeXML(data.NUMBER) + "</NUMBER>\n";
  xml += "    <ISSUE_DATE>" + data.issueDate + "</ISSUE_DATE>\n";
  xml += "    <SALE_DATE>" + data.saleDate + "</SALE_DATE>\n";

  // Payment term – Saldeo wymaga zawsze DUE_DATE lub ACCORDING_TO_AGREEMENT
  if (data.dueDate) {
    xml += "    <DUE_DATE>" + data.dueDate + "</DUE_DATE>\n";
  } else {
    xml += "    <ACCORDING_TO_AGREEMENT>true</ACCORDING_TO_AGREEMENT>\n";
  }

  // Advance invoice is always calculated from gross for margin procedure
  xml += "    <CALCULATED_FROM_GROSS>true</CALCULATED_FROM_GROSS>\n";

  // Procedura marży biur podróży – w aktualnym API w tym miejscu
  // dopuszczalne jest IS_MPP lub przejście do PURCHASER_CONTRACTOR_ID,
  // więc sygnalizujemy tylko IS_MPP, bez PROFIT_MARGIN_TYPE.
  if (data.profitMarginType) {
    xml += "    <IS_MPP>true</IS_MPP>\n";
  }

  xml += "    <PURCHASER_CONTRACTOR_ID>" + data.purchaserContractorId + "</PURCHASER_CONTRACTOR_ID>\n";
  if (data.recipientContractorId) {
    xml += "    <RECIPIENT_CONTRACTOR_ID>" + data.recipientContractorId + "</RECIPIENT_CONTRACTOR_ID>\n";
  }
  xml += "    <CURRENCY_ISO4217>" + escapeXML(data.currencyIso4217) + "</CURRENCY_ISO4217>\n";
  xml += "    <PAYMENT_TYPE>" + escapeXML(data.paymentType) + "</PAYMENT_TYPE>\n";

  if (data.issuePerson) {
    xml += "    <ISSUE_PERSON><![CDATA[" + escapeCDATA(data.issuePerson) + "]]></ISSUE_PERSON>\n";
  }
  if (data.footer) {
    xml += "    <FOOTER><![CDATA[" + escapeCDATA(data.footer) + "]]></FOOTER>\n";
  }

  // INVOICE_ITEMS – w aktualnym schemacie po nich powinny następować
  // ewentualnie INVOICE_PAYMENTS / NEW_TRANSPORT_VEHICLE, więc
  // rezygnujemy z pól SUM/PAID_SUM na poziomie XML i zakodujemy kwoty
  // wyłącznie w pozycjach (amount * unitValue).
  xml += "    <INVOICE_ITEMS>\n";
  xml += itemsXml + "\n";
  xml += "    </INVOICE_ITEMS>\n";
  xml += "  </INVOICE>\n";
  xml += "</ROOT>";

  return xml;
}

export async function createSaldeoInvoice(
  config: SaldeoConfig,
  data: SaldeoInvoiceData
): Promise<SaldeoResponse> {
  try {
    // Use advance invoice XML builder if isAdvanceInvoice flag is set
    const xml = data.isAdvanceInvoice
      ? buildAdvanceInvoiceXML(data)
      : buildInvoiceAddXML(data);

    console.log("[Saldeo Client] Building invoice XML:", {
      isAdvance: data.isAdvanceInvoice,
      profitMarginType: data.profitMarginType,
      orderSum: data.orderSum,
      paidSum: data.paidSum,
      number: data.NUMBER,
      xmlPreview: xml.substring(0, 500),
    });

    const command = await compressAndEncodeXML(xml);
    const reqId = generateReqId();

    const params: Record<string, string> = {
      command: command,
      company_program_id: config.companyProgramId,
      req_id: reqId,
      username: config.username,
    };
    const reqSig = generateSignature(params, config.apiToken);

    const bodyParams = new URLSearchParams();
    bodyParams.set("username", config.username);
    bodyParams.set("req_id", reqId);
    bodyParams.set("req_sig", reqSig);
    bodyParams.set("company_program_id", config.companyProgramId);
    bodyParams.set("command", command);

    const response = await fetch(config.apiUrl + "/api/xml/3.0/invoice/add", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
    });
    const responseText = await response.text();

    if (!response.ok) {
      return { success: false, error: "HTTP " + response.status + ": " + responseText, rawResponse: responseText };
    }

    const statusMatch = responseText.match(/<STATUS>([^<]+)<\/STATUS>/i);
    if (statusMatch && statusMatch[1] !== "OK") {
      const errorCode = responseText.match(/<ERROR_CODE>([^<]+)<\/ERROR_CODE>/i);
      const errorMsg = responseText.match(/<ERROR_MESSAGE>([^<]+)<\/ERROR_MESSAGE>/i);
      return {
        success: false,
        error: "[" + (errorCode ? errorCode[1] : "?") + "] " + (errorMsg ? errorMsg[1] : statusMatch[1]),
        rawResponse: responseText,
      };
    }

    // Check for both INVOICE_ID and PRE_INVOICE_ID in the response
    const invoiceIdMatch = responseText.match(/<(?:INVOICE_ID|PRE_INVOICE_ID)[^>]*>([^<]+)<\/(?:INVOICE_ID|PRE_INVOICE_ID)>/i);
    return {
      success: true,
      invoiceId: invoiceIdMatch ? invoiceIdMatch[1].trim() : undefined,
      rawResponse: responseText,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Nieznany blad" };
  }
}

// ===================== INVOICE PDF RETRIEVAL (SSK08) =====================

/**
 * Fetches the PDF URL for an invoice from Saldeo via invoice/listbyid.
 * Supports both regular invoices and advance invoices (PRE_INVOICES).
 */
export async function getInvoicePdfUrl(
  config: SaldeoConfig,
  saldeoInvoiceId: string,
  isAdvanceInvoice: boolean = false
): Promise<InvoicePdfResponse> {
  try {
    // Build the XML request based on invoice type
    // For advance invoices, use PRE_INVOICES container; for regular, use INVOICES
    const invoiceContainer = isAdvanceInvoice ? "PRE_INVOICES" : "INVOICES";
    const invoiceIdTag = isAdvanceInvoice ? "PRE_INVOICE_ID" : "INVOICE_ID";

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<ROOT>\n  <' + invoiceContainer + '>\n    <' + invoiceIdTag + '>' + escapeXML(saldeoInvoiceId) + '</' + invoiceIdTag + '>\n  </' + invoiceContainer + '>\n</ROOT>';

    console.log("[Saldeo Client] Fetching PDF for invoice:", {
      saldeoInvoiceId,
      isAdvanceInvoice,
      xmlRequest: xml,
    });

    const command = await compressAndEncodeXML(xml);
    const reqId = generateReqId();
    const reqSig = generateRequestSignature(reqId, config.username, config.companyProgramId, command, config.apiToken);
    const body = new URLSearchParams({
      username: config.username,
      req_id: reqId,
      req_sig: reqSig,
      company_program_id: config.companyProgramId,
      command: command,
    });

    const response = await fetch(config.apiUrl + "/api/xml/3.0/invoice/listbyid", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const responseText = await response.text();

    if (!response.ok) {
      return { success: false, error: "HTTP " + response.status, rawResponse: responseText };
    }

    const statusMatch = responseText.match(/<STATUS>([^<]+)<\/STATUS>/i);
    if (statusMatch && statusMatch[1] !== "OK") {
      const errorMsg = responseText.match(/<ERROR_MESSAGE>([^<]+)<\/ERROR_MESSAGE>/i);
      return {
        success: false,
        error: errorMsg ? errorMsg[1] : statusMatch[1],
        rawResponse: responseText,
      };
    }

    // SOURCE contains the URL to the PDF
    const sourceMatch = responseText.match(/<SOURCE[^>]*>([^<]+)<\/SOURCE>/i);
    const numberMatch = responseText.match(/<NUMBER[^>]*>([^<]+)<\/NUMBER>/i);

    if (sourceMatch && sourceMatch[1]) {
      return {
        success: true,
        pdfUrl: sourceMatch[1].trim(),
        invoiceNumber: numberMatch ? numberMatch[1].trim() : undefined,
        rawResponse: responseText,
      };
    }

    return { success: false, error: "Nie znaleziono URL do PDF w odpowiedzi.", rawResponse: responseText };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Nieznany blad" };
  }
}

/**
 * Downloads a PDF file from a URL and returns it as a Buffer.
 */
export async function downloadPdf(pdfUrl: string): Promise<Buffer> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF from ${pdfUrl}: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ===================== OLD COMPAT =====================

export function prepareInvoiceXML(data: InvoiceData): string {
  const items = data.items.map((item) => {
    const netPrice = item.unitPrice * item.quantity;
    const vatAmount = (netPrice * item.vatRate) / 100;
    const grossPrice = netPrice + vatAmount;
    return "    <INVOICE_ITEM>\n      <NAME><![CDATA[" + escapeCDATA(item.name) + "]]></NAME>\n      <QUANTITY>" + item.quantity + "</QUANTITY>\n      <UNIT_PRICE>" + item.unitPrice.toFixed(2) + "</UNIT_PRICE>\n      <NET_PRICE>" + netPrice.toFixed(2) + "</NET_PRICE>\n      <VAT_RATE>" + item.vatRate + "</VAT_RATE>\n      <GROSS_PRICE>" + grossPrice.toFixed(2) + "</GROSS_PRICE>\n    </INVOICE_ITEM>";
  });
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<REQUEST>\n  <SALE_DATE>' + data.saleDate + "</SALE_DATE>\n  <BUYER_NAME><![CDATA[" + escapeCDATA(data.buyer.name) + "]]></BUYER_NAME>";
  if (data.buyer.nip) xml += "\n  <BUYER_NIP>" + escapeXML(data.buyer.nip) + "</BUYER_NIP>";
  if (data.invoiceNumber) xml += "\n  <NUMBER>" + escapeXML(data.invoiceNumber) + "</NUMBER>";
  xml += "\n  <INVOICE_ITEMS>\n" + items.join("\n") + "\n  </INVOICE_ITEMS>\n</REQUEST>";
  return xml;
}

export async function createInvoiceInSaldeo(
  config: SaldeoConfig,
  invoiceData: InvoiceData
): Promise<SaldeoResponse> {
  try {
    const xml = prepareInvoiceXML(invoiceData);
    const command = await compressAndEncodeXML(xml);
    const reqId = generateReqId();
    const reqSig = generateRequestSignature(reqId, config.username, config.companyProgramId, command, config.apiToken);
    const body = new URLSearchParams({ username: config.username, req_id: reqId, req_sig: reqSig, company_program_id: config.companyProgramId, command: command });
    const response = await fetch(config.apiUrl + "/api/xml/3.0/invoice/add", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const responseText = await response.text();
    if (!response.ok) return { success: false, error: "HTTP " + response.status, rawResponse: responseText };
    const invoiceId = responseText.match(/<INVOICE_ID[^>]*>([^<]+)<\/INVOICE_ID>/i);
    if (invoiceId) return { success: true, invoiceId: invoiceId[1].trim(), rawResponse: responseText };
    return { success: false, error: "Nie znaleziono INVOICE_ID w odpowiedzi", rawResponse: responseText };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Nieznany blad" };
  }
}
