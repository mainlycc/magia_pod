"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { templateToHtml, type AgreementTemplate } from "@/lib/agreement-template-parser";
import { replaceTripPlaceholders, replaceBookingPlaceholders } from "@/lib/agreement-placeholder-replacer";
import type { TripFullData, TripContentData } from "@/contexts/trip-context";

interface AgreementPreviewProps {
  template: AgreementTemplate;
  tripFullData: TripFullData | null;
  tripContentData: TripContentData | null;
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
    };
    participants?: Array<{
      first_name?: string;
      last_name?: string;
    }>;
    participant_services?: Array<{
      service_type?: string;
      service_title?: string;
    }>;
  } | null;
}

export function AgreementPreview({ template, tripFullData, tripContentData, formData }: AgreementPreviewProps) {
  const html = templateToHtml(template);
  let htmlWithData = replaceTripPlaceholders(html, tripFullData, tripContentData);
  
  // Jeśli są dane z formularza, zastąp również placeholdery związane z klientem
  if (formData) {
    htmlWithData = replaceBookingPlaceholders(
      htmlWithData,
      formData,
      tripFullData?.price_cents || null,
      tripFullData?.start_date || null
    );
  }

  const [pages, setPages] = useState<string[]>([htmlWithData]);
  const [generatingPdf, setGeneratingPdf] = useState(false);

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <CardTitle>Podgląd dokumentu</CardTitle>
          </div>
          <Button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            variant="default"
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
      <CardContent>
        <style dangerouslySetInnerHTML={{ __html: `
          @media screen {
            .agreement-container {
              display: flex;
              flex-direction: column;
              gap: 1rem;
            }
            .agreement-page {
              width: 210mm;
              min-height: 297mm;
              padding: 20mm;
              margin: 0 auto 1rem;
              background: white;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              border: 1px solid #e5e7eb;
              page-break-after: always;
              break-after: page;
            }
          }
          @media print {
            @page {
              size: A4;
              margin: 20mm;
            }
            .agreement-container {
              display: block;
            }
            .agreement-page {
              width: 100%;
              min-height: 100vh;
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
          .agreement-content ul {
            margin: 1rem 0;
            padding-left: 1.5rem;
          }
          .agreement-content li {
            margin: 0.5rem 0;
            line-height: 1.6;
          }
          .agreement-content div[style*="page-break"] {
            page-break-before: always;
            break-before: page;
          }
        ` }} />
        <div className="agreement-container">
          {pages.map((pageHtml, index) => (
            <div key={index} className="agreement-page">
              <div
                className="agreement-content"
                dangerouslySetInnerHTML={{ __html: pageHtml }}
              />
            </div>
          ))}
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
