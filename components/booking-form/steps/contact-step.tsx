"use client";

import Link from "next/link";
import { UseFormReturn } from "react-hook-form";
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
import { Separator } from "@/components/ui/separator";
import { useWatch } from "react-hook-form";
import type { BookingFormValues, TripConfig } from "../booking-form-types";

interface ContactStepProps {
  form: UseFormReturn<BookingFormValues>;
  applicantType: "individual" | "company";
  setApplicantType: (type: "individual" | "company") => void;
  tripConfig: TripConfig | null;
  slug: string;
  onNext: () => void;
}

export function ContactStep({
  form,
  applicantType,
  setApplicantType,
  tripConfig,
  slug,
  onNext,
}: ContactStepProps) {
  const { control, setValue } = form;
  const invoiceWatch = useWatch({
    control,
    name: "invoice",
  });

  return (
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
            name="contact.last_name"
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
        <Button type="button" onClick={onNext}>
          Dalej
        </Button>
      </CardFooter>
    </Card>
  );
}
