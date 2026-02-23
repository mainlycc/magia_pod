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
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ExternalLink, X } from "lucide-react";
import { AgreementPreview } from "@/components/agreement-preview";
import { parseHtmlToTemplate, type AgreementTemplate } from "@/lib/agreement-template-parser";
import type { TripFullData, TripContentData } from "@/contexts/trip-context";

const DEFAULT_TEMPLATE = `<div style="text-align: center; font-size: 0.875rem; line-height: 1.5; margin-bottom: 1rem;">
<p style="margin: 0;">ORGANIZATOR IMPREZY TURYSTYCZNEJ:</p>
<p style="margin: 0; font-weight: bold;">"GRUPA DE-PL" Szymon Kurkiewicz</p>
<p style="margin: 0;">ul. Szczepankowo 37, 61-311 Poznań, tel: 530 76 77 76, NIP: 6981710393, wpis do Rejestru Organizatorów Turystyki i Pośredników Turystyki Marszałka Województwa Wielkopolskiego, numer 605, Numer konta w Santander Bank: 36 1090 1274 0000 0001 3192 8094</p>
</div>

<h1>UMOWA O UDZIAŁ W IMPREZIE TURYSTYCZNEJ</h1>

<h2>Dane Zgłaszającego</h2>
<table>
  <tr>
    <td>Imię Nazwisko:</td>
    <td>{{contact_full_name}}</td>
  </tr>
  <tr>
    <td>Adres:</td>
    <td>{{contact_address}}</td>
  </tr>
  <tr>
    <td>PESEL:</td>
    <td>{{contact_pesel}}</td>
  </tr>
  <tr>
    <td>Telefon:</td>
    <td>{{contact_phone}}</td>
  </tr>
  <tr>
    <td>E-mail:</td>
    <td>{{contact_email}}</td>
  </tr>
</table>

<h2>Dane uczestników</h2>
<table>
  <tr>
    <td>Liczba uczestników:</td>
    <td>{{participants_count}}</td>
  </tr>
  <tr>
    <td>Dane uczestników:</td>
    <td>{{participants_list}}</td>
  </tr>
</table>

<h2>Informacje o imprezie turystycznej</h2>
<table>
  <tr>
    <td>Nazwa imprezy turystycznej:</td>
    <td>{{trip_title}}</td>
  </tr>
  <tr>
    <td>Numer rezerwacji:</td>
    <td>{{reservation_number}}</td>
  </tr>
  <tr>
    <td>Trasa/miejsce pobytu:</td>
    <td>Wg programu stanowiącego załącznik nr 1 do umowy</td>
  </tr>
  <tr>
    <td>Data:</td>
    <td>{{trip_start_date}}</td>
  </tr>
  <tr>
    <td>Czas trwania imprezy turystycznej:</td>
    <td>{{trip_duration}}</td>
  </tr>
  <tr>
    <td>Liczba noclegów:</td>
    <td></td>
  </tr>
  <tr>
    <td>Lokalizacja, rodzaj, kategoria obiektu zakwaterowania:</td>
    <td></td>
  </tr>
  <tr>
    <td>Rodzaj, typ pokoju:</td>
    <td></td>
  </tr>
  <tr>
    <td>Ilość, rodzaj posiłków:</td>
    <td></td>
  </tr>
  <tr>
    <td>Rodzaj kategoria środka transportu:</td>
    <td></td>
  </tr>
  <tr>
    <td>Przelot liniami na trasie:</td>
    <td></td>
  </tr>
  <tr>
    <td>Bagaż:</td>
    <td>Bagaż podręczny (wymiary) oraz bagaż rejestrowany (wymiary) o wadze do kg.</td>
  </tr>
  <tr>
    <td>Transfery:</td>
    <td></td>
  </tr>
</table>

<table>
  <tr>
    <td>Dodatkowe świadczenia:</td>
    <td></td>
  </tr>
  <tr>
    <td>Usługi dodatkowe:</td>
    <td>{{selected_services}}</td>
  </tr>
  <tr>
    <td>Zakres ubezpieczenia:</td>
    <td></td>
  </tr>
  <tr>
    <td>Cena imprezy turystycznej:</td>
    <td>{{trip_price_per_person}} zł/os. brutto na podstawie faktury VAT Marża</td>
  </tr>
  <tr>
    <td>Dodatkowe koszty:</td>
    <td></td>
  </tr>
  <tr>
    <td>Zwyczajowe napiwki, wydatki własne i inne koszty nieobjęte programem</td>
    <td></td>
  </tr>
  <tr>
    <td>Przedpłata:</td>
    <td>{{trip_deposit_amount}} zł/os. płatne do {{trip_deposit_deadline}}</td>
  </tr>
  <tr>
    <td>Turystyczny Fundusz Gwarancyjny:</td>
    <td>Wliczony w cenę imprezy turystycznej</td>
  </tr>
  <tr>
    <td>Turystyczny Fundusz Pomocowy:</td>
    <td>Wliczony w cenę imprezy turystycznej</td>
  </tr>
  <tr>
    <td>Termin zapłaty całości:</td>
    <td>Płatne do {{trip_final_payment_deadline}}</td>
  </tr>
</table>

<p>Zgłaszający oświadcza w imieniu własnym oraz uczestników imprezy turystycznej, na rzecz których podpisuje umowę, iż:</p>
<ul>
  <li>Zapoznałem się z Umową o udział w imprezie turystycznej oraz stanowiącymi integralną jej część Warunkami Udziału w Imprezach Turystycznych GRUPY DE-PL oraz zobowiązuję się do ich przestrzegania i przyjmuję je do wiadomości.</li>
  <li>Zapoznałem się ze Standardowym Formularzem Informacyjnym do umów o udział w imprezie turystycznej</li>
</ul>

<p>................................<br/>Podpis Klienta</p>

<div style="page-break-before: always; margin-top: 2rem;">
<div style="text-align: center; font-size: 0.875rem; line-height: 1.5; margin-bottom: 1rem;">
<p style="margin: 0;">ORGANIZATOR IMPREZY TURYSTYCZNEJ:</p>
<p style="margin: 0; font-weight: bold;">"GRUPA DE-PL" Szymon Kurkiewicz</p>
<p style="margin: 0;">ul. Szczepankowo 37, 61-311 Poznań, tel: 530 76 77 76, NIP: 6981710393, wpis do Rejestru Organizatorów Turystyki i Pośredników Turystyki Marszałka Województwa Wielkopolskiego, numer 605, Numer konta w Santander Bank: 36 1090 1274 0000 0001 3192 8094</p>
</div>

<h2>IMPREZY SAMOLOTOWE</h2>
<ul>
<li>W przypadku imprez samolotowych GRUPA DE-PL działa w charakterze pośrednika dokonującego w liniach lotniczych czynności faktycznych, związanych z realizacją i doręczeniem biletu zamówionego w liniach lotniczych ściśle według wskazań klienta na rzecz i w jego imieniu, a przekazywanych drogą e-mailową pod adresem: office@grupa-depl.com. Realizacja usługi, jak i rozpatrzenie procedury reklamacyjnej, podlega ogólnym warunkom linii lotniczych.</li>
<li>W przypadku imprez samolotowych, realizowanych rejsowymi liniami lotniczymi, tzw. „ Low Cost" tj. Ryanair, Wizz Air, Easy Jet, Sky Express
<ul>
<li>wszystkie rezerwacje tworzone są „na zapytanie/ do potwierdzenia", w celu zweryfikowania aktualnego stanu miejsc i ceny. Ważność oferty uzależniona jest od wybranej linii lotniczej. Każdorazowo klient zostanie poinformowany o warunkach wstępnej rezerwacji.</li>
<li>Brak możliwości zwrotu biletów</li>
<li>Konieczność podania listy uczestników z następującymi danymi: imiona, nazwiska, daty urodzenia oraz jeśli wymagane przez linię dane dokumentu podróży: dowód osobisty/paszport (seria, numer, data wydania, data ważności) każdego uczestnika przesłanej na adres mailowy: office@grupa-depl.com lub za pośrednictwem dedykowanej platformy online w terminie wskazanym w umowie</li>
<li>Koszt zmiany na liście uczestników podlega opłacenia wycenianej zgodnie z cennikiem danej linii</li>
<li>Ogólne warunki przewozu dostępne na stronie linii lotniczych - Ogólne Warunki Przewozu Pasażerów i Bagażu</li>
</ul>
</li>
</ul>
</div>`;

const addressSchema = z.object({
  street: z.string().min(2, "Podaj ulicę"),
  city: z.string().min(2, "Podaj miasto"),
  zip: z.string().min(4, "Podaj kod pocztowy"),
});

const optionalAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
}).optional();

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

