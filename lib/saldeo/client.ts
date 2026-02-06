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

export interface BuyerData {
  name: string;
  nip?: string;
  address?: {
    street?: string;
    city?: string;
    zip?: string;
  };
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number; // w złotych (np. 100.00)
  vatRate: number; // np. 23 dla 23%
}

export interface InvoiceData {
  saleDate: string; // format YYYY-MM-DD
  buyer: BuyerData;
  items: InvoiceItem[];
  invoiceNumber?: string; // opcjonalny numer faktury (jeśli Saldeo ma użyć własnej numeracji, nie podawaj)
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

/**
 * Generuje sygnaturę żądania (req_sig) zgodnie z algorytmem Saldeo
 * 1. Zbierz parametry: req_id, username, company_program_id, command
 * 2. Posortuj alfabetycznie według nazw kluczy
 * 3. Złącz w string: klucz=wartość
 * 4. Zakoduj URL encoding (spacja to +, znaki specjalne uppercase)
 * 5. Dodaj na końcu api_token
 * 6. Wylicz MD5 i zapisz jako Hex
 */
export function generateRequestSignature(
  reqId: string,
  username: string,
  companyProgramId: string,
  command: string,
  apiToken: string
): string {
  // 1-2. Zbierz i posortuj parametry alfabetycznie
  const params: Record<string, string> = {
    command,
    company_program_id: companyProgramId,
    req_id: reqId,
    username,
  };

  // 3. Złącz w string klucz=wartość
  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("");

  // 4. URL encoding (spacja to +, znaki specjalne uppercase)
  const encoded = encodeURIComponent(paramString)
    .replace(/%20/g, "+")
    .replace(/%[a-f]/g, (match) => match.toUpperCase());

  // 5. Dodaj api_token na końcu
  const stringToHash = encoded + apiToken;

  // 6. Wylicz MD5 i zwróć jako Hex
  return crypto.createHash("md5").update(stringToHash).digest("hex");
}

/**
 * Przygotowuje XML faktury zgodnie ze specyfikacją invoice_add_request.xsd
 */
export function prepareInvoiceXML(data: InvoiceData): string {
  const { saleDate, buyer, items, invoiceNumber } = data;

  // Oblicz ceny dla każdej pozycji
  const invoiceItems = items.map((item) => {
    const netPrice = item.unitPrice * item.quantity;
    const vatAmount = (netPrice * item.vatRate) / 100;
    const grossPrice = netPrice + vatAmount;

    return `    <INVOICE_ITEM>
      <NAME><![CDATA[${escapeCDATA(item.name)}]]></NAME>
      <QUANTITY>${item.quantity}</QUANTITY>
      <UNIT_PRICE>${item.unitPrice.toFixed(2)}</UNIT_PRICE>
      <NET_PRICE>${netPrice.toFixed(2)}</NET_PRICE>
      <VAT_RATE>${item.vatRate}</VAT_RATE>
      <GROSS_PRICE>${grossPrice.toFixed(2)}</GROSS_PRICE>
    </INVOICE_ITEM>`;
  });

  // Przygotuj adres kontrahenta
  const buyerAddress = buyer.address
    ? `${buyer.address.street || ""}, ${buyer.address.zip || ""} ${buyer.address.city || ""}`
        .replace(/^,\s*/, "")
        .replace(/,\s*$/, "")
        .trim()
    : "";

  // Buduj XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<REQUEST>
  <SALE_DATE>${saleDate}</SALE_DATE>
  <BUYER_NAME><![CDATA[${escapeCDATA(buyer.name)}]]></BUYER_NAME>`;

  if (buyer.nip) {
    xml += `\n  <BUYER_NIP>${escapeXML(buyer.nip)}</BUYER_NIP>`;
  }

  if (buyerAddress) {
    xml += `\n  <BUYER_ADDRESS><![CDATA[${escapeCDATA(buyerAddress)}]]></BUYER_ADDRESS>`;
  }

  if (invoiceNumber) {
    xml += `\n  <NUMBER>${escapeXML(invoiceNumber)}</NUMBER>`;
  }

  xml += `\n  <INVOICE_ITEMS>
${invoiceItems.join("\n")}
  </INVOICE_ITEMS>
</REQUEST>`;

  return xml;
}

/**
 * Kompresuje XML za pomocą Gzip i koduje do Base64
 */
export async function compressAndEncodeXML(xml: string): Promise<string> {
  const compressed = await gzip(Buffer.from(xml, "utf-8"));
  return compressed.toString("base64");
}

/**
 * Wysyła żądanie do Saldeo API w celu wystawienia faktury
 */
export async function createInvoiceInSaldeo(
  config: SaldeoConfig,
  invoiceData: InvoiceData
): Promise<SaldeoResponse> {
  try {
    // Przygotuj XML
    const xml = prepareInvoiceXML(invoiceData);
    const command = await compressAndEncodeXML(xml);

    // Generuj unikalny req_id (timestamp + random)
    const reqId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Generuj sygnaturę
    const reqSig = generateRequestSignature(
      reqId,
      config.username,
      config.companyProgramId,
      command,
      config.apiToken
    );

    // Przygotuj body żądania
    const body = new URLSearchParams({
      username: config.username,
      req_id: reqId,
      req_sig: reqSig,
      company_program_id: config.companyProgramId,
      command,
    });

    // Wyślij żądanie POST
    const response = await fetch(`${config.apiUrl}/api/xml/3.0/invoice/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText}`,
        rawResponse: responseText,
      };
    }

    // Parsuj odpowiedź XML
    const invoiceId = parseInvoiceIdFromResponse(responseText);

    if (invoiceId) {
      return {
        success: true,
        invoiceId,
        rawResponse: responseText,
      };
    } else {
      return {
        success: false,
        error: "Nie znaleziono INVOICE_ID w odpowiedzi",
        rawResponse: responseText,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Nieznany błąd",
    };
  }
}

/**
 * Parsuje INVOICE_ID z odpowiedzi XML Saldeo
 */
function parseInvoiceIdFromResponse(xmlResponse: string): string | null {
  // Proste parsowanie XML - szukamy <INVOICE_ID>...</INVOICE_ID>
  const match = xmlResponse.match(/<INVOICE_ID[^>]*>([^<]+)<\/INVOICE_ID>/i);
  return match ? match[1].trim() : null;
}

/**
 * Funkcje pomocnicze do escape XML/CDATA
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeCDATA(str: string): string {
  // CDATA nie może zawierać ]]> - zamień na ]]]]><![CDATA[>
  return str.replace(/]]>/g, "]]]]><![CDATA[>");
}

/**
 * Pobiera URL do PDF faktury z Saldeo
 * Operacja SSK08 - invoice.listbyid
 */
export async function getInvoicePdfUrl(
  config: SaldeoConfig,
  saldeoInvoiceId: string
): Promise<InvoicePdfResponse> {
  try {
    // Przygotuj XML z ID faktury
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<REQUEST>
  <INVOICES>
    <INVOICE_ID>${escapeXML(saldeoInvoiceId)}</INVOICE_ID>
  </INVOICES>
</REQUEST>`;    const command = await compressAndEncodeXML(xml);    // Generuj unikalny req_id (timestamp + random)
    const reqId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Generuj sygnaturę
    const reqSig = generateRequestSignature(
      reqId,
      config.username,
      config.companyProgramId,
      command,
      config.apiToken
    );    // Przygotuj body żądania
    const body = new URLSearchParams({
      username: config.username,
      req_id: reqId,
      req_sig: reqSig,
      company_program_id: config.companyProgramId,
      command,
    });    // Wyślij żądanie POST
    const response = await fetch(`${config.apiUrl}/api/xml/3.0/invoice/listbyid`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText}`,
        rawResponse: responseText,
      };
    }

    // Parsuj odpowiedź XML - szukamy <SOURCE> oraz <NUMBER>
    const sourceMatch = responseText.match(/<SOURCE[^>]*>([^<]+)<\/SOURCE>/i);
    const numberMatch = responseText.match(/<NUMBER[^>]*>([^<]+)<\/NUMBER>/i);

    if (sourceMatch && sourceMatch[1]) {
      return {
        success: true,
        pdfUrl: sourceMatch[1].trim(),
        invoiceNumber: numberMatch ? numberMatch[1].trim() : undefined,
        rawResponse: responseText,
      };
    } else {
      return {
        success: false,
        error: "Nie znaleziono URL do PDF w odpowiedzi. Faktura może być jeszcze w trakcie generowania.",
        rawResponse: responseText,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Nieznany błąd",
    };
  }
}