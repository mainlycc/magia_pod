import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TripConfig, RegistrationMode } from "./booking-form-types";

export function useTripConfig(slug: string) {
  const [tripConfig, setTripConfig] = useState<TripConfig | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [tripPrice, setTripPrice] = useState<number | null>(null);
  const [paymentSplitFirstPercent, setPaymentSplitFirstPercent] = useState<number>(30);
  const [applicantType, setApplicantType] = useState<"individual" | "company">("individual");
  const [documents, setDocuments] = useState<{
    rodo?: { file_name: string; url?: string };
    terms?: { file_name: string; url?: string };
    conditions?: { file_name: string; url?: string };
  }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTripConfig = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        let { data: trip, error: tripError } = await supabase
          .from("trips")
          .select("id,registration_mode,require_pesel,form_show_additional_services,company_participants_info,slug,public_slug,price_cents,payment_split_enabled,payment_split_first_percent,form_additional_attractions,form_diets,form_extra_insurances,form_required_participant_fields,seats_total")
          .or(`slug.eq.${slug},public_slug.eq.${slug}`)
          .maybeSingle<TripConfig & { slug: string; public_slug: string | null; price_cents: number | null; payment_split_enabled: boolean | null; payment_split_first_percent: number | null; id: string; seats_total: number | null; form_additional_attractions?: unknown; form_diets?: unknown; form_extra_insurances?: unknown; form_required_participant_fields?: unknown }>();

        if (tripError) {
          console.error("Error loading trip config:", tripError);
          return;
        }

        if (trip) {
          setTripId(trip.id);
          setTripConfig({
            registration_mode: (trip.registration_mode as RegistrationMode) ?? "both",
            require_pesel: typeof trip.require_pesel === "boolean" ? trip.require_pesel : true,
            form_show_additional_services: typeof trip.form_show_additional_services === "boolean" ? trip.form_show_additional_services : false,
            company_participants_info: trip.company_participants_info,
            seats_total: typeof trip.seats_total === "number" ? trip.seats_total : null,
            additional_attractions: Array.isArray(trip.form_additional_attractions) 
              ? trip.form_additional_attractions as TripConfig["additional_attractions"]
              : [],
            diets: Array.isArray(trip.form_diets)
              ? trip.form_diets as TripConfig["diets"]
              : [],
            extra_insurances: Array.isArray(trip.form_extra_insurances)
              ? trip.form_extra_insurances as TripConfig["extra_insurances"]
              : [],
            form_required_participant_fields: trip.form_required_participant_fields &&
              typeof trip.form_required_participant_fields === "object" &&
              !Array.isArray(trip.form_required_participant_fields)
              ? trip.form_required_participant_fields as TripConfig["form_required_participant_fields"]
              : null,
          });

          if (trip.registration_mode === "company") {
            setApplicantType("company");
          } else {
            setApplicantType("individual");
          }

          // Zapisz cenę i procent zaliczki
          setTripPrice(trip.price_cents);
          const splitEnabled = trip.payment_split_enabled ?? true;
          if (splitEnabled) {
            setPaymentSplitFirstPercent(trip.payment_split_first_percent ?? 30);
          }

          // Pobierz dokumenty dla wycieczki
          try {
            const docsRes = await fetch(`/api/documents/trip/${trip.id}`);
            if (docsRes.ok) {
              const docsData = await docsRes.json();
              const docsMap: typeof documents = {};
              docsData.forEach((doc: { document_type: string; file_name: string; url?: string }) => {
                if (doc.document_type === "rodo" || doc.document_type === "terms" || doc.document_type === "conditions") {
                  docsMap[doc.document_type] = {
                    file_name: doc.file_name,
                    url: doc.url,
                  };
                }
              });
              setDocuments(docsMap);
            }
          } catch (docsErr) {
            console.error("Error loading documents:", docsErr);
            // Nie przerywamy - dokumenty są opcjonalne
          }
        }
      } catch (e) {
        console.error("Failed to load trip config", e);
      } finally {
        setLoading(false);
      }
    };

    loadTripConfig();
  }, [slug]);

  return {
    tripConfig,
    tripId,
    tripPrice,
    paymentSplitFirstPercent,
    applicantType,
    setApplicantType,
    documents,
    loading,
  };
}
