"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { templateToHtml, type AgreementTemplate } from "@/lib/agreement-template-parser";
import { replaceTripPlaceholders, replaceBookingPlaceholders, removeCompanySectionFromAgreementHtml } from "@/lib/agreement-placeholder-replacer";
import { getFirstInstallmentPercent } from "@/lib/utils/payment-calculator";
import type { TripFullData, TripContentData } from "@/contexts/trip-context";

/** Wymiary strony A4 w px przy 96 DPI — stały layout jak w PDF. */
const A4_WIDTH_PX = Math.round((210 / 25.4) * 96);
const A4_HEIGHT_PX = Math.round((297 / 25.4) * 96);

interface AgreementPreviewProps {
  template: AgreementTemplate;
  tripFullData: TripFullData | null;
  tripContentData: TripContentData | null;
  insuranceScope?: string | null;
  requiredContactFields?: {
    pesel?: boolean;
    phone?: boolean;
    email?: boolean;
    address?: boolean;
  } | null;
  requirePeselFallback?: boolean | null;
  /** Ukryj sekcję „Dane firmy” (np. gdy formularz tylko dla osoby fizycznej). */
  hideCompanySection?: boolean;
  formData?: {
    contact?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      pesel?: string;
      address?: {
        street?: string;
        city?: string;
        zip?: string;
      };
    };
    company?: {
      name?: string;
      nip?: string;
      address?: {
        street?: string;
        city?: string;
        zip?: string;
      };
      has_representative?: boolean;
      representative_first_name?: string;
      representative_last_name?: string;
    };
    participants?: Array<{
      first_name?: string;
      last_name?: string;
      selected_services?: unknown;
    }>;
    participants_count?: number;
    participant_services?: Array<{
      type?: string;
      service_type?: string;
      service_title?: string;
      price_cents?: number | null;
      currency?: string | null;
      include_in_contract?: boolean;
    }>;
    service_catalogs?: {
      form_diets?: unknown;
      form_extra_insurances?: unknown;
      form_additional_attractions?: unknown;
    };
  } | null;
}

