import { UseFormReturn } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BookingFormValues } from "../booking-form-types";
import type { FieldPath } from "react-hook-form";
import { steps } from "../booking-form-types";

export async function submitBooking(
  form: UseFormReturn<BookingFormValues>,
  values: BookingFormValues,
  applicantType: "individual" | "company",
  slug: string,
  router: ReturnType<typeof useRouter>,
  tripSeatsTotal?: number | null,
  withPayment: boolean = false
): Promise<void> {
  const base = {
    slug: slug,
    contact_first_name:
      values.contact.first_name && values.contact.first_name.trim() !== ""
        ? values.contact.first_name
        : undefined,
    contact_last_name:
      values.contact.last_name && values.contact.last_name.trim() !== ""
        ? values.contact.last_name
        : undefined,
    contact_pesel: values.contact.pesel,
    contact_email: values.contact.email,
    contact_phone: values.contact.phone,
    address: values.contact.address && (values.contact.address.street || values.contact.address.city || values.contact.address.zip)
      ? {
          street: values.contact.address.street || "",
          city: values.contact.address.city || "",
          zip: values.contact.address.zip || "",
        }
      : undefined,
    company_name:
      values.company?.name && values.company.name.trim() !== ""
        ? values.company.name
        : undefined,
    company_nip:
      values.company?.nip && values.company.nip.trim() !== ""
        ? values.company.nip
        : undefined,
    company_address: values.company?.address
      ? {
          street: values.company.address.street,
          city: values.company.address.city,
          zip: values.company.address.zip,
        }
      : undefined,
    company_representative_first_name:
      values.company?.has_representative && values.company?.representative_first_name && values.company.representative_first_name.trim() !== ""
        ? values.company.representative_first_name
        : undefined,
    company_representative_last_name:
      values.company?.has_representative && values.company?.representative_last_name && values.company.representative_last_name.trim() !== ""
        ? values.company.representative_last_name
        : undefined,
    participants: (() => {
      if (applicantType === "company") {
        // Dla firmy: utwórz uczestników na podstawie usług lub participants_count
        const services = values.participant_services || [];
        const participantsCount = (tripSeatsTotal ?? values.participants_count ?? 0) as number;
        const uniqueParticipants = new Map<string, { first_name: string; last_name: string; services: any[] }>();
        
        // Najpierw zbierz uczestników z usług
        services.forEach((service: any) => {
          if (service.participant_first_name && service.participant_last_name) {
            const key = `${service.participant_first_name}_${service.participant_last_name}`;
            if (!uniqueParticipants.has(key)) {
              uniqueParticipants.set(key, {
                first_name: service.participant_first_name,
                last_name: service.participant_last_name,
                services: [],
              });
            }
            uniqueParticipants.get(key)!.services.push(service);
          }
        });
        
        // Jeśli nie ma uczestników z usług ani z participants_count,
        // zwróć przynajmniej jednego domyślnego uczestnika aby spełnić walidację
        // (użytkownik będzie musiał uzupełnić dane po stronie backoffice)
        if (uniqueParticipants.size === 0) {
          if (participantsCount > 0) {
            // Jeśli podano liczbę uczestników, utwórz odpowiednią ilość z domyślnymi danymi
            for (let i = 0; i < participantsCount; i++) {
              const key = `participant_${i}`;
              uniqueParticipants.set(key, {
                first_name: `Uczestnik ${i + 1}`,
                last_name: "(dane do uzupełnienia)",
                services: [],
              });
            }
          } else {
            // Jeśli nie podano liczby uczestników, utwórz jednego domyślnego
            uniqueParticipants.set('default_participant', {
              first_name: "Uczestnik",
              last_name: "(dane do uzupełnienia)",
              services: [],
            });
          }
        }
        
        return Array.from(uniqueParticipants.values()).map((participantData) => {
          const selectedServices: {
            insurances?: Array<{ service_id: string; variant_id?: string; price_cents?: number | null }>;
            attractions?: Array<{ service_id: string; price_cents?: number | null; currency?: string; include_in_contract?: boolean }>;
            diets?: Array<{ service_id: string; variant_id?: string; price_cents?: number | null }>;
          } = {};
          
          participantData.services.forEach((service) => {
            if (service.type === "insurance") {
              if (!selectedServices.insurances) selectedServices.insurances = [];
              selectedServices.insurances.push({
                service_id: service.service_id,
                variant_id: service.variant_id,
                price_cents: service.price_cents ?? null,
              });
            } else if (service.type === "attraction") {
              if (!selectedServices.attractions) selectedServices.attractions = [];
              selectedServices.attractions.push({
                service_id: service.service_id,
                price_cents: service.price_cents ?? null,
                currency: service.currency || "PLN",
                include_in_contract: service.include_in_contract ?? true,
              });
            } else if (service.type === "diet") {
              if (!selectedServices.diets) selectedServices.diets = [];
              selectedServices.diets.push({
                service_id: service.service_id,
                variant_id: service.variant_id,
                price_cents: service.price_cents ?? null,
              });
            }
          });
          
          return {
            first_name: participantData.first_name,
            last_name: participantData.last_name,
            pesel: undefined,
            email: undefined,
            phone: undefined,
            gender_code: undefined,
            document_type: undefined,
            document_number: undefined,
            selected_services: Object.keys(selectedServices).length > 0 ? selectedServices : undefined,
          };
        });
      } else {
        // Dla osoby fizycznej: użyj istniejących uczestników
        return values.participants.map((p, index) => {
          // Znajdź usługi przypisane do tego uczestnika
          const participantServices = (values.participant_services || []).filter((service) => {
            return service.participant_index === index;
          });
          
          // Przekształć usługi na format selected_services
          const selectedServices: {
            insurances?: Array<{ service_id: string; variant_id?: string; price_cents?: number | null }>;
            attractions?: Array<{ service_id: string; price_cents?: number | null; currency?: string; include_in_contract?: boolean }>;
            diets?: Array<{ service_id: string; variant_id?: string; price_cents?: number | null }>;
          } = {};
          
          participantServices.forEach((service) => {
            if (service.type === "insurance") {
              if (!selectedServices.insurances) selectedServices.insurances = [];
              selectedServices.insurances.push({
                service_id: service.service_id,
                variant_id: service.variant_id,
                price_cents: service.price_cents ?? null,
              });
            } else if (service.type === "attraction") {
              if (!selectedServices.attractions) selectedServices.attractions = [];
              selectedServices.attractions.push({
                service_id: service.service_id,
                price_cents: service.price_cents ?? null,
                currency: service.currency || "PLN",
                include_in_contract: service.include_in_contract ?? true,
              });
            } else if (service.type === "diet") {
              if (!selectedServices.diets) selectedServices.diets = [];
              selectedServices.diets.push({
                service_id: service.service_id,
                variant_id: service.variant_id,
                price_cents: service.price_cents ?? null,
              });
            }
          });
          
          return {
            first_name: p.first_name,
            last_name: p.last_name,
            birth_date: p.birth_date,
            email: p.email && p.email.trim() !== "" ? p.email : undefined,
            phone: p.phone && p.phone.trim() !== "" ? p.phone : undefined,
            gender_code: p.gender_code || undefined,
            document_type: p.document_type || undefined,
            document_number:
              p.document_number && p.document_number.trim() !== ""
                ? p.document_number
                : undefined,
            selected_services: Object.keys(selectedServices).length > 0 ? selectedServices : undefined,
          };
        });
      }
    })(),
    consents: values.consents,
  };

  let invoice_type: "contact" | "company" | "custom" | undefined;
  let invoice_name: string | undefined;
  let invoice_nip: string | undefined;
  let invoice_address:
    | {
        street: string;
        city: string;
        zip: string;
      }
    | undefined;

  const invoice = values.invoice;

  if (invoice?.use_other_data) {
    invoice_type = "custom";
    if (invoice.type === "company" && invoice.company) {
      invoice_name = invoice.company.name || undefined;
      invoice_nip = invoice.company.nip || undefined;
      if (invoice.company.address) {
        invoice_address = {
          street: invoice.company.address.street,
          city: invoice.company.address.city,
          zip: invoice.company.address.zip,
        };
      }
    } else if (invoice.type === "individual" && invoice.person) {
      const first = invoice.person.first_name || "";
      const last = invoice.person.last_name || "";
      const fullName = [first, last].filter(Boolean).join(" ");
      invoice_name = fullName || undefined;
      if (invoice.person.address) {
        invoice_address = {
          street: invoice.person.address.street,
          city: invoice.person.address.city,
          zip: invoice.person.address.zip,
        };
      }
    }
  } else {
    if (applicantType === "company") {
      invoice_type = "company";
    } else {
      invoice_type = "contact";
    }
  }

  const payload = {
    ...base,
    applicant_type: applicantType,
    invoice_type,
    invoice_name,
    invoice_nip,
    invoice_address,
    with_payment: withPayment,
  };

  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    let message = data?.error ?? "Nie udało się utworzyć rezerwacji";
    
    // Jeśli są szczegóły błędu walidacji, dodaj je do komunikatu
    if (data?.details) {
      const fieldErrors: string[] = [];
      if (data.details.fieldErrors) {
        Object.entries(data.details.fieldErrors).forEach(([field, errors]) => {
          if (Array.isArray(errors) && errors.length > 0) {
            fieldErrors.push(`${field}: ${errors.join(", ")}`);
          }
        });
      }
      if (data.details.formErrors && data.details.formErrors.length > 0) {
        fieldErrors.push(...data.details.formErrors);
      }
      if (fieldErrors.length > 0) {
        message = `${message}\n${fieldErrors.join("\n")}`;
      }
    }
    
    throw new Error(message);
  }

  const data = await response.json().catch(() => null);
  
  // Wyświetl komunikat sukcesu
  if (withPayment) {
    toast.success("Rezerwacja została potwierdzona!", {
      description: `Kod rezerwacji: ${data?.booking_ref || ""}. Przekierowywanie do płatności...`,
      duration: 2000,
    });

    // PRIORYTET 1: Jeśli jest redirect_url (Paynow), przekieruj od razu do płatności
    if (data?.redirect_url && typeof data.redirect_url === "string" && data.redirect_url.trim() !== "") {
      setTimeout(() => {
        window.location.replace(data.redirect_url as string);
      }, 500);
      return;
    }

    // PRIORYTET 2: Jeśli nie ma Paynow, przekieruj do strony rezerwacji
    if (data?.booking_url && typeof data.booking_url === "string" && data.booking_url.trim() !== "") {
      setTimeout(() => {
        window.location.replace(data.booking_url as string);
      }, 500);
      return;
    }

    // Ostatni fallback: strona wycieczki
    setTimeout(() => {
      router.push(`/trip/${slug}`);
    }, 1000);
  } else {
    // Tylko rezerwacja bez płatności
    toast.success("Rezerwacja została potwierdzona!", {
      description: `Kod rezerwacji: ${data?.booking_ref || ""}. Umowa została wysłana na Twój adres e-mail.`,
      duration: 5000,
    });

    if (data?.booking_url && typeof data.booking_url === "string" && data.booking_url.trim() !== "") {
      setTimeout(() => {
        window.location.replace(data.booking_url as string);
      }, 2000);
    } else {
      setTimeout(() => {
        router.push(`/trip/${slug}`);
      }, 2000);
    }
  }
}

export function getFieldsToValidate(
  stepId: (typeof steps)[number]["id"],
  applicantType: "individual" | "company"
): FieldPath<BookingFormValues>[] {
  if (stepId === "contact") {
    if (applicantType === "individual") {
      return [
        "applicant_type",
        "contact.first_name",
        "contact.last_name",
        "contact.pesel",
        "contact.email",
        "contact.phone",
      ];
    } else if (applicantType === "company") {
      return [
        "applicant_type",
        "contact.email",
        "contact.phone",
        "company.name",
        "company.nip",
        "company.address.street",
        "company.address.city",
        "company.address.zip",
      ];
    }
  }
  
  if (stepId === "participants") {
    if (applicantType === "company") {
      return [];
    } else {
      return ["participants"];
    }
  }
  
  return [];
}
