import { z } from "zod";
import { createBookingFormSchema } from "./booking-form-schemas";

const bookingFormSchema = createBookingFormSchema();

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

export type RegistrationMode = "individual" | "company" | "both";

export type TripConfig = {
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
    variants?: { id: string; title: string; price_cents: number | null }[];
  }[];
  form_required_participant_fields?: {
    pesel?: boolean;
    document?: boolean;
    gender?: boolean;
    phone?: boolean;
  } | null;
};

export const steps = [
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
