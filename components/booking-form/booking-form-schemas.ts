import { z } from "zod";

export const addressSchema = z.object({
  street: z.string().min(2, "Podaj ulicę"),
  city: z.string().min(2, "Podaj miasto"),
  zip: z.string().min(4, "Podaj kod pocztowy"),
});

export const optionalAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
}).optional();

export const companySchema = z
  .object({
    name: z.string().optional().or(z.literal("").transform(() => undefined)),
    nip: z.string().optional().or(z.literal("").transform(() => undefined)),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        zip: z.string().optional(),
      })
      .optional(),
    has_representative: z.boolean().optional(),
    representative_first_name: z.string().optional().or(z.literal("").transform(() => undefined)),
    representative_last_name: z.string().optional().or(z.literal("").transform(() => undefined)),
  })
  .transform((val) => {
    // Jeśli address istnieje, ale wszystkie pola są puste, usuń address
    if (val?.address) {
      const hasStreet = val.address.street && val.address.street.trim() !== "";
      const hasCity = val.address.city && val.address.city.trim() !== "";
      const hasZip = val.address.zip && val.address.zip.trim() !== "";
      
      if (!hasStreet && !hasCity && !hasZip) {
        const { address, ...rest } = val;
        return rest;
      }
    }
    return val;
  })
  .pipe(
    z.object({
      name: z.string().min(2, "Podaj nazwę firmy").optional().or(z.literal("").transform(() => undefined)),
      nip: z.string().optional().or(z.literal("").transform(() => undefined)),
      address: addressSchema.optional(),
      has_representative: z.boolean().optional(),
      representative_first_name: z.string().optional().or(z.literal("").transform(() => undefined)),
      representative_last_name: z.string().optional().or(z.literal("").transform(() => undefined)),
    })
    .superRefine((value, ctx) => {
      // Jeśli has_representative jest true, wymagaj imienia i nazwiska
      if (value.has_representative === true) {
        if (!value.representative_first_name || value.representative_first_name.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Podaj imię osoby do reprezentacji",
            path: ["representative_first_name"],
          });
        }
        if (!value.representative_last_name || value.representative_last_name.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Podaj nazwisko osoby do reprezentacji",
            path: ["representative_last_name"],
          });
        }
      }
    })
  );

export const participantSchema = z.object({
  first_name: z.string().min(2, "Podaj imię"),
  last_name: z.string().min(2, "Podaj nazwisko"),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę urodzenia w formacie RRRR-MM-DD"),
  email: z.string().email("Podaj poprawny e-mail").optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().min(7, "Telefon jest zbyt krótki").optional().or(z.literal("").transform(() => undefined)),
  document_type: z.enum(["ID", "PASSPORT"]).optional(),
  document_number: z.string().min(3, "Podaj numer dokumentu").optional(),
  document_issue_date: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  document_expiry_date: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  gender_code: z.enum(["F", "M"]).optional(),
});

export const invoicePersonSchema = z.object({
  first_name: z
    .string()
    .min(2, "Podaj imię")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  last_name: z
    .string()
    .min(2, "Podaj nazwisko")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  address: addressSchema.optional(),
});

export const invoiceSchema = z
  .object({
    use_other_data: z.boolean().default(false),
    type: z.enum(["individual", "company"]).optional(),
    person: invoicePersonSchema.optional(),
    company: companySchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.use_other_data) return;

    if (!value.type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wybierz typ danych do faktury",
        path: ["type"],
      });
      return;
    }

    if (value.type === "company") {
      if (!value.company?.name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Podaj nazwę firmy do faktury",
          path: ["company", "name"],
        });
      }
      if (!value.company?.nip) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Podaj NIP/KRS firmy do faktury",
          path: ["company", "nip"],
        });
      }
    }

    if (value.type === "individual") {
      if (!value.person?.first_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Podaj imię do faktury",
          path: ["person", "first_name"],
        });
      }
      if (!value.person?.last_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Podaj nazwisko do faktury",
          path: ["person", "last_name"],
        });
      }
    }
  });

export const participantServiceSchema = z.object({
  type: z.enum(["insurance", "attraction", "diet"]),
  service_id: z.string(),
  variant_id: z.string().optional(),
  price_cents: z.number().nullable().optional(),
  currency: z.enum(["PLN", "EUR"]).optional(),
  include_in_contract: z.boolean().optional(),
  // Dla osoby fizycznej: indeks uczestnika z listy
  participant_index: z.number().optional(),
  // Dla firmy: imię i nazwisko uczestnika
  participant_first_name: z.string().optional(),
  participant_last_name: z.string().optional(),
});

