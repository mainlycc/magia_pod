import { createClient } from "@/lib/supabase/server";
import {
  buildInvoicePdfUrl,
  downloadPdf,
  type FakturowniaConfig,
} from "@/lib/fakturownia/client";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type InvoicePdfSource = {
  id: string;
  invoice_number: string;
  fakturownia_invoice_id: string | null;
  pdf_url: string | null;
  pdf_storage_path: string | null;
};

function getFakturowniaConfig(): FakturowniaConfig | null {
  const apiToken = process.env.FAKTUROWNIA_API_TOKEN || "";
  const subdomain = process.env.FAKTUROWNIA_SUBDOMAIN || "";
  if (!apiToken || !subdomain) return null;
  return { apiToken, subdomain };
}

/**
 * Pobiera bufor PDF faktury: najpierw storage, potem Fakturownia.
 */
export async function getInvoicePdfBuffer(
  supabase: SupabaseServer,
  invoice: InvoicePdfSource
): Promise<{ buffer: Buffer; filename: string } | { error: string }> {
  const safeNumber = (invoice.invoice_number || invoice.id).replace(/[\\/:*?"<>|]+/g, "-");
  const filename = `${safeNumber}.pdf`;

  if (invoice.pdf_storage_path) {
    const { data, error } = await supabase.storage
      .from("invoices")
      .download(invoice.pdf_storage_path);

    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      if (buffer.length >= 4 && buffer.subarray(0, 4).toString() === "%PDF") {
        return { buffer, filename };
      }
    }
  }

  const config = getFakturowniaConfig();
  if (!config) {
    return { error: "Brak konfiguracji Fakturownia API" };
  }

  if (!invoice.fakturownia_invoice_id) {
    return { error: "Faktura nie została jeszcze wysłana do Fakturownia" };
  }

  const pdfUrl =
    invoice.pdf_url || buildInvoicePdfUrl(config, invoice.fakturownia_invoice_id);

  try {
    const buffer = await downloadPdf(pdfUrl);
    return { buffer, filename };
  } catch (err) {
    // Odśwież pdf_url z buildInvoicePdfUrl i spróbuj ponownie
    try {
      const freshUrl = buildInvoicePdfUrl(config, invoice.fakturownia_invoice_id);
      const buffer = await downloadPdf(freshUrl);
      return { buffer, filename };
    } catch (retryErr) {
      return {
        error:
          retryErr instanceof Error
            ? retryErr.message
            : err instanceof Error
              ? err.message
              : "Nie udało się pobrać PDF",
      };
    }
  }
}
