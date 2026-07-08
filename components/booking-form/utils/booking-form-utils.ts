import { UseFormReturn } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BookingFormValues } from "../booking-form-types";
import type { FieldPath } from "react-hook-form";
import { steps } from "../booking-form-types";

type SelectedServicesPayload = {
  insurances?: Array<{ service_id: string; variant_id?: string; price_cents?: number | null }>;
  attractions?: Array<{
    service_id: string;
    price_cents?: number | null;
    currency?: string;
    include_in_contract?: boolean;
  }>;
  diets?: Array<{ service_id: string; variant_id?: string; price_cents?: number | null }>;
};

function mapFormServicesToSelectedServices(
  participantServices: NonNullable<BookingFormValues["participant_services"]>,
): SelectedServicesPayload {
  const selectedServices: SelectedServicesPayload = {};

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

  return selectedServices;
}

/** Buduje listę uczestników z selected_services — wspólna logika submitu i podglądu umowy. */
export function buildParticipantsWithSelectedServices(
  values: BookingFormValues,
  applicantType: "individual" | "company",
  tripSeatsTotal?: number | null,
): Array<{
  first_name?: string;
  last_name?: string;
  selected_services?: SelectedServicesPayload;
}> {
  if (applicantType === "company") {
    const services = values.participant_services || [];
    const participantsCount = (tripSeatsTotal ?? values.participants_count ?? 0) as number;
    const uniqueParticipants = new Map<
      string,
      { first_name: string; last_name: string; services: typeof services }
    >();

    services.forEach((service) => {
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

    if (uniqueParticipants.size === 0) {
      if (participantsCount > 0) {
        for (let i = 0; i < participantsCount; i++) {
          uniqueParticipants.set(`participant_${i}`, {
            first_name: `Uczestnik ${i + 1}`,
            last_name: "(dane do uzupełnienia)",
            services: [],
          });
        }
      } else {
        uniqueParticipants.set("default_participant", {
          first_name: "Uczestnik",
          last_name: "(dane do uzupełnienia)",
          services: [],
        });
      }
    }

    return Array.from(uniqueParticipants.values()).map((participantData) => {
      const selectedServices = mapFormServicesToSelectedServices(participantData.services);
      return {
        first_name: participantData.first_name,
        last_name: participantData.last_name,
        selected_services:
          Object.keys(selectedServices).length > 0 ? selectedServices : undefined,
      };
    });
  }

  return values.participants.map((p, index) => {
    const participantServices = (values.participant_services || []).filter(
      (service) => service.participant_index === index,
    );
    const selectedServices = mapFormServicesToSelectedServices(participantServices);
    return {
      first_name: p.first_name,
      last_name: p.last_name,
      selected_services:
        Object.keys(selectedServices).length > 0 ? selectedServices : undefined,
    };
  });
}

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
    contact_email: values.contact.email ?? "",
    contact_phone: values.contact.phone ?? "",
    address: (() => {
      const a = values.contact.address;
      if (!a || !(a.street?.trim() || a.city?.trim() || a.zip?.trim())) return undefined;
      if (applicantType === "individual") {
        return { street: (a.street || "").trim(), city: "", zip: "" };
      }
      return {
        street: a.street || "",
        city: a.city || "",
        zip: a.zip || "",
      };
    })(),
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
    participants: buildParticipantsWithSelectedServices(values, applicantType, tripSeatsTotal).map(
      (p, index) => {
        if (applicantType === "company") {
          return {
            first_name: p.first_name,
            last_name: p.last_name,
            pesel: undefined,
            email: undefined,
            phone: undefined,
            gender_code: undefined,
            document_type: undefined,
            document_number: undefined,
            selected_services: p.selected_services,
          };
        }
        const source = values.participants[index];
        return {
          first_name: p.first_name,
          last_name: p.last_name,
          birth_date: source?.birth_date,
          email: source?.email && source.email.trim() !== "" ? source.email : undefined,
          phone: source?.phone && source.phone.trim() !== "" ? source.phone : undefined,
          gender_code: source?.gender_code || undefined,
          document_type: source?.document_type || undefined,
          document_number:
            source?.document_number && source.document_number.trim() !== ""
              ? source.document_number
              : undefined,
          selected_services: p.selected_services,
        };
      },
    ),
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

export type StepValidationContext = {
  requiredContactFields?: { pesel?: boolean; phone?: boolean; email?: boolean; address?: boolean } | null;
  requiredParticipantFields?: { document?: boolean; gender?: boolean; phone?: boolean } | null;
  participantCount?: number;
  invoiceUseOtherData?: boolean;
  invoiceType?: "individual" | "company";
  companyHasRepresentative?: boolean;
};

const SUMMARY_CONSENT_FIELDS: FieldPath<BookingFormValues>[] = [
  "consents.agreement_consent",
  "consents.conditions_de_pl_consent",
  "consents.standard_form_consent",
  "consents.electronic_services_consent",
  "consents.rodo_info_consent",
];

function appendInvoiceFields(
  fields: FieldPath<BookingFormValues>[],
  context?: StepValidationContext,
) {
  if (!context?.invoiceUseOtherData) return;
  fields.push("invoice.type");
  if (context.invoiceType === "individual") {
    fields.push("invoice.person.first_name", "invoice.person.last_name");
  } else if (context.invoiceType === "company") {
    fields.push("invoice.company.name", "invoice.company.nip");
  }
}

function getParticipantFieldPaths(
  count: number,
  requiredParticipantFields?: { document?: boolean; gender?: boolean; phone?: boolean } | null,
): FieldPath<BookingFormValues>[] {
  const fields: FieldPath<BookingFormValues>[] = [];
  for (let i = 0; i < count; i++) {
    fields.push(
      `participants.${i}.first_name`,
      `participants.${i}.last_name`,
      `participants.${i}.birth_date`,
    );
    if (requiredParticipantFields?.document) {
      fields.push(`participants.${i}.document_type`, `participants.${i}.document_number`);
    }
    if (requiredParticipantFields?.gender) {
      fields.push(`participants.${i}.gender_code`);
    }
    if (requiredParticipantFields?.phone) {
      fields.push(`participants.${i}.phone`);
    }
  }
  return fields;
}

export function getFieldsToValidate(
  stepId: (typeof steps)[number]["id"],
  applicantType: "individual" | "company",
  context?: StepValidationContext,
): FieldPath<BookingFormValues>[] {
  const requiredContactFields = context?.requiredContactFields;

  if (stepId === "contact") {
    if (applicantType === "individual") {
      const fields: FieldPath<BookingFormValues>[] = [
        "applicant_type",
        "contact.first_name",
        "contact.last_name",
      ];
      if (requiredContactFields?.email !== false) {
        fields.push("contact.email");
      }
      if (requiredContactFields?.phone !== false) {
        fields.push("contact.phone");
      }
      if (requiredContactFields?.pesel) {
        fields.push("contact.pesel");
      }
      if (requiredContactFields?.address) {
        fields.push("contact.address.street", "contact.address.city", "contact.address.zip");
      }
      appendInvoiceFields(fields, context);
      return fields;
    }

    if (applicantType === "company") {
      const fields: FieldPath<BookingFormValues>[] = [
        "applicant_type",
        "contact.first_name",
        "contact.last_name",
        "company.name",
        "company.nip",
        "company.address.street",
        "company.address.city",
        "company.address.zip",
      ];
      if (requiredContactFields?.email !== false) {
        fields.push("contact.email");
      }
      if (requiredContactFields?.phone !== false) {
        fields.push("contact.phone");
      }
      if (context?.companyHasRepresentative) {
        fields.push("company.representative_first_name", "company.representative_last_name");
      }
      appendInvoiceFields(fields, context);
      return fields;
    }
  }

  if (stepId === "participants" && applicantType === "individual") {
    const count = Math.max(context?.participantCount ?? 1, 1);
    return getParticipantFieldPaths(count, context?.requiredParticipantFields);
  }

  if (stepId === "summary") {
    return SUMMARY_CONSENT_FIELDS;
  }

  return [];
}