const participantSchema = z.object({
  first_name: z.string().min(2, "Podaj imię"),
  last_name: z.string().min(2, "Podaj nazwisko"),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę urodzenia w formacie RRRR-MM-DD")
    .optional()
    .or(z.literal("").transform(() => undefined)),
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

const participantServiceSchema = z.object({
  type: z.enum(["insurance", "attraction", "diet"]),
  service_id: z.string(),
  variant_id: z.string().optional(),
  price_cents: z.number().nullable().optional(),
  currency: z.enum(["PLN", "EUR", "CZK", "USD", "HUF", "GBP", "DKK"]).optional(),
  include_in_contract: z.boolean().optional(),
  // Dla osoby fizycznej: indeks uczestnika z listy
  participant_index: z.number().optional(),
  // Dla firmy: imię i nazwisko uczestnika
  participant_first_name: z.string().optional(),
  participant_last_name: z.string().optional(),
});

const createBookingFormSchema = (requiredFields?: {
  pesel?: boolean;
  document?: boolean;
  gender?: boolean;
  phone?: boolean;
} | null, requirePesel?: boolean | null) => z
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
      pesel: z
        .string()
        .regex(/^$|^\d{11}$/, "PESEL musi mieć dokładnie 11 cyfr")
        .optional()
        .or(z.literal("").transform(() => undefined)),
      email: z.string().email("Podaj poprawny e-mail"),
      phone: z.string().min(7, "Podaj telefon"),
      address: optionalAddressSchema,
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
      // PESEL zawsze wymagany dla osoby fizycznej
      if (!value.contact.pesel || value.contact.pesel.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PESEL jest wymagany",
          path: ["contact", "pesel"],
        });
      } else if (!/^\d{11}$/.test(value.contact.pesel)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PESEL musi mieć dokładnie 11 cyfr",
          path: ["contact", "pesel"],
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

    // Walidacja pól uczestników na podstawie konfiguracji
    if (requiredFields && value.applicant_type !== "company") {
      value.participants.forEach((participant, index) => {
        // Data urodzenia zawsze wymagana dla osoby fizycznej
        if (!participant.birth_date || participant.birth_date.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Data urodzenia jest wymagana",
            path: ["participants", index, "birth_date"],
          });
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(participant.birth_date)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Data urodzenia musi być w formacie RRRR-MM-DD",
            path: ["participants", index, "birth_date"],
          });
        }
        if (requiredFields.pesel) {
          if (!participant.pesel || participant.pesel.trim() === "") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "PESEL jest wymagany",
              path: ["participants", index, "pesel"],
            });
          } else if (!/^\d{11}$/.test(participant.pesel)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "PESEL musi mieć dokładnie 11 cyfr",
              path: ["participants", index, "pesel"],
            });
          }
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
  });

// Typ pomocniczy dla wartości formularza - używamy createBookingFormSchema() bez parametrów dla typu
const bookingFormSchemaForType = createBookingFormSchema();
type BookingFormValues = z.infer<typeof bookingFormSchemaForType>;

type RegistrationMode = "individual" | "company" | "both";

type TripConfig = {
  registration_mode: RegistrationMode | null;
  require_pesel: boolean | null;
  form_show_additional_services: boolean | null;
  company_participants_info: string | null;
  seats_total: number | null;
  additional_attractions?: { 
    id: string; 
    title: string; 
    description: string; 
    price_cents: number | null;
    include_in_contract?: boolean;
    currency?: "PLN" | "EUR" | "CZK" | "USD" | "HUF" | "GBP" | "DKK";
  }[];
  diets?: { 
    id: string; 
    title: string; 
    description: string; 
    price_cents: number | null;
    variants?: { id: string; title: string; price_cents: number | null }[];
  }[];
  extra_insurances?: { 
    id: string; 
    title: string; 
    description: string; 
    owu_url: string;
    price_cents?: number | null;
    variants?: { id: string; title: string; price_cents: number | null }[];
  }[];
  form_required_participant_fields?: {
    pesel?: boolean;
    document?: boolean;
    gender?: boolean;
    phone?: boolean;
  } | null;
};

const steps = [
  {
    id: "contact",
    label: "Kontakt",
    description: "Dane osoby zgłaszającej i adres korespondencyjny",
  },
  {
    id: "participants",
    label: "Uczestnicy",
    description: "Lista uczestników oraz dokumenty podróży",
  },
  {
    id: "services",
    label: "Usługi dodatkowe",
    description: "Ubezpieczenia, atrakcje i diety",
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
    "company.name",
    "company.nip",
    "company.address.street",
    "company.address.city",
    "company.address.zip",
  ],
  participants: ["participants"],
  services: ["participant_services"],
  summary: [
    "consents.agreement_consent" as FieldPath<BookingFormValues>,
    "consents.conditions_de_pl_consent" as FieldPath<BookingFormValues>,
    "consents.standard_form_consent" as FieldPath<BookingFormValues>,
    "consents.electronic_services_consent" as FieldPath<BookingFormValues>,
    "consents.rodo_info_consent" as FieldPath<BookingFormValues>,
    "consents.insurance_terms_consent" as FieldPath<BookingFormValues>,
    "consents.insurance_data_consent" as FieldPath<BookingFormValues>,
    "consents.insurance_other_person_consent" as FieldPath<BookingFormValues>,
  ],
};

interface BookingFormProps {
  slug: string;
}

// Funkcja pomocnicza do formatowania błędów walidacji
const formatValidationErrors = (errors: any): string => {
  const errorMessages: string[] = [];
  const collectErrors = (obj: any, path: string = "") => {
    Object.keys(obj).forEach((key) => {
      const currentPath = path ? `${path}.${key}` : key;
      if (obj[key]?.message) {
        const readablePath = currentPath
          .replace("company.address.street", "Ulica firmy")
          .replace("company.address.city", "Miasto firmy")
          .replace("company.address.zip", "Kod pocztowy firmy")
          .replace("company.name", "Nazwa firmy")
          .replace("company.nip", "NIP/KRS firmy")
          .replace("contact.first_name", "Imię")
          .replace("contact.last_name", "Nazwisko")
          .replace("contact.email", "E-mail")
          .replace("contact.phone", "Telefon")
          .replace("contact.pesel", "PESEL")
          .replace("contact.address.street", "Ulica")
          .replace("contact.address.city", "Miasto")
          .replace("contact.address.zip", "Kod pocztowy")
          .replace(/^participants\.(\d+)\.(.+)$/, (_, index, field) => {
            const fieldNames: Record<string, string> = {
              first_name: "Imię uczestnika",
              last_name: "Nazwisko uczestnika",
              birth_date: "Data urodzenia",
              pesel: "PESEL",
              document_type: "Typ dokumentu",
              document_number: "Numer dokumentu",
              gender_code: "Płeć",
              phone: "Telefon"
            };
            return `Uczestnik ${parseInt(index) + 1} - ${fieldNames[field] || field}`;
          })
          .replace(/^consents\.(.+)$/, (_, consent) => {
            const consentNames: Record<string, string> = {
              agreement_consent: "Zgoda na umowę",
              conditions_de_pl_consent: "Zgoda na warunki",
              standard_form_consent: "Zgoda na formularz standardowy",
              electronic_services_consent: "Zgoda na usługi elektroniczne",
              rodo_info_consent: "Zgoda RODO",
              insurance_terms_consent: "Zgoda na warunki ubezpieczenia",
              insurance_data_consent: "Zgoda na przetwarzanie danych ubezpieczenia",
              insurance_other_person_consent: "Zgoda na ubezpieczenie innych osób"
            };
            return consentNames[consent] || consent;
          })
          .replace(/^invoice\.(.+)$/, (_, field) => {
            const invoiceFields: Record<string, string> = {
              type: "Typ faktury",
              "person.first_name": "Imię na fakturze",
              "person.last_name": "Nazwisko na fakturze",
              "company.name": "Nazwa firmy na fakturze",
              "company.nip": "NIP/KRS na fakturze"
            };
            return invoiceFields[field] || `Faktura - ${field}`;
          });
        errorMessages.push(`${readablePath}: ${obj[key].message}`);
      } else if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
        collectErrors(obj[key], currentPath);
      } else if (Array.isArray(obj[key])) {
        obj[key].forEach((item: any, index: number) => {
          if (item && typeof item === "object") {
            collectErrors(item, `${currentPath}.${index}`);
          }
        });
      }
    });
  };
  collectErrors(errors);
  return errorMessages.length > 0 
    ? errorMessages.slice(0, 5).join("\n") + (errorMessages.length > 5 ? `\n... i ${errorMessages.length - 5} więcej` : "")
    : "Sprawdź formularz i popraw błędy przed wysłaniem rezerwacji.";
};

