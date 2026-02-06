"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <CardTitle>Podgląd dokumentu</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg p-8 bg-white mx-auto shadow-sm max-w-[210mm] print:w-[210mm] print:min-h-[297mm]">
          <div
            dangerouslySetInnerHTML={{ __html: htmlWithData }}
            className="[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-6 [&_h1]:text-center [&_h1]:text-gray-900 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-gray-800 [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_td]:p-3 [&_td]:border [&_td]:border-gray-200 [&_td]:align-top [&_td:first-child]:font-medium [&_td:first-child]:w-[40%] [&_td:first-child]:bg-gray-50 [&_td:last-child]:w-[60%] [&_p]:my-4 [&_p]:leading-relaxed [&_ul]:my-4 [&_ul]:pl-6 [&_li]:my-2 [&_li]:leading-relaxed [&_div]:text-center"
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: '1.6',
              color: '#1f2937',
            }}
          />
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