export const createBookingFormSchema = (requiredFields?: {
  pesel?: boolean;
  document?: boolean;
  gender?: boolean;
  phone?: boolean;
} | null) => z
  .object({
    applicant_type: z.enum(["individual", "company"]).optional(),
    // seats_total pochodzi z konfiguracji wycieczki – używane tylko do walidacji maksymalnej liczby uczestników
    seats_total: z.number().optional(),
    contact: z.object({
      first_name: z
        .string()
        .min(2, "Podaj imię")
        .optional()
        .or(z.literal("").transform(() => undefined)),
      last_name: z
        .string()
        .min(2, "Podaj nazwisko")
        .optional()
        .or(z.literal("").transform(() => undefined)),
      pesel: z
        .string()
        .regex(/^$|^\d{11}$/, "PESEL musi mieć dokładnie 11 cyfr")
        .optional()
        .or(z.literal("").transform(() => undefined)),
      email: z.string().email("Podaj poprawny e-mail"),
      phone: z.string().min(7, "Podaj telefon"),
      address: optionalAddressSchema,
      comment: z.string().max(1000, "Komentarz jest za długi").optional().or(z.literal("").transform(() => undefined)),
    }),
    company: companySchema.optional(),
    participants: z.array(participantSchema),
    participants_count: z.number().optional(),
    participant_services: z.array(participantServiceSchema).optional(),
    consents: z.object({
      // Stare zgody - zachowane dla kompatybilności wstecznej
      rodo: z.literal(true).optional(),
      terms: z.literal(true).optional(),
      conditions: z.literal(true).optional(),
      // Nowe zgody - sekcja "Zapoznałem się i akceptuję"
      agreement_consent: z.literal(true),
      conditions_de_pl_consent: z.literal(true),
      standard_form_consent: z.literal(true),
      electronic_services_consent: z.literal(true),
      rodo_info_consent: z.literal(true),
      // Nowe zgody - sekcja "UBEZPIECZENIE"
      insurance_terms_consent: z.literal(true),
      insurance_data_consent: z.literal(true),
      insurance_other_person_consent: z.literal(true),
    }),
    // Faktura jest częścią payloadu formularza – domyślnie wyłączona, ale zawsze obecna
    invoice: invoiceSchema,
  })
  .superRefine((value, ctx) => {
    // Dla osoby fizycznej wymagaj first_name i last_name i IGNORUJ company
    if (value.applicant_type === "individual") {
      if (!value.contact.first_name || value.contact.first_name.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Podaj imię",
          path: ["contact", "first_name"],
        });
      }
      if (!value.contact.last_name || value.contact.last_name.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Podaj nazwisko",
          path: ["contact", "last_name"],
        });
      }
      // Dla osoby fizycznej nie waliduj company - przejdź dalej do walidacji uczestników
    } else if (value.applicant_type === "company") {
      // Dla firmy wymagaj danych firmy
      if (!value.company?.name || value.company.name.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Podaj nazwę firmy",
          path: ["company", "name"],
        });
      }
      if (!value.company?.nip || value.company.nip.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Podaj NIP/KRS",
          path: ["company", "nip"],
        });
      }
      if (!value.company?.address?.street || value.company.address.street.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Podaj ulicę",
          path: ["company", "address", "street"],
        });
      }
      if (!value.company?.address?.city || value.company.address.city.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Podaj miasto",
          path: ["company", "address", "city"],
        });
      }
      if (!value.company?.address?.zip || value.company.address.zip.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Podaj kod pocztowy",
          path: ["company", "address", "zip"],
        });
      }
    }

    // Walidacja pól uczestników na podstawie konfiguracji (osoba fizyczna)
    if (value.applicant_type === "individual") {
      if (requiredFields) {
        value.participants.forEach((participant, index) => {
        // Data urodzenia zawsze wymagana
        if (!participant.birth_date || participant.birth_date.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Data urodzenia jest wymagana",
            path: ["participants", index, "birth_date"],
          });
        }
        if (requiredFields.document) {
          if (!participant.document_type) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Wybierz typ dokumentu",
              path: ["participants", index, "document_type"],
            });
          }
          if (!participant.document_number || participant.document_number.trim() === "") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Podaj numer dokumentu",
              path: ["participants", index, "document_number"],
            });
          }
        }
        if (requiredFields.gender) {
          if (!participant.gender_code) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Wybierz płeć",
              path: ["participants", index, "gender_code"],
            });
          }
        }
        if (requiredFields.phone) {
          if (!participant.phone || participant.phone.trim() === "") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Podaj telefon",
              path: ["participants", index, "phone"],
            });
          } else if (participant.phone.length < 7) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Telefon jest zbyt krótki",
              path: ["participants", index, "phone"],
            });
          }
        }
      });
      }
    }
  });