export function BookingForm({ slug }: BookingFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [maxAvailableStep, setMaxAvailableStep] = useState(0);
  const [tripConfig, setTripConfig] = useState<TripConfig | null>(null);
  const [reservationInfoText, setReservationInfoText] = useState<string | null>(null);
  const [applicantType, setApplicantType] = useState<"individual" | "company">("individual");
  const [tripPrice, setTripPrice] = useState<number | null>(null);
  const [paymentSplitFirstPercent, setPaymentSplitFirstPercent] = useState<number>(30);
  const [tripId, setTripId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<{
    rodo?: { file_name: string; url?: string };
    terms?: { file_name: string; url?: string };
    conditions?: { file_name: string; url?: string };
    agreement?: { file_name: string; url?: string };
    conditions_de_pl?: { file_name: string; url?: string };
    standard_form?: { file_name: string; url?: string };
    electronic_services?: { file_name: string; url?: string };
    rodo_info?: { file_name: string; url?: string };
    insurance_terms?: { file_name: string; url?: string };
  }>({});
  const [agreementTemplateIndividual, setAgreementTemplateIndividual] = useState<AgreementTemplate | null>(null);
  const [agreementTemplateCompany, setAgreementTemplateCompany] = useState<AgreementTemplate | null>(null);
  const [tripFullData, setTripFullData] = useState<TripFullData | null>(null);
  const [tripContentData, setTripContentData] = useState<TripContentData | null>(null);
  
  // Wybierz odpowiedni szablon w zależności od typu zgłaszającego
  const agreementTemplate = applicantType === "company" && agreementTemplateCompany 
    ? agreementTemplateCompany 
    : agreementTemplateIndividual;

  useEffect(() => {
    const loadTripConfig = async () => {
      try {
        const supabase = createClient();
        let { data: trip, error: tripError } = await supabase
          .from("trips")
          .select("id,registration_mode,require_pesel,form_show_additional_services,company_participants_info,slug,public_slug,price_cents,payment_split_enabled,payment_split_first_percent,form_additional_attractions,form_diets,form_extra_insurances,form_required_participant_fields,seats_total,reservation_info_text")
          .or(`slug.eq.${slug},public_slug.eq.${slug}`)
          .maybeSingle<any>();

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

          setReservationInfoText(trip.reservation_info_text ?? null);

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
                const validTypes = [
                  "rodo", "terms", "conditions",
                  "agreement", "conditions_de_pl", "standard_form",
                  "electronic_services", "rodo_info", "insurance_terms"
                ];
                if (validTypes.includes(doc.document_type)) {
                  docsMap[doc.document_type as keyof typeof docsMap] = {
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

          // Pobierz pełne dane wycieczki dla umowy
          try {
            const { data: fullTripData } = await supabase
              .from("trips")
              .select("id,title,slug,description,start_date,end_date,price_cents,seats_total,seats_reserved,is_active,location,is_public,public_slug,registration_mode")
              .eq("id", trip.id)
              .maybeSingle();

            if (fullTripData) {
              const fullData: TripFullData = {
                id: fullTripData.id,
                title: fullTripData.title,
                slug: fullTripData.slug,
                description: fullTripData.description,
                start_date: fullTripData.start_date,
                end_date: fullTripData.end_date,
                price_cents: fullTripData.price_cents,
                seats_total: fullTripData.seats_total,
                seats_reserved: fullTripData.seats_reserved,
                is_active: fullTripData.is_active,
                category: null,
                location: fullTripData.location,
                is_public: fullTripData.is_public,
                public_slug: fullTripData.public_slug,
                registration_mode: fullTripData.registration_mode,
                require_pesel: null,
                form_show_additional_services: null,
                company_participants_info: null,
                form_additional_attractions: null,
                form_diets: null,
                form_extra_insurances: null,
                form_required_participant_fields: null,
                payment_split_enabled: null,
                payment_split_first_percent: null,
                payment_split_second_percent: null,
                payment_reminder_enabled: null,
                payment_reminder_days_before: null,
                payment_schedule: null,
              };
              setTripFullData(fullData);

              // Pobierz dane content wycieczki
              const { data: contentData } = await supabase
                .from("trips")
                .select("program_atrakcje,dodatkowe_swiadczenia,reservation_number,duration_text,additional_costs_text")
                .eq("id", trip.id)
                .maybeSingle();

              if (contentData) {
                const content: TripContentData = {
                  program_atrakcje: contentData.program_atrakcje || "",
                  dodatkowe_swiadczenia: contentData.dodatkowe_swiadczenia || "",
                  gallery_urls: [],
                  intro_text: "",
                  section_poznaj_title: "",
                  section_poznaj_description: "",
                  reservation_info_text: "",
                  trip_info_text: "",
                  baggage_text: "",
                  weather_text: "",
                  show_trip_info_card: true,
                  show_baggage_card: true,
                  show_weather_card: false,
                  show_seats_left: false,
                  included_in_price_text: "",
                  additional_costs_text: contentData.additional_costs_text || "",
                  additional_service_text: "",
                  reservation_number: contentData.reservation_number || "",
                  duration_text: contentData.duration_text || "",
                  additional_fields: [],
                  public_middle_sections: null,
                  public_right_sections: null,
                  public_hidden_middle_sections: null,
                  public_hidden_right_sections: null,
                  public_hidden_additional_sections: null,
                };
                setTripContentData(content);
              }
            }
          } catch (err) {
            console.error("Error loading trip full data:", err);
          }

          // Pobierz szablony umów
          try {
            const templatesRes = await fetch(`/api/trips/by-slug/${slug}/agreement-templates`);
            if (templatesRes.ok) {
              const templates = await templatesRes.json();
              const htmlIndividual = templates.individual || DEFAULT_TEMPLATE;
              const htmlCompany = templates.company || DEFAULT_TEMPLATE;
              setAgreementTemplateIndividual(parseHtmlToTemplate(htmlIndividual));
              setAgreementTemplateCompany(parseHtmlToTemplate(htmlCompany));
            } else {
              // Użyj domyślnego szablonu jeśli nie ma zapisanego
              setAgreementTemplateIndividual(parseHtmlToTemplate(DEFAULT_TEMPLATE));
              setAgreementTemplateCompany(parseHtmlToTemplate(DEFAULT_TEMPLATE));
            }
          } catch (err) {
            console.error("Error loading agreement template:", err);
            // Użyj domyślnego szablonu w przypadku błędu
            setAgreementTemplateIndividual(parseHtmlToTemplate(DEFAULT_TEMPLATE));
            setAgreementTemplateCompany(parseHtmlToTemplate(DEFAULT_TEMPLATE));
          }
        }
      } catch (e) {
        console.error("Failed to load trip config", e);
      }
    };

    loadTripConfig();
  }, [slug]);

  const bookingFormSchemaWithConfig = useMemo(() => {
    return createBookingFormSchema(
      tripConfig?.form_required_participant_fields ?? null,
      tripConfig?.require_pesel ?? null
    );
  }, [tripConfig?.form_required_participant_fields, tripConfig?.require_pesel]);

  const form = useForm({
    resolver: zodResolver(bookingFormSchemaWithConfig),
    defaultValues: {
      applicant_type: "individual" as const,
      contact: {
        first_name: "",
        last_name: "",
        pesel: "",
        email: "",
        phone: "",
        address: undefined,
      },
      company: {
        name: "",
        nip: "",
        address: {
          street: "",
          city: "",
          zip: "",
        },
        has_representative: false,
        representative_first_name: "",
        representative_last_name: "",
      },
      participants: [
        {
          first_name: "",
          last_name: "",
          birth_date: "",
          email: "",
          phone: "",
          document_type: "ID",
          document_number: "",
        },
      ],
      participants_count: undefined,
      participant_services: [],
      consents: {
        rodo: true,
        terms: true,
        conditions: true,
        agreement_consent: true,
        conditions_de_pl_consent: true,
        standard_form_consent: true,
        electronic_services_consent: true,
        rodo_info_consent: true,
        insurance_terms_consent: true,
        insurance_data_consent: true,
        insurance_other_person_consent: true,
      } as any,
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

  // Dla firmy: ustaw domyślną wartość participants_count na seats_total tylko jeśli nie jest jeszcze ustawione
  useEffect(() => {
    if (applicantType !== "company") return;
    if (!tripConfig?.seats_total) return;
    // Ustaw tylko jeśli participants_count nie jest jeszcze ustawione
    const currentValue = form.getValues("participants_count");
    if (currentValue === undefined || currentValue === null) {
      setValue("participants_count", tripConfig.seats_total, { shouldValidate: false, shouldDirty: false });
    }
  }, [applicantType, tripConfig?.seats_total, setValue, form]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "participants",
  });

  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
    control,
    name: "participant_services",
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

  // Sprawdź czy krok usług dodatkowych ma być widoczny (z ustawień wycieczki)
  const hasAdditionalServices = useMemo(() => {
    if (!tripConfig) return false;
    return tripConfig.form_show_additional_services === true;
  }, [tripConfig]);

  // Filtruj kroki - usuń "services" jeśli nie ma usług dodatkowych
  const visibleSteps = useMemo(() => {
    return hasAdditionalServices ? steps : steps.filter(s => s.id !== "services");
  }, [hasAdditionalServices]);

  // Mapuj activeStepIndex na visibleSteps
  const mappedStepIndex = useMemo(() => {
    const currentStepId = steps[activeStepIndex].id;
    if (!hasAdditionalServices && currentStepId === "services") {
      // Jeśli services nie jest widoczny, przejdź do summary
      return visibleSteps.findIndex(s => s.id === "summary");
    }
    return visibleSteps.findIndex(s => s.id === currentStepId);
  }, [activeStepIndex, hasAdditionalServices, visibleSteps]);

  const canGoToStep = (nextIndex: number) => nextIndex <= maxAvailableStep || nextIndex <= activeStepIndex;

  const getFieldsToValidate = (stepId: (typeof steps)[number]["id"]): FieldPath<BookingFormValues>[] => {
    const baseFields = stepFieldGroups[stepId] || [];
    
    if (stepId === "contact") {
      // Dla kroku kontaktowego, dostosuj pola do walidacji w zależności od typu zgłaszającego
      if (applicantType === "individual") {
        // Dla osoby fizycznej: wymagaj first_name, last_name i pesel, nie waliduj pól firmy
        return [
          "applicant_type",
          "contact.first_name",
          "contact.last_name",
          "contact.pesel",
          "contact.email",
          "contact.phone",
        ];
      } else if (applicantType === "company") {
        // Dla firmy: first_name i last_name są opcjonalne, nie wymagaj pesel, ale wymagaj pól firmy
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
      // Dla kroku uczestników: nie waliduj pól uczestników przy przechodzeniu do następnego kroku
      // (pełna walidacja będzie przy wysyłaniu formularza)
      // Sprawdzamy tylko, czy jest przynajmniej jeden uczestnik (dla osób fizycznych)
      if (applicantType === "individual") {
        return []; // Pusta tablica - nie walidujemy pól, tylko sprawdzamy w logice
      } else {
        return []; // Dla firm też nie walidujemy
      }
    }
    
    return baseFields;
  };

  const handleTabsChange = async (value: string) => {
    const nextIndex = steps.findIndex((step) => step.id === value);
    if (nextIndex === -1) return;

    if (nextIndex > activeStepIndex) {
      // Dla kroku uczestników: sprawdź tylko, czy jest przynajmniej jeden uczestnik (dla osób fizycznych)
      if (currentStep.id === "participants" && applicantType === "individual") {
        const participants = form.getValues("participants");
        if (!participants || participants.length === 0) {
          // Nie powinno się zdarzyć, bo zawsze jest jeden uczestnik, ale na wszelki wypadek
          return;
        }
      }
      
      const fieldsToValidate = getFieldsToValidate(currentStep.id);
      if (fieldsToValidate.length > 0) {
        const isValid = await trigger(fieldsToValidate);
        if (!isValid) return;
      }
    }

    if (canGoToStep(nextIndex)) {
      setActiveStepIndex(nextIndex);
      setMaxAvailableStep((prev) => Math.max(prev, nextIndex));
    }
  };

  const goToNextStep = async () => {
    // Dla kroku uczestników: sprawdź tylko, czy jest przynajmniej jeden uczestnik (dla osób fizycznych)
    if (currentStep.id === "participants" && applicantType === "individual") {
      const participants = form.getValues("participants");
      if (!participants || participants.length === 0) {
        // Nie powinno się zdarzyć, bo zawsze jest jeden uczestnik, ale na wszelki wypadek
        return;
      }
    }
    
    const fieldsToValidate = getFieldsToValidate(currentStep.id);
    if (fieldsToValidate.length > 0) {
      const isValid = await trigger(fieldsToValidate);
      if (!isValid) return;
    }
    
    // Znajdź następny widoczny krok
    let nextIndex = activeStepIndex + 1;
    while (nextIndex < steps.length) {
      const nextStepId = steps[nextIndex].id;
      if (nextStepId === "services" && !hasAdditionalServices) {
        nextIndex++;
        continue;
      }
      break;
    }
    
    const finalNextIndex = Math.min(nextIndex, steps.length - 1);
    setActiveStepIndex(finalNextIndex);
    setMaxAvailableStep((prev) => Math.max(prev, finalNextIndex));
  };

  const goToPrevStep = () => {
    // Znajdź poprzedni widoczny krok
    let prevIndex = activeStepIndex - 1;
    while (prevIndex >= 0) {
      const prevStepId = steps[prevIndex].id;
      if (prevStepId === "services" && !hasAdditionalServices) {
        prevIndex--;
        continue;
      }
      break;
    }
    
    const finalPrevIndex = Math.max(prevIndex, 0);
    setActiveStepIndex(finalPrevIndex);
  };

  const onSubmit = async (values: BookingFormValues, withPayment: boolean = false) => {
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
            // Użyj participants_count z formularza (który jest ustawiony na seats_total dla firmy)
            // Ale jeśli użytkownik podał mniejszą liczbę w usługach, użyj tej liczby
            const participantsCount = values.participants_count ?? 0;
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
            
            // Jeśli nie ma uczestników z usług, użyj participants_count
            // (dla firmy participants_count jest ustawiony na seats_total)
            if (uniqueParticipants.size === 0) {
              if (participantsCount > 0) {
                // Utwórz odpowiednią ilość uczestników z domyślnymi danymi
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
                birth_date: "1900-01-01", // Dla firmy birth_date - domyślna data, dane będą uzupełnione później w backoffice
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
              
              // Upewnij się, że birth_date jest w formacie YYYY-MM-DD
              let birthDate = p.birth_date || "";
              if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
                // Jeśli data jest w innym formacie, spróbuj przekonwertować
                try {
                  const date = new Date(birthDate);
                  if (!isNaN(date.getTime())) {
                    birthDate = date.toISOString().split('T')[0];
                  }
                } catch (e) {
                  // Jeśli konwersja się nie powiodła, użyj pustego stringa
                  birthDate = "";
                }
              }
              
              return {
                first_name: p.first_name,
                last_name: p.last_name,
                birth_date: birthDate,
                pesel: p.pesel && p.pesel.toString().trim() !== "" ? p.pesel : undefined,
                email: p.email && p.email.trim() !== "" ? p.email : undefined,
                phone: p.phone && p.phone.trim() !== "" ? p.phone : undefined,
                gender_code: p.gender_code || undefined,
                document_type: p.document_type || undefined,
                document_number:
                  p.document_number && p.document_number.trim() !== ""
                    ? p.document_number
                    : undefined,
                document_issue_date: p.document_issue_date && p.document_issue_date.trim() !== "" ? p.document_issue_date : undefined,
                document_expiry_date: p.document_expiry_date && p.document_expiry_date.trim() !== "" ? p.document_expiry_date : undefined,
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
      
      // Debug: loguj odpowiedź z API
      console.log("Booking API response:", data);
      console.log("redirect_url:", data?.redirect_url);
      console.log("booking_url:", data?.booking_url);
      
      // Wyświetl komunikat sukcesu
      if (withPayment) {
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
      } else {
        // Tylko rezerwacja bez płatności - pokaż komunikat sukcesu i przekieruj do strony rezerwacji
        toast.success("Rezerwacja została potwierdzona!", {
          description: `Kod rezerwacji: ${data?.booking_ref || ""}. Umowa została wysłana na Twój adres e-mail.`,
          duration: 5000,
        });

        // Przekieruj do strony rezerwacji, gdzie można zapłacić później
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
        <TabsList className={cn("grid w-full gap-2", hasAdditionalServices ? "grid-cols-1 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
          {visibleSteps.map((step, index) => {
            const originalIndex = steps.findIndex(s => s.id === step.id);
            const stepLabel = step.id === "participants" && applicantType === "company" 
              ? "Liczba uczestników" 
              : step.label;
            return (
              <TabsTrigger
                key={step.id}
                value={step.id}
                className={cn("text-left", originalIndex > maxAvailableStep && "cursor-not-allowed opacity-50")}
                disabled={originalIndex > maxAvailableStep + 1}
              >
                <span className="text-sm font-semibold">{index + 1}. {stepLabel}</span>
              </TabsTrigger>
            );
          })}
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
                        .replace("company.nip", "NIP/KRS firmy")
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
                  <CardTitle>Dane osoby zgłaszającej</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {tripConfig?.registration_mode === "both" && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm">Typ osoby zgłaszającej</h3>
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
                            Imię
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
                            Nazwisko
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Kowalski" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {applicantType === "individual" && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={control}
                        name="contact.pesel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PESEL *</FormLabel>
                            <FormControl>
                              <Input placeholder="12345678901" {...field} maxLength={11} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={control}
                      name="contact.email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
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

                  {applicantType === "company" && (
                    <div className="space-y-4">
                      <FormField
                        control={control}
                        name="company.has_representative"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                              />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel className="text-sm font-medium leading-none">
                                Dodaj osobę do reprezentacji
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      {form.watch("company.has_representative") && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField
                            control={control}
                            name="company.representative_first_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Imię osoby do reprezentacji</FormLabel>
                                <FormControl>
                                  <Input placeholder="Jan" {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name="company.representative_last_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nazwisko osoby do reprezentacji</FormLabel>
                                <FormControl>
                                  <Input placeholder="Kowalski" {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

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
                              <FormLabel>NIP/KRS</FormLabel>
                              <FormControl>
                                <Input placeholder="1234567890 (NIP) lub 123456789 (KRS)" {...field} value={field.value || ""} />
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

                  {reservationInfoText && (
                    <Alert>
                      <AlertTitle>Ważna informacja dotycząca rezerwacji</AlertTitle>
                      <AlertDescription>{reservationInfoText}</AlertDescription>
                    </Alert>
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
                              Jeśli nie zaznaczysz tej opcji, faktura zostanie wystawiona na dane osoby zgłaszającej lub firmy.
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
                                    <FormLabel>NIP/KRS</FormLabel>
                                    <FormControl>
                                      <Input placeholder="1234567890 (NIP) lub 123456789 (KRS)" {...field} value={field.value || ""} />
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
                  <CardTitle>{applicantType === "company" ? "Liczba uczestników" : "Uczestnicy"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {applicantType === "company" ? (
                    <div className="space-y-3">
                      <div className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-muted-foreground">Liczba uczestników</span>
                          <span className="text-sm font-medium">
                            {tripConfig?.seats_total ?? "—"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Liczba uczestników jest automatycznie ustawiona na maksymalną liczbę miejsc i nie można jej zmienić.
                        </p>
                      </div>
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
                                  <FormLabel>Imię *</FormLabel>
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
                                  <FormLabel>Nazwisko *</FormLabel>
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
                              // Cast potrzebny, bo FieldPath<BookingFormValues> nie zna jeszcze zagnieżdżonego klucza birth_date
                              name={`participants.${index}.birth_date` as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Data urodzenia *</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      value={(field.value as string) || ""}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            {tripConfig?.form_required_participant_fields?.gender && (
                              <FormField
                                control={control}
                                name={`participants.${index}.gender_code`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Płeć{tripConfig?.form_required_participant_fields?.gender ? " *" : ""}
                                    </FormLabel>
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
                            )}
                            {tripConfig?.form_required_participant_fields?.phone && (
                              <FormField
                                control={control}
                                name={`participants.${index}.phone`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Telefon{tripConfig?.form_required_participant_fields?.phone ? " *" : ""}
                                    </FormLabel>
                                    <FormControl>
                                      <Input placeholder="+48 600 000 000" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                          </div>

                          {tripConfig?.form_required_participant_fields?.document && (
                            <>
                              <div className="grid gap-4 md:grid-cols-[1.5fr,1fr] mt-6">
                                <FormField
                                  control={control}
                                  name={`participants.${index}.document_type`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Dokument{tripConfig?.form_required_participant_fields?.document ? " *" : ""}
                                      </FormLabel>
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
                                      <FormLabel>
                                        Seria i numer dokumentu{tripConfig?.form_required_participant_fields?.document ? " *" : ""}
                                      </FormLabel>
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
                            </>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="default"
                        onClick={() => {
                          const currentCount = fields.length;
                          const maxSeats = tripConfig?.seats_total ?? null;
                          if (maxSeats && currentCount >= maxSeats) {
                            // Blokada dodania większej liczby uczestników niż liczba miejsc w ofercie
                            return;
                          }
                          append({
                            first_name: "",
                            last_name: "",
                            // birth_date jest wymagane w schemacie, ale inicjalnie puste – użytkownik musi je uzupełnić
                            birth_date: "" as any,
                            email: "",
                            phone: "",
                            document_type: "ID",
                            document_number: "",
                          } as any);
                        }}
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

            {hasAdditionalServices && (
              <TabsContent value="services" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Usługi dodatkowe</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {applicantType === "individual" && fields.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Dodaj uczestników, aby wybrać usługi dodatkowe.
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {/* Diety */}
                        {tripConfig?.diets && tripConfig.diets.filter((d: any) => d.enabled !== false).length > 0 && (
                          <div className="space-y-4">
                            <Label className="text-sm font-semibold">Diety</Label>
                            {tripConfig.diets.filter((d: any) => d.enabled !== false).map((diet) => {
                              const allServices = form.watch("participant_services") || [];
                              const dietServices = allServices.filter((s: any) => s.type === "diet" && s.service_id === diet.id);
                              
                              return (
                                <div key={diet.id} className="border rounded-lg p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <Label className="text-sm font-medium">{diet.title}</Label>
                                      {diet.price_cents !== null && diet.price_cents > 0 && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                          (+{((diet.price_cents || 0) / 100).toFixed(2)} PLN)
                                        </span>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const currentServices = form.getValues("participant_services") || [];
                                        const newService: any = {
                                          type: "diet",
                                          service_id: diet.id,
                                          price_cents: diet.price_cents ?? null,
                                          currency: "PLN",
                                        };
                                        
                                        if (applicantType === "individual") {
                                          // Dla osoby fizycznej: ustaw pierwszy dostępny indeks uczestnika
                                          if (fields.length > 0) {
                                            newService.participant_index = 0;
                                          }
                                        } else {
                                          // Dla firmy: zostaw puste, użytkownik wpisze imię i nazwisko
                                        }
                                        
                                        form.setValue("participant_services", [...currentServices, newService]);
                                      }}
                                    >
                                      Dodaj dietę
                                    </Button>
                                  </div>
                                  
                                  {dietServices.map((service: any, serviceIndex: number) => {
                                    // Znajdź indeks usługi w tablicy wszystkich usług
                                    const serviceArrayIndex = allServices.findIndex((s: any, idx: number) => {
                                      if (s.type !== "diet" || s.service_id !== diet.id) return false;
                                      if (applicantType === "individual") {
                                        return s.participant_index === service.participant_index;
                                      } else {
                                        return s.participant_first_name === service.participant_first_name && 
                                               s.participant_last_name === service.participant_last_name;
                                      }
                                    });
                                    
                                    if (serviceArrayIndex === -1) return null;
                                    
                                    return (
                                      <div key={serviceIndex} className="border rounded p-3 space-y-2 bg-muted/30">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 space-y-2">
                                            {applicantType === "individual" ? (
                                              <FormField
                                                control={control}
                                                name={`participant_services.${serviceArrayIndex}.participant_index`}
                                                render={({ field: participantField }) => (
                                                  <div className="space-y-1">
                                                    <Label className="text-xs">Uczestnik</Label>
                                                    <Select
                                                      value={participantField.value?.toString() || ""}
                                                      onValueChange={(value) => {
                                                        participantField.onChange(parseInt(value, 10));
                                                      }}
                                                    >
                                                      <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Wybierz uczestnika" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {fields.map((field, idx) => {
                                                          const p = participantsWatch?.[idx];
                                                          const name = p 
                                                            ? `${p.first_name} ${p.last_name}`.trim() 
                                                            : `Uczestnik ${idx + 1}`;
                                                          return (
                                                            <SelectItem key={idx} value={idx.toString()}>
                                                              {name}
                                                            </SelectItem>
                                                          );
                                                        })}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                )}
                                              />
                                            ) : (
                                              <div className="grid grid-cols-2 gap-2">
                                                <FormField
                                                  control={control}
                                                  name={`participant_services.${serviceArrayIndex}.participant_first_name`}
                                                  render={({ field: firstNameField }) => (
                                                    <div className="space-y-1">
                                                      <Label className="text-xs">Imię uczestnika</Label>
                                                      <Input
                                                        {...firstNameField}
                                                        className="h-8 text-xs"
                                                        placeholder="Imię"
                                                      />
                                                    </div>
                                                  )}
                                                />
                                                <FormField
                                                  control={control}
                                                  name={`participant_services.${serviceArrayIndex}.participant_last_name`}
                                                  render={({ field: lastNameField }) => (
                                                    <div className="space-y-1">
                                                      <Label className="text-xs">Nazwisko uczestnika</Label>
                                                      <Input
                                                        {...lastNameField}
                                                        className="h-8 text-xs"
                                                        placeholder="Nazwisko"
                                                      />
                                                    </div>
                                                  )}
                                                />
                                              </div>
                                            )}
                                            
                                            {diet.variants && diet.variants.length > 0 && (
                                              <FormField
                                                control={control}
                                                name={`participant_services.${serviceArrayIndex}.variant_id`}
                                                render={({ field: variantField }) => (
                                                  <div className="space-y-1">
                                                    <Label className="text-xs">Wariant diety</Label>
                                                    <Select
                                                      value={variantField.value || ""}
                                                      onValueChange={(value) => {
                                                        variantField.onChange(value);
                                                        // Aktualizuj cenę na podstawie wariantu
                                                        const selectedVariant = diet.variants?.find(v => v.id === value);
                                                        const currentServices = form.getValues("participant_services") || [];
                                                        const updatedServices = currentServices.map((s: any, idx: number) => {
                                                          if (idx === serviceArrayIndex) {
                                                            return {
                                                              ...s,
                                                              variant_id: value,
                                                              price_cents: selectedVariant?.price_cents ?? null,
                                                            };
                                                          }
                                                          return s;
                                                        });
                                                        form.setValue("participant_services", updatedServices);
                                                      }}
                                                    >
                                                      <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Wybierz wariant" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {diet.variants?.map((variant) => (
                                                          <SelectItem key={variant.id} value={variant.id}>
                                                            {variant.title}
                                                            {variant.price_cents !== null && variant.price_cents > 0 
                                                              ? ` (+${((variant.price_cents || 0) / 100).toFixed(2)} PLN)`
                                                              : " (bezpłatna)"
                                                            }
                                                          </SelectItem>
                                                        )) || []}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                )}
                                              />
                                            )}
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const currentServices = form.getValues("participant_services") || [];
                                              const updatedServices = currentServices.filter((_: any, idx: number) => idx !== serviceArrayIndex);
                                              form.setValue("participant_services", updatedServices);
                                            }}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Ubezpieczenia */}
                        {tripConfig?.extra_insurances && tripConfig.extra_insurances.filter((i: any) => i.enabled !== false).length > 0 && (
                          <div className="space-y-4">
                            <Label className="text-sm font-semibold">Ubezpieczenia dodatkowe</Label>
                            {tripConfig.extra_insurances.filter((i: any) => i.enabled !== false).map((insurance) => {
                              const allServices = form.watch("participant_services") || [];
                              const insuranceServices = allServices.filter((s: any) => s.type === "insurance" && s.service_id === insurance.id);
                              
                              return (
                                <div key={insurance.id} className="border rounded-lg p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <Label className="text-sm font-medium">{insurance.title}</Label>
                                        {(!insurance.variants || insurance.variants.length === 0) && insurance.price_cents !== null && insurance.price_cents !== undefined && insurance.price_cents > 0 && (
                                          <span className="text-xs text-muted-foreground">
                                            (+{((insurance.price_cents || 0) / 100).toFixed(2)} PLN)
                                          </span>
                                        )}
                                      </div>
                                      {insurance.description && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {insurance.description}
                                        </p>
                                      )}
                                      {insurance.owu_url && (
                                        <a
                                          href={insurance.owu_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          OWU
                                        </a>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const currentServices = form.getValues("participant_services") || [];
                                        const newService: any = {
                                          type: "insurance",
                                          service_id: insurance.id,
                                          price_cents: null,
                                          currency: "PLN",
                                        };
                                        
                                        if (insurance.variants && insurance.variants.length > 0) {
                                          newService.variant_id = insurance.variants[0].id;
                                          newService.price_cents = insurance.variants[0].price_cents ?? null;
                                        } else {
                                          // Jeśli nie ma wariantów, użyj głównej ceny ubezpieczenia
                                          newService.price_cents = insurance.price_cents ?? null;
                                        }
                                        
                                        if (applicantType === "individual") {
                                          if (fields.length > 0) {
                                            newService.participant_index = 0;
                                          }
                                        }
                                        
                                        form.setValue("participant_services", [...currentServices, newService]);
                                      }}
                                    >
                                      Dodaj ubezpieczenie
                                    </Button>
                                  </div>
                                  
                                  {insuranceServices.map((service: any, serviceIndex: number) => {
                                    // Znajdź indeks usługi w tablicy wszystkich usług
                                    const serviceArrayIndex = allServices.findIndex((s: any, idx: number) => {
                                      if (s.type !== "insurance" || s.service_id !== insurance.id) return false;
                                      if (applicantType === "individual") {
                                        return s.participant_index === service.participant_index;
                                      } else {
                                        return s.participant_first_name === service.participant_first_name && 
                                               s.participant_last_name === service.participant_last_name;
                                      }
                                    });
                                    
                                    if (serviceArrayIndex === -1) return null;
                                    
                                    return (
                                      <div key={serviceIndex} className="border rounded p-3 space-y-2 bg-muted/30">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 space-y-2">
                                            {applicantType === "individual" ? (
                                              <FormField
                                                control={control}
                                                name={`participant_services.${serviceArrayIndex}.participant_index`}
                                                render={({ field: participantField }) => (
                                                  <div className="space-y-1">
                                                    <Label className="text-xs">Uczestnik</Label>
                                                    <Select
                                                      value={participantField.value?.toString() || ""}
                                                      onValueChange={(value) => {
                                                        participantField.onChange(parseInt(value, 10));
                                                      }}
                                                    >
                                                      <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Wybierz uczestnika" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {fields.map((field, idx) => {
                                                          const p = participantsWatch?.[idx];
                                                          const name = p 
                                                            ? `${p.first_name} ${p.last_name}`.trim() 
                                                            : `Uczestnik ${idx + 1}`;
                                                          return (
                                                            <SelectItem key={idx} value={idx.toString()}>
                                                              {name}
                                                            </SelectItem>
                                                          );
                                                        })}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                )}
                                              />
                                            ) : (
                                              <div className="grid grid-cols-2 gap-2">
                                                <FormField
                                                  control={control}
                                                  name={`participant_services.${serviceArrayIndex}.participant_first_name`}
                                                  render={({ field: firstNameField }) => (
                                                    <div className="space-y-1">
                                                      <Label className="text-xs">Imię uczestnika</Label>
                                                      <Input
                                                        {...firstNameField}
                                                        className="h-8 text-xs"
                                                        placeholder="Imię"
                                                      />
                                                    </div>
                                                  )}
                                                />
                                                <FormField
                                                  control={control}
                                                  name={`participant_services.${serviceArrayIndex}.participant_last_name`}
                                                  render={({ field: lastNameField }) => (
                                                    <div className="space-y-1">
                                                      <Label className="text-xs">Nazwisko uczestnika</Label>
                                                      <Input
                                                        {...lastNameField}
                                                        className="h-8 text-xs"
                                                        placeholder="Nazwisko"
                                                      />
                                                    </div>
                                                  )}
                                                />
                                              </div>
                                            )}
                                            
                                            {insurance.variants && insurance.variants.length > 0 && (
                                              <FormField
                                                control={control}
                                                name={`participant_services.${serviceArrayIndex}.variant_id`}
                                                render={({ field: variantField }) => (
                                                  <div className="space-y-1">
                                                    <Label className="text-xs">Wariant ubezpieczenia</Label>
                                                    <Select
                                                      value={variantField.value || ""}
                                                      onValueChange={(value) => {
                                                        variantField.onChange(value);
                                                        const selectedVariant = insurance.variants?.find(v => v.id === value);
                                                        const currentServices = form.getValues("participant_services") || [];
                                                        const updatedServices = currentServices.map((s: any, idx: number) => {
                                                          if (idx === serviceArrayIndex) {
                                                            return {
                                                              ...s,
                                                              variant_id: value,
                                                              price_cents: selectedVariant?.price_cents ?? null,
                                                            };
                                                          }
                                                          return s;
                                                        });
                                                        form.setValue("participant_services", updatedServices);
                                                      }}
                                                    >
                                                      <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Wybierz wariant" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {insurance.variants?.map((variant) => (
                                                          <SelectItem key={variant.id} value={variant.id}>
                                                            {variant.title}
                                                            {variant.price_cents !== null && variant.price_cents > 0
                                                              ? ` (+${((variant.price_cents || 0) / 100).toFixed(2)} PLN)`
                                                              : ""
                                                            }
                                                          </SelectItem>
                                                        )) || []}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                )}
                                              />
                                            )}
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const currentServices = form.getValues("participant_services") || [];
                                              const updatedServices = currentServices.filter((_: any, idx: number) => idx !== serviceArrayIndex);
                                              form.setValue("participant_services", updatedServices);
                                            }}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Atrakcje dodatkowe */}
                        {tripConfig?.additional_attractions && tripConfig.additional_attractions.filter((a: any) => a.enabled !== false).length > 0 && (
                          <div className="space-y-4">
                            <Label className="text-sm font-semibold">Atrakcje dodatkowe</Label>
                            {tripConfig.additional_attractions.filter((a: any) => a.enabled !== false).map((attraction) => {
                              const allServices = form.watch("participant_services") || [];
                              const attractionServices = allServices.filter((s: any) => s.type === "attraction" && s.service_id === attraction.id);
                              
                              return (
                                <div key={attraction.id} className="border rounded-lg p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <Label className="text-sm font-medium">{attraction.title}</Label>
                                      {attraction.description && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {attraction.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2 mt-1">
                                        {attraction.price_cents !== null && attraction.price_cents > 0 && (
                                          <span className="text-xs font-medium">
                                            {(attraction.price_cents / 100).toFixed(2)} {attraction.currency || "PLN"}
                                          </span>
                                        )}
                                        {attraction.currency && attraction.currency !== "PLN" && (
                                          <span className="text-xs text-muted-foreground">
                                            (nie wlicza się do umowy)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const currentServices = form.getValues("participant_services") || [];
                                        const newService: any = {
                                          type: "attraction",
                                          service_id: attraction.id,
                                          price_cents: attraction.price_cents ?? null,
                                          currency: attraction.currency || "PLN",
                                          include_in_contract: attraction.include_in_contract ?? true,
                                        };
                                        
                                        if (applicantType === "individual") {
                                          if (fields.length > 0) {
                                            newService.participant_index = 0;
                                          }
                                        }
                                        
                                        form.setValue("participant_services", [...currentServices, newService]);
                                      }}
                                    >
                                      Dodaj atrakcję
                                    </Button>
                                  </div>
                                  
                                  {attractionServices.map((service: any, serviceIndex: number) => {
                                    // Znajdź indeks usługi w tablicy wszystkich usług
                                    const serviceArrayIndex = allServices.findIndex((s: any, idx: number) => {
                                      if (s.type !== "attraction" || s.service_id !== attraction.id) return false;
                                      if (applicantType === "individual") {
                                        return s.participant_index === service.participant_index;
                                      } else {
                                        return s.participant_first_name === service.participant_first_name && 
                                               s.participant_last_name === service.participant_last_name;
                                      }
                                    });
                                    
                                    if (serviceArrayIndex === -1) return null;
                                    
                                    return (
                                      <div key={serviceIndex} className="border rounded p-3 space-y-2 bg-muted/30">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1">
                                            {applicantType === "individual" ? (
                                              <FormField
                                                control={control}
                                                name={`participant_services.${serviceArrayIndex}.participant_index`}
                                                render={({ field: participantField }) => (
                                                  <div className="space-y-1">
                                                    <Label className="text-xs">Uczestnik</Label>
                                                    <Select
                                                      value={participantField.value?.toString() || ""}
                                                      onValueChange={(value) => {
                                                        participantField.onChange(parseInt(value, 10));
                                                      }}
                                                    >
                                                      <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Wybierz uczestnika" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {fields.map((field, idx) => {
                                                          const p = participantsWatch?.[idx];
                                                          const name = p 
                                                            ? `${p.first_name} ${p.last_name}`.trim() 
                                                            : `Uczestnik ${idx + 1}`;
                                                          return (
                                                            <SelectItem key={idx} value={idx.toString()}>
                                                              {name}
                                                            </SelectItem>
                                                          );
                                                        })}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                )}
                                              />
                                            ) : (
                                              <div className="grid grid-cols-2 gap-2">
                                                <FormField
                                                  control={control}
                                                  name={`participant_services.${serviceArrayIndex}.participant_first_name`}
                                                  render={({ field: firstNameField }) => (
                                                    <div className="space-y-1">
                                                      <Label className="text-xs">Imię uczestnika</Label>
                                                      <Input
                                                        {...firstNameField}
                                                        className="h-8 text-xs"
                                                        placeholder="Imię"
                                                      />
                                                    </div>
                                                  )}
                                                />
                                                <FormField
                                                  control={control}
                                                  name={`participant_services.${serviceArrayIndex}.participant_last_name`}
                                                  render={({ field: lastNameField }) => (
                                                    <div className="space-y-1">
                                                      <Label className="text-xs">Nazwisko uczestnika</Label>
                                                      <Input
                                                        {...lastNameField}
                                                        className="h-8 text-xs"
                                                        placeholder="Nazwisko"
                                                      />
                                                    </div>
                                                  )}
                                                />
                                              </div>
                                            )}
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const currentServices = form.getValues("participant_services") || [];
                                              const updatedServices = currentServices.filter((_: any, idx: number) => idx !== serviceArrayIndex);
                                              form.setValue("participant_services", updatedServices);
                                            }}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
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
            )}

            <TabsContent value="summary" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Podsumowanie rezerwacji</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {applicantType === "company" ? (
                    <>
                      {/* Dla firm: najpierw DANE FIRMY */}
                      {(companySummary.name || companySummary.nip) && (
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
                                <span className="text-muted-foreground">NIP/KRS</span>
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
                      )}
                      <Separator />
                      {/* Potem DANE OSOBY DO KONTAKTU */}
                      <section className="space-y-3">
                        <h3 className="font-medium text-sm uppercase text-muted-foreground">Dane osoby do kontaktu</h3>
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
                    </>
                  ) : (
                    <>
                      {/* Dla osoby fizycznej: standardowa kolejność */}
                      <section className="space-y-3">
                        <h3 className="font-medium text-sm uppercase text-muted-foreground">Dane osoby zgłaszającej</h3>
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
                    </>
                  )}

                  <Separator />

                  <section className="space-y-3">
                    <h3 className="font-medium text-sm uppercase text-muted-foreground">
                      {applicantType === "company" ? "Uczestnicy" : "Uczestnicy"}
                    </h3>
                    <div className="space-y-3 text-sm">
                      {applicantType === "company" ? (
                        <>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Liczba uczestników</span>
                            <span>{form.watch("participants_count") || tripConfig?.seats_total || "—"}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {tripConfig?.company_participants_info ||
                              "Dane uczestników wyjazdu należy przekazać organizatorowi na adres mailowy: office@grupa-depl.com najpóźniej 7 dni przed wyjazdem. Lista powinna zawierać imię i nazwisko oraz datę urodzenia każdego uczestnika."}
                          </p>
                        </>
                      ) : participantsSummary.length === 0 ? (
                        <p className="text-muted-foreground">Brak uczestników.</p>
                      ) : (
                        participantsSummary.map((participant, index) => {
                          // Znajdź usługi przypisane do tego uczestnika
                          const allServices = form.watch("participant_services") || [];
                          const participantServices = allServices.filter((service: any) => {
                            // W tym bloku applicantType jest "individual" (bo jesteśmy w else po sprawdzeniu "company")
                            // Dla osoby fizycznej: sprawdź participant_index
                            if (service.participant_index !== undefined) {
                              return service.participant_index === index;
                            }
                            return false;
                          });
                          
                          return (
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
                              {participantServices.length > 0 && (
                                <div className="mt-3 pt-3 border-t space-y-2">
                                  <span className="text-xs font-semibold text-muted-foreground">Usługi dodatkowe:</span>
                                  {participantServices.map((service: any, serviceIndex: number) => {
                                    if (service.type === "diet") {
                                      const diet = tripConfig?.diets?.find(d => d.id === service.service_id);
                                      const variant = service.variant_id 
                                        ? diet?.variants?.find(v => v.id === service.variant_id)
                                        : null;
                                      const displayTitle = variant ? `${diet?.title || ""} - ${variant.title}` : (diet?.title || service.service_id);
                                      
                                      return (
                                        <div key={serviceIndex} className="text-xs text-muted-foreground">
                                          • Dieta: {displayTitle}
                                          {service.price_cents !== null && service.price_cents > 0 && (
                                            <span className="ml-2">
                                              (+{((service.price_cents || 0) / 100).toFixed(2)} PLN)
                                            </span>
                                          )}
                                        </div>
                                      );
                                    }
                                    if (service.type === "insurance") {
                                      const insurance = tripConfig?.extra_insurances?.find(i => i.id === service.service_id);
                                      const variant = insurance?.variants?.find(v => v.id === service.variant_id);
                                      return (
                                        <div key={serviceIndex} className="text-xs text-muted-foreground">
                                          • Ubezpieczenie: {insurance?.title || service.service_id}
                                          {variant && (
                                            <span className="ml-2">({variant.title})</span>
                                          )}
                                          {service.price_cents !== null && service.price_cents > 0 && (
                                            <span className="ml-2">
                                              (+{((service.price_cents || 0) / 100).toFixed(2)} PLN)
                                            </span>
                                          )}
                                        </div>
                                      );
                                    }
                                    if (service.type === "attraction") {
                                      const attraction = tripConfig?.additional_attractions?.find(a => a.id === service.service_id);
                                      return (
                                        <div key={serviceIndex} className="text-xs text-muted-foreground">
                                          • Atrakcja: {attraction?.title || service.service_id}
                                          {service.price_cents !== null && service.price_cents > 0 && (
                                            <span className="ml-2">
                                              (+{((service.price_cents || 0) / 100).toFixed(2)} {service.currency || "PLN"})
                                            </span>
                                          )}
                                          {service.currency && service.currency !== "PLN" && (
                                            <span className="ml-2 text-xs">(nie wlicza się do umowy)</span>
                                          )}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>

                  <Separator />

                  {tripPrice !== null && (
                    <>
                      <section className="space-y-3">
                        <h3 className="font-medium text-sm uppercase text-muted-foreground">Cena</h3>
                        <div className="grid gap-2 text-sm">
                          {applicantType === "company" ? (
                            <>
                              {/* Dla firm: cena jednostkowa * liczba uczestników + usługi dodatkowe */}
                              {(() => {
                                const participantsCount = form.watch("participants_count") || tripConfig?.seats_total || 0;
                                const allServices = form.watch("participant_services") || [];
                                // Oblicz sumę usług dodatkowych (tylko PLN, inne waluty nie wliczają się do umowy)
                                const additionalServicesTotal = allServices.reduce((sum: number, service: any) => {
                                  if (service.currency && service.currency !== "PLN") return sum; // Waluty inne niż PLN nie wliczają się do umowy
                                  if (service.price_cents !== null && service.price_cents > 0) {
                                    return sum + (service.price_cents || 0);
                                  }
                                  return sum;
                                }, 0);
                                const basePrice = (tripPrice * participantsCount) + additionalServicesTotal;
                                const depositAmount = (basePrice * paymentSplitFirstPercent) / 100;
                                
                                return (
                                  <>
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="text-muted-foreground">Cena za osobę</span>
                                      <span className="font-semibold">
                                        {(tripPrice / 100).toLocaleString("pl-PL", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}{" "}
                                        PLN
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="text-muted-foreground">
                                        Liczba uczestników
                                      </span>
                                      <span className="font-semibold">
                                        {participantsCount}
                                      </span>
                                    </div>
                                    {additionalServicesTotal > 0 && (
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-muted-foreground">
                                          Usługi dodatkowe
                                        </span>
                                        <span className="font-semibold">
                                          {(additionalServicesTotal / 100).toLocaleString("pl-PL", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}{" "}
                                          PLN
                                        </span>
                                      </div>
                                    )}
                                    <Separator className="my-2" />
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="text-muted-foreground">Cena całkowita</span>
                                      <span className="font-semibold text-lg">
                                        {(basePrice / 100).toLocaleString("pl-PL", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}{" "}
                                        PLN
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="text-muted-foreground">Zaliczka ({paymentSplitFirstPercent}%)</span>
                                      <span className="font-semibold text-lg">
                                        {(depositAmount / 100).toLocaleString("pl-PL", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}{" "}
                                        PLN
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                      Kwota zaliczki do zapłacenia przy składaniu rezerwacji. Pozostała kwota będzie do zapłacenia przed wyjazdem.
                                    </p>
                                  </>
                                );
                              })()}
                            </>
                          ) : (
                            <>
                              {/* Dla osoby fizycznej: standardowe obliczenia */}
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
                            </>
                          )}
                        </div>
                      </section>
                      <Separator />
                    </>
                  )}

                  <Separator />

                  <section className="space-y-4">
                    <h3 className="font-medium text-sm uppercase text-muted-foreground">Zgody</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-3">Zapoznałem się i akceptuję:</p>
                        <div className="space-y-3 pl-4">
                          <FormField
                            control={control}
                            name="consents.agreement_consent"
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
                                    Umową o udział w imprezie turystycznej oraz programem imprezy turystycznej
                                  </FormLabel>
                                  {documents.agreement && (
                                    <a
                                      href={documents.agreement.url || `/api/documents/file/${documents.agreement.file_name}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      odnośnik
                                    </a>
                                  )}
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name="consents.conditions_de_pl_consent"
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
                                    Warunkami Udziału w Imprezach Turystycznych GRUPY DE-PL
                                  </FormLabel>
                                  {documents.conditions_de_pl && (
                                    <a
                                      href={documents.conditions_de_pl.url || `/api/documents/file/${documents.conditions_de_pl.file_name}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      odnośnik
                                    </a>
                                  )}
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name="consents.standard_form_consent"
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
                                    Standardowym Formularzem Informacyjnym
                                  </FormLabel>
                                  {documents.standard_form && (
                                    <a
                                      href={documents.standard_form.url || `/api/documents/file/${documents.standard_form.file_name}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      odnośnik
                                    </a>
                                  )}
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name="consents.electronic_services_consent"
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
                                    Regulaminem Świadczenia Usług Drogą Elektroniczną
                                  </FormLabel>
                                  {documents.electronic_services && (
                                    <a
                                      href={documents.electronic_services.url || `/api/documents/file/${documents.electronic_services.file_name}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      odnośnik
                                    </a>
                                  )}
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name="consents.rodo_info_consent"
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
                                    Informację nt przetwarzania danych osobowych
                                  </FormLabel>
                                  {documents.rodo_info && (
                                    <a
                                      href={documents.rodo_info.url || `/api/documents/file/${documents.rodo_info.file_name}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      odnośnik
                                    </a>
                                  )}
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-sm font-medium mb-3">UBEZPIECZENIE</p>
                        <div className="space-y-3 pl-4">
                          <FormField
                            control={control}
                            name="consents.insurance_terms_consent"
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
                                    Zapoznałem się z treścią Ogólnych Warunków Ubezpieczenia, jakie obowiązywać będą po zawarciu przez Organizatora Imprezy Turystycznej umowy ubezpieczenia na rzecz uczestnika/uczestników wyjazdu
                                  </FormLabel>
                                  {documents.insurance_terms && (
                                    <a
                                      href={documents.insurance_terms.url || `/api/documents/file/${documents.insurance_terms.file_name}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      odnośnik
                                    </a>
                                  )}
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name="consents.insurance_data_consent"
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
                                    Wyrażam zgodę na przetwarzanie moich danych osobowych oraz danych osób objętych niniejszą umową w zakresie: imię, nazwisko, adres oraz datę urodzenia, przez wskazanego w umowie ubezpieczyciela jako administratora danych osobowych, w celu zawarcia i wykonania umowy ubezpieczenia na mój rachunek i rachunek ww. osób.
                                  </FormLabel>
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name="consents.insurance_other_person_consent"
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
                                    W przypadku zawarcia umowy na rzecz innej osoby oświadczam, że doręczyłem tej osobie na piśmie lub za ich zgodą na innym trwałym nośniku Ogólne Warunki Ubezpieczenia
                                  </FormLabel>
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-4">
                    <div>
                      <h3 className="font-medium text-sm uppercase text-muted-foreground">Podgląd umowy</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Po przesłaniu zgłoszenia wygenerujemy wzór umowy w formacie PDF i wyślemy go na podany e-mail.
                      </p>
                    </div>
                    {agreementTemplate && (() => {
                      // Mapuj participant_services do odpowiedniego formatu
                      const participantServices = form.watch("participant_services") || [];
                      const mappedServices = participantServices.map((service: any) => {
                        // Znajdź tytuł usługi z konfiguracji wycieczki
                        let serviceTitle = service.service_id;
                        
                        if (service.type === "attraction" && tripConfig?.additional_attractions) {
                          const attraction = tripConfig.additional_attractions.find((a: any) => a.id === service.service_id);
                          if (attraction) serviceTitle = attraction.title;
                        } else if (service.type === "diet" && tripConfig?.diets) {
                          const diet = tripConfig.diets.find((d: any) => d.id === service.service_id);
                          if (diet) serviceTitle = diet.title;
                        } else if (service.type === "insurance" && tripConfig?.extra_insurances) {
                          const insurance = tripConfig.extra_insurances.find((i: any) => i.id === service.service_id);
                          if (insurance) serviceTitle = insurance.title;
                        }

                        return {
                          service_type: service.type,
                          service_title: serviceTitle,
                        };
                      });

                      return (
                        <AgreementPreview 
                          template={agreementTemplate} 
                          tripFullData={tripFullData}
                          tripContentData={tripContentData}
                          formData={{
                            contact: {
                              first_name: form.watch("contact.first_name"),
                              last_name: form.watch("contact.last_name"),
                              email: form.watch("contact.email"),
                              phone: form.watch("contact.phone"),
                              pesel: form.watch("contact.pesel"),
                              address: form.watch("contact.address"),
                            },
                            company: applicantType === "company" ? form.watch("company") : undefined,
                            participants: form.watch("participants"),
                            participant_services: mappedServices as Array<{ service_type?: string; service_title?: string }>,
                          }}
                        />
                      );
                    })()}
                  </section>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <div className="flex justify-between gap-3 w-full">
                    <Button type="button" variant="outline" onClick={goToPrevStep}>
                      Wstecz
                    </Button>
                    {applicantType === "company" ? (
                      /* Dla firm: tylko jeden przycisk "ZAREZERWUJ" */
                      <Button 
                        type="button"
                        disabled={isSubmitting}
                        onClick={async (e) => {
                          e.preventDefault();
                          console.log("ZAREZERWUJ button clicked");
                          const result = await form.trigger();
                          console.log("Form validation result:", result);
                          if (!result) {
                            const errors = form.formState.errors;
                            console.log("Form validation errors:", errors);
                            const errorDescription = formatValidationErrors(errors);
                            toast.error("Proszę wypełnić wszystkie wymagane pola", {
                              description: errorDescription,
                              duration: 5000,
                            });
                            return;
                          }
                          form.handleSubmit(
                            (values) => {
                              console.log("Form validation passed, calling onSubmit");
                              onSubmit(values, false);
                            },
                            (errors) => {
                              console.log("Form validation failed in handleSubmit:", errors);
                              const errorDescription = formatValidationErrors(errors);
                              toast.error("Proszę wypełnić wszystkie wymagane pola", {
                                description: errorDescription,
                                duration: 5000,
                              });
                            }
                          )();
                        }}
                      >
                        {isSubmitting ? "Wysyłanie..." : "ZAREZERWUJ"}
                      </Button>
                    ) : (
                      /* Dla osoby fizycznej: dwa przyciski */
                      <div className="flex gap-3">
                        <Button 
                          type="button" 
                          variant="outline"
                          disabled={isSubmitting}
                          onClick={async (e) => {
                            e.preventDefault();
                            console.log("Rezerwuj button clicked");
                            const result = await form.trigger();
                            console.log("Form validation result:", result);
                            if (!result) {
                              const errors = form.formState.errors;
                              console.log("Form validation errors:", errors);
                              const errorDescription = formatValidationErrors(errors);
                              toast.error("Proszę wypełnić wszystkie wymagane pola", {
                                description: errorDescription,
                                duration: 5000,
                              });
                              return;
                            }
                            form.handleSubmit(
                              (values) => {
                                console.log("Form validation passed, calling onSubmit");
                                onSubmit(values, false);
                              },
                              (errors) => {
                                console.log("Form validation failed in handleSubmit:", errors);
                                toast.error("Proszę wypełnić wszystkie wymagane pola", {
                                  description: "Sprawdź formularz i popraw błędy przed wysłaniem rezerwacji.",
                                });
                              }
                            )();
                          }}
                        >
                          {isSubmitting ? "Wysyłanie..." : "Rezerwuj"}
                        </Button>
                        <Button 
                          type="button"
                          disabled={isSubmitting}
                          onClick={async (e) => {
                            e.preventDefault();
                            console.log("Rezerwuj i Zapłać button clicked");
                            const result = await form.trigger();
                            console.log("Form validation result:", result);
                            if (!result) {
                              const errors = form.formState.errors;
                              console.log("Form validation errors:", errors);
                              const errorDescription = formatValidationErrors(errors);
                              toast.error("Proszę wypełnić wszystkie wymagane pola", {
                                description: errorDescription,
                                duration: 5000,
                              });
                              return;
                            }
                            form.handleSubmit(
                              (values) => {
                                console.log("Form validation passed, calling onSubmit");
                                onSubmit(values, true);
                              },
                              (errors) => {
                                console.log("Form validation failed in handleSubmit:", errors);
                                toast.error("Proszę wypełnić wszystkie wymagane pola", {
                                  description: "Sprawdź formularz i popraw błędy przed wysłaniem rezerwacji.",
                                });
                              }
                            )();
                          }}
                        >
                          {isSubmitting ? "Wysyłanie..." : "Rezerwuj i Zapłać"}
                        </Button>
                      </div>
                    )}
                  </div>
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

