"use client";

import { useMemo, useState } from "react";
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

const addressSchema = z.object({
  street: z.string().min(2, "Podaj ulicę"),
  city: z.string().min(2, "Podaj miasto"),
  zip: z.string().min(4, "Podaj kod pocztowy"),
});

const companySchema = z.object({
  name: z.string().min(2, "Podaj nazwę firmy").optional().or(z.literal("").transform(() => undefined)),
  nip: z.string().regex(/^\d{10}$/, "NIP musi mieć dokładnie 10 cyfr").optional().or(z.literal("").transform(() => undefined)),
  address: addressSchema.optional(),
});

const participantSchema = z.object({
  first_name: z.string().min(2, "Podaj imię"),
  last_name: z.string().min(2, "Podaj nazwisko"),
  pesel: z.string().regex(/^\d{11}$/, "PESEL musi mieć dokładnie 11 cyfr"),
  email: z.string().email("Podaj poprawny e-mail").optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().min(7, "Telefon jest zbyt krótki").optional().or(z.literal("").transform(() => undefined)),
  document_type: z.enum(["ID", "PASSPORT"]).optional(),
  document_number: z.string().min(3, "Podaj numer dokumentu").optional(),
});

const bookingFormSchema = z.object({
  contact: z.object({
    first_name: z.string().min(2, "Podaj imię").optional().or(z.literal("").transform(() => undefined)),
    last_name: z.string().min(2, "Podaj nazwisko").optional().or(z.literal("").transform(() => undefined)),
    email: z.string().email("Podaj poprawny e-mail"),
    phone: z.string().min(7, "Podaj telefon"),
    address: addressSchema,
  }),
  company: companySchema.optional(),
  participants: z
    .array(participantSchema)
    .min(1, "Dodaj co najmniej jednego uczestnika"),
  consents: z.object({
    rodo: z.literal(true),
    terms: z.literal(true),
    conditions: z.literal(true),
  }),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

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
    "company.address",
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

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
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
      participants: [
        {
          first_name: "",
          last_name: "",
          pesel: "",
          email: undefined,
          phone: undefined,
          document_type: undefined,
          document_number: undefined,
        },
      ],
      consents: {
        rodo: true,
        terms: true,
        conditions: true,
      },
    },
    mode: "onBlur",
  });

  const { control, handleSubmit, trigger } = form;

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

  const currentStep = steps[activeStepIndex];

  const canGoToStep = (nextIndex: number) => nextIndex <= maxAvailableStep || nextIndex <= activeStepIndex;

  const handleTabsChange = async (value: string) => {
    const nextIndex = steps.findIndex((step) => step.id === value);
    if (nextIndex === -1) return;

    if (nextIndex > activeStepIndex) {
      const isValid = await trigger(stepFieldGroups[currentStep.id]);
      if (!isValid) return;
    }

    if (canGoToStep(nextIndex)) {
      setActiveStepIndex(nextIndex);
      setMaxAvailableStep((prev) => Math.max(prev, nextIndex));
    }
  };

  const goToNextStep = async () => {
    const isValid = await trigger(stepFieldGroups[currentStep.id]);
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
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: slug,
          contact_first_name: values.contact.first_name && values.contact.first_name.trim() !== "" ? values.contact.first_name : undefined,
          contact_last_name: values.contact.last_name && values.contact.last_name.trim() !== "" ? values.contact.last_name : undefined,
          contact_email: values.contact.email,
          contact_phone: values.contact.phone,
          address: {
            street: values.contact.address.street,
            city: values.contact.address.city,
            zip: values.contact.address.zip,
          },
          company_name: values.company?.name && values.company.name.trim() !== "" ? values.company.name : undefined,
          company_nip: values.company?.nip && values.company.nip.trim() !== "" ? values.company.nip : undefined,
          company_address: values.company?.address ? {
            street: values.company.address.street,
            city: values.company.address.city,
            zip: values.company.address.zip,
          } : undefined,
          participants: values.participants.map((p) => ({
            first_name: p.first_name,
            last_name: p.last_name,
            pesel: p.pesel,
            email: p.email && p.email.trim() !== "" ? p.email : undefined,
            phone: p.phone && p.phone.trim() !== "" ? p.phone : undefined,
            document_type: p.document_type || undefined,
            document_number: p.document_number && p.document_number.trim() !== "" ? p.document_number : undefined,
          })),
          consents: values.consents,
        }),
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
      toast.success("Rezerwacja została potwierdzona!", {
        description: `Kod rezerwacji: ${data?.booking_ref || ""}. Przekierowywanie do płatności...`,
        duration: 3000,
      });

      // PRIORYTET 1: Jeśli jest redirect_url (Paynow), przekieruj od razu do płatności
      if (data?.redirect_url) {
        window.location.href = data.redirect_url as string;
        return;
      }

      // PRIORYTET 2: Jeśli nie ma Paynow, przekieruj do strony rezerwacji (gdzie można załączyć umowę i zapłacić)
      if (data?.booking_url) {
        window.location.href = data.booking_url as string;
        return;
      }

      // Ostatni fallback: strona wycieczki
      router.push(`/trip/${slug}`);
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
        key: `${participant.pesel || participant.email}-${index}`,
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <TabsContent value="contact" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Dane kontaktowe</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={control}
                      name="contact.first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Imię osoby kontaktowej</FormLabel>
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
                          <FormLabel>Nazwisko osoby kontaktowej</FormLabel>
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

                  <div className="space-y-4">
                    <h3 className="font-medium text-sm">Dane firmy</h3>
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

                      <div className="grid gap-4 md:grid-cols-3">
                        <FormField
                          control={control}
                          name={`participants.${index}.pesel`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PESEL</FormLabel>
                              <FormControl>
                                <Input placeholder="88010112345" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name={`participants.${index}.email`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>E-mail</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="jan@example.com" {...field} />
                              </FormControl>
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

                      <div className="grid gap-4 md:grid-cols-[1.5fr,1fr]">
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
                              <FormLabel>Numer dokumentu</FormLabel>
                              <FormControl>
                                <Input placeholder="ABC123456" {...field} />
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
                    variant="secondary"
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
                              <span>PESEL: {participant.pesel || "—"}</span>
                              <span>E-mail: {participant.email || "—"}</span>
                              <span>Telefon: {participant.phone || "—"}</span>
                              <span>Dokument: {participant.document_number || "—"}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-4">
                    <h3 className="font-medium text-sm uppercase text-muted-foreground">Podgląd umowy</h3>
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
                            <div className="space-y-1">
                              <FormLabel className="text-sm font-medium leading-none">
                                Zgoda na przetwarzanie danych osobowych (RODO)
                              </FormLabel>
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
                            <div className="space-y-1">
                              <FormLabel className="text-sm font-medium leading-none">
                                Zapoznałem się z regulaminem i go akceptuję
                              </FormLabel>
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
                            <div className="space-y-1">
                              <FormLabel className="text-sm font-medium leading-none">
                                Potwierdzam znajomość warunków udziału w wycieczce
                              </FormLabel>
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                    <Alert>
                      <AlertTitle>Podgląd umowy</AlertTitle>
                      <AlertDescription>
                        Po przesłaniu zgłoszenia wygenerujemy wzór umowy w formacie PDF i wyślemy go na podany e-mail.
                        W kolejnych iteracjach pojawi się tutaj interaktywny podgląd dokumentu.
                      </AlertDescription>
                    </Alert>
                  </section>
                </CardContent>
                <CardFooter className="flex justify-between gap-3">
                  <Button type="button" variant="outline" onClick={goToPrevStep}>
                    Wstecz
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
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