export function AgreementPreview({
  template,
  tripFullData,
  tripContentData,
  insuranceScope,
  formData,
  requiredContactFields,
  requirePeselFallback,
  hideCompanySection,
}: AgreementPreviewProps) {
  let html = templateToHtml(template);
  if (hideCompanySection) {
    html = removeCompanySectionFromAgreementHtml(html);
  }
  // Przy danych rezerwacji: najpierw wycieczka bez cen, potem booking (cena + usługi).
  // Bez formData: pełne placeholdery wycieczki (podgląd 1 osoba).
  let htmlWithData = html;

  if (formData) {
    htmlWithData = replaceTripPlaceholders(htmlWithData, tripFullData, tripContentData, {
      insuranceScope,
      skipFinancialPlaceholders: true,
    });
    htmlWithData = replaceBookingPlaceholders(
      htmlWithData,
      formData,
      tripFullData?.price_cents || null,
      tripFullData?.start_date || null,
      null,
      {
        requiredContactFields,
        requirePeselFallback,
        insuranceScope,
        firstInstallmentPercent: tripFullData
          ? getFirstInstallmentPercent(tripFullData)
          : 30,
        paymentSchedule: tripFullData?.payment_schedule ?? null,
      },
    );
  } else {
    htmlWithData = replaceTripPlaceholders(htmlWithData, tripFullData, tripContentData, {
      insuranceScope,
    });
  }

  if (!formData && insuranceScope) {
    htmlWithData = htmlWithData.replace(/\{\{insurance_scope\}\}/g, insuranceScope);
  }

  const [pages, setPages] = useState<string[]>([htmlWithData]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [unscaledHeight, setUnscaledHeight] = useState(A4_HEIGHT_PX);
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Na wąskich ekranach skaluj całą stronę A4 proporcjonalnie (jak podgląd PDF),
  // zamiast zwężać layout i przełamywać treść. Wrapper ma dokładny rozmiar
  // po skalowaniu, żeby reszta formularza nie była ucięta / rozpychana.
  useLayoutEffect(() => {
    const viewportEl = viewportRef.current;
    const containerEl = containerRef.current;
    if (!viewportEl || !containerEl) return;

    const updateScale = () => {
      const available = viewportEl.clientWidth;
      if (available <= 0) return;
      const nextScale = Math.min(1, available / A4_WIDTH_PX);
      const nextHeight = containerEl.offsetHeight;
      setPreviewScale((prev) => (Math.abs(prev - nextScale) < 0.001 ? prev : nextScale));
      setUnscaledHeight((prev) => (Math.abs(prev - nextHeight) < 1 ? prev : nextHeight));
    };

    updateScale();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(updateScale);
    });
    ro.observe(viewportEl);
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [pages.length]);

  const handleGeneratePdf = async () => {
    try {
      setGeneratingPdf(true);
      
      // Przygotuj pełny HTML z stylami CSS dla PDF
      // Używamy tych samych fontów co w tabelach, które poprawnie obsługują polskie znaki
      const fullHtml = `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    * {
      font-family: Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif;
    }
    body {
      font-family: Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    h1 {
      font-size: 1.875rem;
      font-weight: bold;
      margin-bottom: 1.5rem;
      text-align: center;
      color: #111827;
      font-family: Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif;
    }
    h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: #1f2937;
      font-family: Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-family: Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif;
    }
    td {
      padding: 0.75rem;
      border: 1px solid #e5e7eb;
      vertical-align: top;
      font-family: Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif;
    }
    td:first-child {
      font-weight: 500;
      width: 40%;
      background-color: #f9fafb;
    }
    td:last-child {
      width: 60%;
    }
    p {
      margin: 1rem 0;
      line-height: 1.6;
      font-family: Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif;
    }
    ul {
      margin: 1rem 0;
      padding-left: 1.5rem;
      font-family: Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif;
    }
    li {
      margin: 0.5rem 0;
      line-height: 1.6;
      font-family: Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif;
    }
    pre, code {
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      font-family: Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif;
    }
    pre {
      margin: 1rem 0;
    }
    div {
      font-family: Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif;
    }
    div[style*="page-break"] {
      page-break-before: always;
      break-before: page;
    }
  </style>
</head>
<body>
  ${htmlWithData}
</body>
</html>`;

      // Wygeneruj nazwę pliku na podstawie danych wycieczki
      const tripTitle = tripFullData?.title || "umowa";
      const sanitizedTitle = tripTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const filename = `${sanitizedTitle}-umowa.pdf`;

      // Wywołaj endpoint do generowania PDF
      const response = await fetch("/api/pdf/from-html", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: fullHtml,
          filename: filename,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Nie udało się wygenerować PDF");
      }

      const result = await response.json();
      
      // Konwertuj base64 na blob
      const byteCharacters = atob(result.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const pdfBlob = new Blob([byteArray], { type: "application/pdf" });
      
      // Utwórz link do pobrania
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename || filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("PDF został wygenerowany i pobrany");
    } catch (error) {
      console.error("Błąd podczas generowania PDF:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Nie udało się wygenerować PDF"
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  useEffect(() => {
    // Podziel HTML na strony A4 używając istniejących znaczników page-break-before
    // Szukamy div z style="page-break-before: always"
    const pageBreakRegex = /<div\s+style="[^"]*page-break-before:\s*always[^"]*">/gi;
    const matches = [...htmlWithData.matchAll(pageBreakRegex)];
    
    if (matches.length === 0) {
      // Brak znaczników page-break, użyj całej treści jako jedna strona
      setPages([htmlWithData]);
      return;
    }
    
    const newPages: string[] = [];
    let lastIndex = 0;
    
    matches.forEach((match) => {
      if (match.index !== undefined) {
        // Dodaj treść przed page-break jako osobna strona
        if (match.index > lastIndex) {
          const pageContent = htmlWithData.substring(lastIndex, match.index).trim();
          if (pageContent) {
            newPages.push(pageContent);
          }
        }
        lastIndex = match.index;
      }
    });
    
    // Dodaj ostatnią stronę (od ostatniego page-break do końca)
    const lastPageContent = htmlWithData.substring(lastIndex).trim();
    if (lastPageContent) {
      newPages.push(lastPageContent);
    }
    
    // Jeśli nie udało się podzielić, użyj całej treści
    if (newPages.length === 0) {
      setPages([htmlWithData]);
    } else {
      setPages(newPages);
    }
  }, [htmlWithData]);

  const scaledWidth = A4_WIDTH_PX * previewScale;
  const scaledHeight = unscaledHeight * previewScale;

  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <CardHeader className="space-y-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Eye className="h-4 w-4 shrink-0" />
            <CardTitle className="truncate">Podgląd dokumentu</CardTitle>
          </div>
          <Button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            variant="default"
            className="w-full shrink-0 sm:w-auto"
          >
            {generatingPdf ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generowanie...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generuj PDF
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 overflow-x-hidden">
        <style dangerouslySetInnerHTML={{ __html: `
          @media screen {
            .agreement-viewport {
              width: 100%;
              max-width: 100%;
              min-width: 0;
            }
            .agreement-scale-shell {
              margin-left: auto;
              margin-right: auto;
              overflow: hidden;
            }
            .agreement-container {
              display: flex;
              flex-direction: column;
              gap: 1rem;
              width: ${A4_WIDTH_PX}px;
              max-width: none;
              transform-origin: top left;
            }
            .agreement-page {
              width: ${A4_WIDTH_PX}px;
              min-height: ${A4_HEIGHT_PX}px;
              padding: ${Math.round((20 / 25.4) * 96)}px;
              margin: 0;
              background: white;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              border: 1px solid #e5e7eb;
              box-sizing: border-box;
              overflow: visible;
              flex-shrink: 0;
              page-break-after: always;
              break-after: page;
            }
          }
          @media print {
            @page {
              size: A4;
              margin: 20mm;
            }
            .agreement-scale-shell {
              width: auto !important;
              height: auto !important;
              overflow: visible !important;
            }
            .agreement-container {
              display: block;
              width: auto;
              transform: none !important;
            }
            .agreement-page {
              width: 100%;
              min-height: 100vh;
              height: auto;
              padding: 0;
              margin: 0;
              box-shadow: none;
              border: none;
              page-break-after: always;
              break-after: page;
            }
            .agreement-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
          }
          .agreement-content {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            max-width: 100%;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .agreement-content * {
            max-width: 100%;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .agreement-content strong,
          .agreement-content b {
            font-weight: 600;
          }
          .agreement-content em,
          .agreement-content i {
            font-style: italic;
          }
          .agreement-content h1 {
            font-size: 1.875rem;
            font-weight: bold;
            margin-bottom: 1.5rem;
            text-align: center;
            color: #111827;
          }
          .agreement-content h2 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-top: 2rem;
            margin-bottom: 1rem;
            color: #1f2937;
          }
          .agreement-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
            table-layout: fixed;
          }
          .agreement-content td {
            padding: 0.75rem;
            border: 1px solid #e5e7eb;
            vertical-align: top;
          }
          .agreement-content td:first-child {
            font-weight: 500;
            width: 40%;
            background-color: #f9fafb;
          }
          .agreement-content td:last-child {
            width: 60%;
          }
          .agreement-content p {
            margin: 1rem 0;
            line-height: 1.6;
          }
          .agreement-content ul,
          .agreement-content ol {
            margin: 1rem 0;
            padding-left: 1.5rem;
            list-style-position: outside;
          }
          .agreement-content ul {
            list-style-type: disc;
          }
          .agreement-content ol {
            list-style-type: decimal;
          }
          .agreement-content li {
            margin: 0.5rem 0;
            line-height: 1.6;
          }
          .agreement-content pre,
          .agreement-content code {
            white-space: pre-wrap;
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          .agreement-content pre {
            margin: 1rem 0;
            font-family: inherit;
          }
          .agreement-content div[style*="page-break"] {
            page-break-before: always;
            break-before: page;
          }
        ` }} />
        <div className="agreement-viewport" ref={viewportRef}>
          <div
            className="agreement-scale-shell"
            style={{
              width: scaledWidth,
              height: scaledHeight,
            }}
          >
            <div
              className="agreement-container"
              ref={containerRef}
              style={{
                transform: previewScale < 1 ? `scale(${previewScale})` : undefined,
              }}
            >
              {pages.map((pageHtml, index) => (
                <div key={index} className="agreement-page">
                  <div
                    className="agreement-content"
                    dangerouslySetInnerHTML={{ __html: pageHtml }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        {!formData && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Uwaga:</strong> W podglądzie widoczne są dane z wycieczki (nazwa, data, miejsce, cena, czas trwania). 
              Placeholdery związane z klientem i rezerwacją (np. {"{{contact_full_name}}"}, {"{{reservation_number}}"} ) 
              będą automatycznie zastąpione danymi z formularza podczas generowania umowy dla konkretnej rezerwacji.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
