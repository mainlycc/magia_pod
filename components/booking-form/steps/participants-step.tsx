"use client";

import { UseFormReturn, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
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
import type { BookingFormValues, TripConfig } from "../booking-form-types";

interface ParticipantsStepProps {
  form: UseFormReturn<BookingFormValues>;
  applicantType: "individual" | "company";
  tripConfig: TripConfig | null;
  onNext: () => void;
  onPrev: () => void;
}

export function ParticipantsStep({
  form,
  applicantType,
  tripConfig,
  onNext,
  onPrev,
}: ParticipantsStepProps) {
  const { control } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "participants",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{applicantType === "company" ? "Liczba uczestników" : "Uczestnicy"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {applicantType === "company" ? (
          <div className="space-y-3">
            <FormField
              control={control}
              name="participants_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Liczba uczestników *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder={tripConfig?.seats_total?.toString() || "1"}
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => {
                        const value = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                        field.onChange(isNaN(value as number) ? undefined : value);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    {tripConfig?.seats_total
                      ? `Liczba miejsc dostępnych: ${tripConfig.seats_total}`
                      : "Podaj liczbę uczestników"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                    name={`participants.${index}.birth_date`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data urodzenia *</FormLabel>
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
                </div>

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
              </div>
            ))}
            <Button
              type="button"
              variant="default"
              onClick={() =>
                append({
                  first_name: "",
                  last_name: "",
                  birth_date: "",
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
        <Button type="button" variant="outline" onClick={onPrev}>
          Wstecz
        </Button>
        <Button type="button" onClick={onNext}>
          Dalej
        </Button>
      </CardFooter>
    </Card>
  );
}
