"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ExternalLink } from "lucide-react";

const addressSchema = z.object({
  street: z.string().min(2, "Podaj ulicę"),
  city: z.string().min(2, "Podaj miasto"),
  zip: z.string().min(4, "Podaj kod pocztowy"),
});

const companySchema = z
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
      nip: z
        .string()
        .regex(/^\d{10}$/, "NIP musi mieć dokładnie 10 cyfr")
        .optional()
        .or(z.literal("").transform(() => undefined)),
      address: addressSchema.optional(),
    })
  );

const participantSchema = z.object({
  first_name: z.string().min(2, "Podaj imię"),
  last_name: z.string().min(2, "Podaj nazwisko"),
  pesel: z
    .string()
    .regex(/^$|^\d{11}$/, "PESEL musi mieć dokładnie 11 cyfr")
    .optional()
    .or(z.literal("").transform(() => undefined)),
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

const invoicePersonSchema = z.object({
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

const invoiceSchema = z
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
          message: "Podaj NIP firmy do faktury",
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

const bookingFormSchema = z
  .object({
    applicant_type: z.enum(["individual", "company"]).optional(),
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
      email: z.string().email("Podaj poprawny e-mail"),
      phone: z.string().min(7, "Podaj telefon"),
      address: addressSchema,
    }),
    company: companySchema.optional(),
    participants: z.array(participantSchema),
    consents: z.object({
      rodo: z.literal(true),
      terms: z.literal(true),
      conditions: z.literal(true),
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
      // Dla osoby fizycznej nie waliduj company - zakończ tutaj
      return;
    }
    // Dla firmy wymagaj danych firmy
    if (value.applicant_type === "company") {
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
          message: "Podaj NIP",
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
  });

type BookingFormValues = z.infer<typeof bookingFormSchema>;

type RegistrationMode = "individual" | "company" | "both";

type TripConfig = {
  registration_mode: RegistrationMode | null;
  require_pesel: boolean | null;
  company_participants_info: string | null;
};

const steps = [
  {
    id: "contact",
    label: "Kontakt",
    description: "Dane osoby kontaktowej i adres korespondencyjny",
  },
  {
    id: "participants",
    label: "Uczestnicy",
    description: "Lista uczestników oraz dokumenty podróży",
  },
  {
    id: "summary",
    label: "Zgody i podsumowanie",
    description: "Finalne potwierdzenie, zgody oraz wysyłka",
  },
] as const;

const stepFieldGroups: Record<(typeof steps)[number]["id"], FieldPath<BookingFormValues>[]> = {
  contact: [
    "contact.first_name",
    "contact.last_name",
    "contact.email",
    "contact.phone",
    "contact.address.street",
    "contact.address.city",
    "contact.address.zip",
    "company.name",
    "company.nip",
    "company.address.street",
    "company.address.city",
    "company.address.zip",
  ],
  participants: ["participants"],
  summary: ["consents.rodo", "consents.terms", "consents.conditions"],
};

interface BookingFormProps {
  slug: string;
}

export function BookingForm({ slug }: BookingFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [maxAvailableStep, setMaxAvailableStep] = useState(0);
  const [tripConfig, setTripConfig] = useState<TripConfig | null>(null);
  const [applicantType, setApplicantType] = useState<"individual" | "company">("individual");
  const [tripPrice, setTripPrice] = useState<number | null>(null);
  const [paymentSplitFirstPercent, setPaymentSplitFirstPercent] = useState<number>(30);
  const [tripId, setTripId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<{
    rodo?: { file_name: string; url?: string };
    terms?: { file_name: string; url?: string };
    conditions?: { file_name: string; url?: string };
  }>({});

  useEffect(() => {
    const loadTripConfig = async () => {
      try {
        const supabase = createClient();
        let { data: trip, error: tripError } = await supabase
          .from("trips")
          .select("id,registration_mode,require_pesel,company_participants_info,slug,public_slug,price_cents,payment_split_enabled,payment_split_first_percent")
          .or(`slug.eq.${slug},public_slug.eq.${slug}`)
          .maybeSingle<TripConfig & { slug: string; public_slug: string | null; price_cents: number | null; payment_split_enabled: boolean | null; payment_split_first_percent: number | null; id: string }>();

        if (tripError) {
          console.error("Error loading trip config:", tripError);
          return;
        }

        if (trip) {
          setTripId(trip.id);
          setTripConfig({
            registration_mode: (trip.registration_mode as RegistrationMode) ?? "both",
            require_pesel: typeof trip.require_pesel === "boolean" ? trip.require_pesel : true,
            company_participants_info: trip.company_participants_info,
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
      }
    };

    loadTripConfig();
  }, [slug]);

  const form = useForm({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      applicant_type: "individual" as const,
      contact: {
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        address: {
          street: "",
          city: "",
          zip: "",
        },
      },
      company: {
        name: "",
        nip: "",
        address: {
          street: "",
          city: "",
          zip: "",
        },
      },
      participants: [],
      consents: {
        rodo: true,
        terms: true,
        conditions: true,
      },
      invoice: {
        use_other_data: false,
        type: undefined,
        person: undefined,
        company: undefined,
      } satisfies BookingFormValues["invoice"],
    },
    mode: "onBlur",
  });

  const { control, handleSubmit, trigger, setValue } = form;

  // Synchronizuj applicant_type w formularzu ze stanem applicantType
  useEffect(() => {
    setValue("applicant_type", applicantType);
  }, [applicantType, setValue]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "participants",
  });

  const contactWatch = useWatch({
    control,
    name: "contact",
  });

  const participantsWatch = useWatch({
    control,
    name: "participants",
  });

  const invoiceWatch = useWatch({
    control,
    name: "invoice",
  });

  const currentStep = steps[activeStepIndex];

  const canGoToStep = (nextIndex: number) => nextIndex <= maxAvailableStep || nextIndex <= activeStepIndex;

  const getFieldsToValidate = (stepId: string): FieldPath<BookingFormValues>[] => {
    const baseFields = stepFieldGroups[stepId] || [];
    
    if (stepId === "contact") {
      // Dla kroku kontaktowego, dostosuj pola do walidacji w zależności od typu zgłaszającego
      if (applicantType === "individual") {
        // Dla osoby fizycznej: wymagaj first_name i last_name, nie waliduj pól firmy
        return [
          "applicant_type",
          "contact.first_name",
          "contact.last_name",
          "contact.email",
          "contact.phone",
          "contact.address.street",
          "contact.address.city",
          "contact.address.zip",
        ];
      } else if (applicantType === "company") {
        // Dla firmy: first_name i last_name są opcjonalne, ale wymagaj pól firmy
        return [
          "applicant_type",
          "contact.email",
          "contact.phone",
          "contact.address.street",
          "contact.address.city",
          "contact.address.zip",
          "company.name",
          "company.nip",
          "company.address.street",
          "company.address.city",
          "company.address.zip",
        ];
      }
    }
    
    return baseFields;
  };

  const handleTabsChange = async (value: string) => {
    const nextIndex = steps.findIndex((step) => step.id === value);
    if (nextIndex === -1) return;

    if (nextIndex > activeStepIndex) {
      const fieldsToValidate = getFieldsToValidate(currentStep.id);
      const isValid = await trigger(fieldsToValidate);
      if (!isValid) return;
    }

    if (canGoToStep(nextIndex)) {
      setActiveStepIndex(nextIndex);
      setMaxAvailableStep((prev) => Math.max(prev, nextIndex));
    }
  };

  const goToNextStep = async () => {
    const fieldsToValidate = getFieldsToValidate(currentStep.id);
    const isValid = await trigger(fieldsToValidate);
    if (!isValid) return;
    const nextIndex = Math.min(activeStepIndex + 1, steps.length - 1);
    setActiveStepIndex(nextIndex);
    setMaxAvailableStep((prev) => Math.max(prev, nextIndex));
  };

  const goToPrevStep = () => {
    const prevIndex = Math.max(activeStepIndex - 1, 0);
    setActiveStepIndex(prevIndex);
  };

  const onSubmit = async (values: BookingFormValues) => {
    console.log("onSubmit called", values);
    console.log("onSubmit applicant_type:", values.applicant_type);
    console.log("onSubmit applicantType state:", applicantType);
    setError(null);
    setIsSubmitting(true);
    try {
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
        contact_email: values.contact.email,
        contact_phone: values.contact.phone,
        address: {
          street: values.contact.address.street,
          city: values.contact.address.city,
          zip: values.contact.address.zip,
        },
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
        participants: values.participants.map((p) => ({
          first_name: p.first_name,
          last_name: p.last_name,
          pesel: p.pesel && p.pesel.toString().trim() !== "" ? p.pesel : undefined,
          email: p.email && p.email.trim() !== "" ? p.email : undefined,
          phone: p.phone && p.phone.trim() !== "" ? p.phone : undefined,
          gender_code: p.gender_code || undefined,
          document_type: p.document_type || undefined,
          document_number:
            p.document_number && p.document_number.trim() !== ""
              ? p.document_number
              : undefined,
        })),
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
      
      // Debug: loguj odpowiedź z API
      console.log("Booking API response:", data);
      console.log("redirect_url:", data?.redirect_url);
      console.log("booking_url:", data?.booking_url);
      
      // Wyświetl komunikat sukcesu
      toast.success("Rezerwacja została potwierdzona!", {
        description: `Kod rezerwacji: ${data?.booking_ref || ""}. Przekierowywanie do płatności...`,
        duration: 2000,
      });

      // PRIORYTET 1: Jeśli jest redirect_url (Paynow), przekieruj od razu do płatności
      if (data?.redirect_url && typeof data.redirect_url === "string" && data.redirect_url.trim() !== "") {
        console.log("Redirecting to Paynow:", data.redirect_url);
        // Użyj setTimeout, aby dać czas na wyświetlenie toast
        setTimeout(() => {
          window.location.replace(data.redirect_url as string);
        }, 500);
        return;
      }

      // PRIORYTET 2: Jeśli nie ma Paynow, przekieruj do strony rezerwacji (gdzie można załączyć umowę i zapłacić)
      if (data?.booking_url && typeof data.booking_url === "string" && data.booking_url.trim() !== "") {
        console.log("Redirecting to booking page:", data.booking_url);
        // Użyj setTimeout, aby dać czas na wyświetlenie toast
        setTimeout(() => {
          window.location.replace(data.booking_url as string);
        }, 500);
        return;
      }

      // Ostatni fallback: strona wycieczki
      console.warn("No redirect_url or booking_url, falling back to trip page");
      console.warn("Response data:", JSON.stringify(data, null, 2));
      setTimeout(() => {
        router.push(`/trip/${slug}`);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd rezerwacji");
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactSummary = useMemo(
    () => ({
      first_name: contactWatch?.first_name ?? "",
      last_name: contactWatch?.last_name ?? "",
      email: contactWatch?.email ?? "",
      phone: contactWatch?.phone ?? "",
      street: contactWatch?.address?.street ?? "",
      city: contactWatch?.address?.city ?? "",
      zip: contactWatch?.address?.zip ?? "",
    }),
    [contactWatch],
  );

  const companyWatch = useWatch({
    control,
    name: "company",
  });

  const companySummary = useMemo(
    () => ({
      name: companyWatch?.name ?? "",
      nip: companyWatch?.nip ?? "",
      street: companyWatch?.address?.street ?? "",
      city: companyWatch?.address?.city ?? "",
      zip: companyWatch?.address?.zip ?? "",
    }),
    [companyWatch],
  );

  const participantsSummary = useMemo(
    () =>
      (participantsWatch ?? []).map((participant, index) => ({
        ...participant,
        key: `${participant.pesel || participant.email || index}-${index}`,
      })),
    [participantsWatch],
  );

  return (
    <>
      <Tabs value={currentStep.id} onValueChange={handleTabsChange} className="w-full">
        <TabsList className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
          {steps.map((step, index) => (
            <TabsTrigger
              key={step.id}
              value={step.id}
              className={cn("flex flex-col gap-1 text-left", index > maxAvailableStep && "cursor-not-allowed opacity-50")}
              disabled={index > maxAvailableStep + 1}
            >
              <span className="text-sm font-semibold">{index + 1}. {step.label}</span>
              <span className="text-muted-foreground text-xs">{step.description}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <Form {...form}>
          <form 
            onSubmit={handleSubmit(
              (data) => {
                console.log("Form validation passed, calling onSubmit");
                console.log("Form data applicant_type:", data.applicant_type);
                onSubmit(data);
              },
              (errors) => {
                console.log("Form validation failed:", errors);
                console.log("Form errors details:", JSON.stringify(errors, null, 2));
                
                // Zbierz wszystkie błędy walidacji i znajdź krok z błędami
                const errorMessages: string[] = [];
                const errorFields: string[] = [];
                const collectErrors = (obj: any, path: string = "") => {
                  Object.keys(obj).forEach((key) => {
                    const currentPath = path ? `${path}.${key}` : key;
                    if (obj[key]?.message) {
                      // Przekształć ścieżkę na czytelny komunikat
                      const readablePath = currentPath
                        .replace("company.address.street", "Ulica firmy")
                        .replace("company.address.city", "Miasto firmy")
                        .replace("company.address.zip", "Kod pocztowy firmy")
                        .replace("company.name", "Nazwa firmy")
                        .replace("company.nip", "NIP firmy")
                        .replace("contact.first_name", "Imię")
                        .replace("contact.last_name", "Nazwisko")
                        .replace("contact.email", "E-mail")
                        .replace("contact.phone", "Telefon")
                        .replace("contact.address.street", "Ulica")
                        .replace("contact.address.city", "Miasto")
                        .replace("contact.address.zip", "Kod pocztowy");
                      errorMessages.push(`${readablePath}: ${obj[key].message}`);
                      errorFields.push(currentPath);
                    } else if (typeof obj[key] === "object" && obj[key] !== null) {
                      collectErrors(obj[key], currentPath);
                    }
                  });
                };
                collectErrors(errors);
                
                // Znajdź krok z błędami
                let stepWithError: string | null = null;
                for (const step of steps) {
                  const stepFields = getFieldsToValidate(step.id);
                  const hasError = stepFields.some((field) => errorFields.some((errorField) => errorField.startsWith(field)));
                  if (hasError) {
                    stepWithError = step.id;
                    break;
                  }
                }
                
                // Przełącz na krok z błędami, jeśli użytkownik jest na innym kroku
                if (stepWithError && currentStep.id !== stepWithError) {
                  const stepIndex = steps.findIndex((s) => s.id === stepWithError);
                  if (stepIndex !== -1) {
                    setActiveStepIndex(stepIndex);
                    setMaxAvailableStep(Math.max(maxAvailableStep, stepIndex));
                  }
                }
                
                // Wyświetl alert z błędami
                if (errorMessages.length > 0) {
                  toast.error("Formularz zawiera błędy", {
                    description: errorMessages.slice(0, 5).join("\n") + (errorMessages.length > 5 ? `\n... i ${errorMessages.length - 5} więcej` : ""),
                    duration: 5000,
                  });
                  
                  // Przewiń do pierwszego błędu po przełączeniu kroku
                  setTimeout(() => {
                    const firstErrorField = document.querySelector('[role="alert"]');
                    if (firstErrorField) {
                      firstErrorField.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }, 300);
                }
              }
            )} 
            className="space-y-6"
          >
            <TabsContent value="contact" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Dane zgłaszającego</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {tripConfig?.registration_mode === "both" && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm">Typ zgłaszającego</h3>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={applicantType === "individual" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setApplicantType("individual");
                            setValue("applicant_type", "individual");
                          }}
                        >
                          1. Osoba fizyczna
                        </Button>
                        <Button
                          type="button"
                          variant={applicantType === "company" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setApplicantType("company");
                            setValue("applicant_type", "company");
                          }}
                        >
                          2. Firma
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={control}
                      name="contact.first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {applicantType === "company" ? "Imię osoby do kontaktu" : "Imię zgłaszającego"}
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Jan" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="contact.last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {applicantType === "company" ? "Nazwisko osoby do kontaktu" : "Nazwisko zgłaszającego"}
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Kowalski" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={control}
                      name="contact.email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail do kontaktu</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="ania@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="contact.phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefon</FormLabel>
                          <FormControl>
                            <Input placeholder="+48 600 000 000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={control}
                      name="contact.address.street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ulica i numer</FormLabel>
                          <FormControl>
                            <Input placeholder="ul. Słoneczna 12/5" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="contact.address.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Miasto</FormLabel>
                          <FormControl>
                            <Input placeholder="Warszawa" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="contact.address.zip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kod pocztowy</FormLabel>
                          <FormControl>
                            <Input placeholder="00-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {applicantType === "company" && (
                    <div className="space-y-4">
                      <h3 className="font-medium text-sm">Dane firmy</h3>
                      <p className="text-xs text-muted-foreground">
                        Wypełnij dane firmy, w imieniu której składane jest zgłoszenie. Na te dane domyślnie
                        wystawimy fakturę (chyba że zaznaczysz fakturę na inne dane).
                      </p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={control}
                          name="company.name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nazwa firmy</FormLabel>
                              <FormControl>
                                <Input placeholder="Nazwa Sp. z o.o." {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name="company.nip"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>NIP</FormLabel>
                              <FormControl>
                                <Input placeholder="1234567890" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <FormField
                          control={control}
                          name="company.address.street"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ulica i numer (firma)</FormLabel>
                              <FormControl>
                                <Input placeholder="ul. Słoneczna 12/5" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name="company.address.city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Miasto (firma)</FormLabel>
                              <FormControl>
                                <Input placeholder="Warszawa" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name="company.address.zip"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Kod pocztowy (firma)</FormLabel>
                              <FormControl>
                                <Input placeholder="00-001" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-3">
                    <h3 className="font-medium text-sm">Faktura</h3>
                    <FormField
                      control={control}
                      name="invoice.use_other_data"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                            />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="text-sm font-medium leading-none">
                              Proszę o wystawienie faktury na inne dane
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Jeśli nie zaznaczysz tej opcji, faktura zostanie wystawiona na dane zgłaszającego lub firmy
                              (zgodnie z wybranym typem zgłoszenia).
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    {invoiceWatch?.use_other_data && (
                      <div className="space-y-3 rounded-md border p-3">
                        <FormField
                          control={control}
                          name="invoice.type"
                          render={({ field }) => (
                            <FormItem className="grid gap-1">
                              <FormLabel className="text-xs">Typ danych do faktury</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Wybierz typ" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="individual">Osoba fizyczna</SelectItem>
                                  <SelectItem value="company">Firma</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {invoiceWatch?.type === "individual" && (
                          <div className="space-y-2">
                            <div className="grid gap-2 md:grid-cols-2">
                              <FormField
                                control={control}
                                name="invoice.person.first_name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Imię</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Jan" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={control}
                                name="invoice.person.last_name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Nazwisko</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Kowalski" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="grid gap-2 md:grid-cols-3">
                              <FormField
                                control={control}
                                name="invoice.person.address.street"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Ulica i numer</FormLabel>
                                    <FormControl>
                                      <Input placeholder="ul. Słoneczna 12/5" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={control}
                                name="invoice.person.address.city"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Miasto</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Warszawa" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={control}
                                name="invoice.person.address.zip"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Kod pocztowy</FormLabel>
                                    <FormControl>
                                      <Input placeholder="00-001" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        )}

                        {invoiceWatch?.type === "company" && (
                          <div className="space-y-2">
                            <div className="grid gap-2 md:grid-cols-2">
                              <FormField
                                control={control}
                                name="invoice.company.name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Nazwa firmy</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Nazwa Sp. z o.o." {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={control}
                                name="invoice.company.nip"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>NIP</FormLabel>
                                    <FormControl>
                                      <Input placeholder="1234567890" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="grid gap-2 md:grid-cols-3">
                              <FormField
                                control={control}
                                name="invoice.company.address.street"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Ulica i numer</FormLabel>
                                    <FormControl>
                                      <Input placeholder="ul. Słoneczna 12/5" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={control}
                                name="invoice.company.address.city"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Miasto</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Warszawa" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={control}
                                name="invoice.company.address.zip"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Kod pocztowy</FormLabel>
                                    <FormControl>
                                      <Input placeholder="00-001" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-3">
                  <Button variant="secondary" asChild>
                    <Link href={`/trip/${slug}`}>Anuluj</Link>
                  </Button>
                  <Button type="button" onClick={goToNextStep}>
                    Dalej
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="participants" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Uczestnicy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {applicantType === "company" ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {tripConfig?.company_participants_info ||
                          "Dane uczestników wyjazdu należy przekazać organizatorowi na adres mailowy: office@grupa-depl.com najpóźniej 7 dni przed wyjazdem. Lista powinna zawierać imię i nazwisko oraz datę urodzenia każdego uczestnika."}
                      </p>
                    </div>
                  ) : (
                    <>
                      {fields.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Brak uczestników. Dodaj co najmniej jednego uczestnika, aby wysłać rezerwację.
                        </p>
                      )}
                      {fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="rounded-xl border p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between pb-4">
                            <div className="font-medium text-sm">
                              Uczestnik {index + 1}
                            </div>
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                              >
                                Usuń
                              </Button>
                            )}
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                              control={control}
                              name={`participants.${index}.first_name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Imię</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Jan" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`participants.${index}.last_name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nazwisko</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Kowalski" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-3 mt-6">
                            <FormField
                              control={control}
                              name={`participants.${index}.gender_code`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Płeć</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Wybierz płeć" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="F">Kobieta</SelectItem>
                                      <SelectItem value="M">Mężczyzna</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`participants.${index}.phone`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Telefon</FormLabel>
                                  <FormControl>
                                    <Input placeholder="+48 600 000 000" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-[1.5fr,1fr] mt-6">
                            <FormField
                              control={control}
                              name={`participants.${index}.document_type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Dokument</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Wybierz dokument" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="ID">Dowód osobisty</SelectItem>
                                      <SelectItem value="PASSPORT">Paszport</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`participants.${index}.document_number`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Seria i numer dokumentu</FormLabel>
                                  <FormControl>
                                    <Input placeholder="ABC123456" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-3 mt-4">
                            <FormField
                              control={control}
                              name={`participants.${index}.document_issue_date`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Data wydania</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      value={field.value || ""}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`participants.${index}.document_expiry_date`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Data ważności</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      value={field.value || ""}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="default"
                        onClick={() =>
                          append({
                            first_name: "",
                            last_name: "",
                            pesel: "",
                            email: "",
                            phone: "",
                            document_type: "ID",
                            document_number: "",
                          })
                        }
                      >
                        Dodaj kolejnego uczestnika
                      </Button>
                    </>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between gap-3">
                  <Button type="button" variant="outline" onClick={goToPrevStep}>
                    Wstecz
                  </Button>
                  <Button type="button" onClick={goToNextStep}>
                    Dalej
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="summary" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Podsumowanie rezerwacji</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <section className="space-y-3">
                    <h3 className="font-medium text-sm uppercase text-muted-foreground">Dane kontaktowe</h3>
                    <div className="grid gap-2 text-sm">
                      {(contactSummary.first_name || contactSummary.last_name) && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Imię i nazwisko</span>
                          <span>{[contactSummary.first_name, contactSummary.last_name].filter(Boolean).join(" ") || "—"}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">E-mail</span>
                        <span>{contactSummary.email || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Telefon</span>
                        <span>{contactSummary.phone || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Adres</span>
                        <span>
                          {[contactSummary.street, contactSummary.zip, contactSummary.city].filter(Boolean).join(", ") || "—"}
                        </span>
                      </div>
                    </div>
                  </section>

                  {(companySummary.name || companySummary.nip) && (
                    <>
                      <Separator />
                      <section className="space-y-3">
                        <h3 className="font-medium text-sm uppercase text-muted-foreground">Dane firmy</h3>
                        <div className="grid gap-2 text-sm">
                          {companySummary.name && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">Nazwa firmy</span>
                              <span>{companySummary.name || "—"}</span>
                            </div>
                          )}
                          {companySummary.nip && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">NIP</span>
                              <span>{companySummary.nip || "—"}</span>
                            </div>
                          )}
                          {(companySummary.street || companySummary.city || companySummary.zip) && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">Adres firmy</span>
                              <span>
                                {[companySummary.street, companySummary.zip, companySummary.city].filter(Boolean).join(", ") || "—"}
                              </span>
                            </div>
                          )}
                        </div>
                      </section>
                    </>
                  )}

                  <Separator />

                  <section className="space-y-3">
                    <h3 className="font-medium text-sm uppercase text-muted-foreground">Uczestnicy</h3>
                    <div className="space-y-3 text-sm">
                      {participantsSummary.length === 0 ? (
                        <p className="text-muted-foreground">Brak uczestników.</p>
                      ) : (
                        participantsSummary.map((participant, index) => (
                          <div
                            key={participant.key}
                            className="rounded-lg border bg-muted/40 p-3"
                          >
                            <div className="flex justify-between gap-3 text-sm font-medium">
                              <span>
                                {index + 1}. {participant.first_name} {participant.last_name}
                              </span>
                              <span>{participant.document_type}</span>
                            </div>
                            <div className="grid gap-1 text-xs text-muted-foreground">
                              <span>
                                Płeć:{" "}
                                {participant.gender_code === "F"
                                  ? "Kobieta"
                                  : participant.gender_code === "M"
                                  ? "Mężczyzna"
                                  : "—"}
                              </span>
                              <span>Telefon: {participant.phone || "—"}</span>
                              <span>Dokument: {participant.document_number || "—"}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <Separator />

                  {tripPrice !== null && (
                    <>
                      <section className="space-y-3">
                        <h3 className="font-medium text-sm uppercase text-muted-foreground">Cena</h3>
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Cena za osobę</span>
                            <span className="font-semibold">
                              {((tripPrice * participantsSummary.length) / 100).toLocaleString("pl-PL", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              PLN
                            </span>
                          </div>
                          {participantsSummary.length > 1 && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                Cena za {participantsSummary.length} osoby
                              </span>
                              <span className="font-semibold">
                                {((tripPrice * participantsSummary.length) / 100).toLocaleString("pl-PL", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                PLN
                              </span>
                            </div>
                          )}
                          <Separator className="my-2" />
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Zaliczka ({paymentSplitFirstPercent}%)</span>
                            <span className="font-semibold text-lg">
                              {((tripPrice * participantsSummary.length * paymentSplitFirstPercent) / 10000).toLocaleString("pl-PL", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              PLN
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Kwota zaliczki do zapłacenia przy składaniu rezerwacji. Pozostała kwota będzie do zapłacenia przed wyjazdem.
                          </p>
                        </div>
                      </section>
                      <Separator />
                    </>
                  )}

                  <section className="space-y-4">
                    <h3 className="font-medium text-sm uppercase text-muted-foreground">Podgląd umowy</h3>
                    <p className="text-sm text-muted-foreground">
                      Po przesłaniu zgłoszenia wygenerujemy wzór umowy w formacie PDF i wyślemy go na podany e-mail.
                    </p>
                    <Card>
                      <CardContent className="p-0">
                        <div className="w-full overflow-hidden rounded-lg border">
                          <iframe
                            src="/api/pdf/preview"
                            className="h-[400px] w-full border-0 md:h-[600px]"
                            title="Podgląd umowy"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </section>

                  <Separator />

                  <section className="space-y-4">
                    <h3 className="font-medium text-sm uppercase text-muted-foreground">Zgody</h3>
                    <div className="space-y-3">
                      <FormField
                        control={control}
                        name="consents.rodo"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                              />
                            </FormControl>
                            <div className="space-y-1 flex-1">
                              <FormLabel className="text-sm font-medium leading-none">
                                Zgoda na przetwarzanie danych osobowych (RODO)
                              </FormLabel>
                              {documents.rodo && (
                                <a
                                  href={documents.rodo.url || `/api/documents/file/${documents.rodo.file_name}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Przeczytaj dokument RODO
                                </a>
                              )}
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={control}
                        name="consents.terms"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                              />
                            </FormControl>
                            <div className="space-y-1 flex-1">
                              <FormLabel className="text-sm font-medium leading-none">
                                Zapoznałem się z regulaminem i go akceptuję
                              </FormLabel>
                              {documents.terms && (
                                <a
                                  href={documents.terms.url || `/api/documents/file/${documents.terms.file_name}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Przeczytaj regulamin
                                </a>
                              )}
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={control}
                        name="consents.conditions"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                              />
                            </FormControl>
                            <div className="space-y-1 flex-1">
                              <FormLabel className="text-sm font-medium leading-none">
                                Potwierdzam znajomość warunków udziału w wycieczce
                              </FormLabel>
                              {documents.conditions && (
                                <a
                                  href={documents.conditions.url || `/api/documents/file/${documents.conditions.file_name}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Przeczytaj warunki udziału
                                </a>
                              )}
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </section>
                </CardContent>
                <CardFooter className="flex justify-between gap-3">
                  <Button type="button" variant="outline" onClick={goToPrevStep}>
                    Wstecz
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    onClick={(e) => {
                      console.log("Submit button clicked", { isSubmitting, formState: form.formState });
                    }}
                  >
                    {isSubmitting ? "Wysyłanie..." : "Potwierdź rezerwację"}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </form>
        </Form>
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Wystąpił błąd</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

