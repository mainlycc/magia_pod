"use client";

import { useCallback, useEffect, useState } from "react";
import { useTrip } from "@/contexts/trip-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { AgreementEditor } from "@/components/agreement-editor";
import { AgreementPreview } from "@/components/agreement-preview";
import {
  parseHtmlToTemplate,
  templateToHtml,
  type AgreementTemplate,
} from "@/lib/agreement-template-parser";
import { DEFAULT_AGREEMENT_TEMPLATE_HTML } from "@/lib/agreements/default-template";
import {
  getAgreementPreviewSampleFormDataCompany,
  getAgreementPreviewSampleFormDataIndividual,
} from "@/lib/agreements/agreement-preview-sample-data";
import { ExternalLink } from "lucide-react";

const DEFAULT_TEMPLATE = DEFAULT_AGREEMENT_TEMPLATE_HTML;

function newFieldId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `field-${crypto.randomUUID()}`;
  }
  return `field-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureTripInfoTableFields(template: AgreementTemplate): AgreementTemplate {
  const required = [
    { label: "Rodzaj, typ pokoju:", key: "room_type" },
    { label: "Ilość, rodzaj posiłków:", key: "meals_info" },
    { label: "Transfery:", key: "transfer_info" },
  ] as const;

  const sections = template.sections.map((section) => ({ ...section }));

  const tripInfoTableIndex = sections.findIndex((s) => {
    if (s.type !== "table" || !s.fields?.length) return false;
    return s.fields.some((f) => f.value.includes("{{accommodation_location}}"));
  });

  if (tripInfoTableIndex === -1) return template;

  const tripInfoTable = { ...sections[tripInfoTableIndex] };
  const fields = [...(tripInfoTable.fields || [])];

  const normalizedFields = fields.map((f) => {
    const labelLower = f.label.trim().toLowerCase();
    const match = required.find((r) => r.label.trim().toLowerCase() === labelLower);
    if (!match) return f;
    const placeholder = `{{${match.key}}}`;
    if (!f.value.trim() || f.value.trim() === placeholder) {
      return { ...f, value: placeholder, type: "static" as const };
    }
    return f;
  });

  const existingLabels = new Set(normalizedFields.map((f) => f.label.trim().toLowerCase()));
  const toAdd = required.filter((r) => !existingLabels.has(r.label.trim().toLowerCase()));
  if (toAdd.length === 0) {
    if (normalizedFields !== fields) {
      tripInfoTable.fields = normalizedFields;
      sections[tripInfoTableIndex] = tripInfoTable;
      return { ...template, sections };
    }
    return template;
  }

  const insertAfterIndex = normalizedFields.findIndex((f) =>
    f.value.includes("{{accommodation_location}}"),
  );
  const baseIndex = insertAfterIndex === -1 ? normalizedFields.length - 1 : insertAfterIndex;

  normalizedFields.splice(
    baseIndex + 1,
    0,
    ...toAdd.map((r) => ({
      id: newFieldId(),
      label: r.label,
      value: `{{${r.key}}}`,
      type: "static" as const,
    })),
  );

  tripInfoTable.fields = normalizedFields;
  sections[tripInfoTableIndex] = tripInfoTable;

  return { ...template, sections };
}

const PLACEHOLDERS = [
  {
    category: "Dane zgłaszającego",
    items: [
      { name: "{{contact_first_name}}", description: "Imię" },
      { name: "{{contact_last_name}}", description: "Nazwisko" },
      { name: "{{contact_full_name}}", description: "Imię i Nazwisko" },
      { name: "{{contact_address}}", description: "Adres (pełny)" },
      { name: "{{contact_street}}", description: "Ulica" },
      { name: "{{contact_city}}", description: "Miasto" },
      { name: "{{contact_zip}}", description: "Kod pocztowy" },
      { name: "{{contact_pesel}}", description: "PESEL" },
      { name: "{{contact_phone}}", description: "Telefon" },
      { name: "{{contact_email}}", description: "E-mail" },
    ],
  },
  {
    category: "Dane firmy",
    items: [
      { name: "{{company_name}}", description: "Nazwa firmy" },
      { name: "{{company_nip}}", description: "NIP" },
      { name: "{{company_address}}", description: "Adres firmy" },
    ],
  },
  {
    category: "Dane uczestników",
    items: [
      { name: "{{participants_count}}", description: "Liczba uczestników" },
      { name: "{{participants_list}}", description: "Lista uczestników (imię, nazwisko)" },
    ],
  },
  {
    category: "Informacje o wycieczce",
    items: [
      { name: "{{trip_title}}", description: "Nazwa imprezy" },
      { name: "{{reservation_number}}", description: "Numer rezerwacji" },
      { name: "{{trip_location}}", description: "Trasa/miejsce pobytu" },
      { name: "{{trip_start_date}}", description: "Data rozpoczęcia" },
      { name: "{{trip_end_date}}", description: "Data zakończenia" },
      { name: "{{trip_duration}}", description: "Czas trwania" },
      { name: "{{trip_price_per_person}}", description: "Cena za osobę" },
      { name: "{{trip_total_price}}", description: "Cena całkowita" },
      { name: "{{trip_deposit_amount}}", description: "Kwota zaliczki" },
      { name: "{{trip_deposit_deadline}}", description: "Termin zapłaty zaliczki" },
      { name: "{{trip_final_payment_deadline}}", description: "Termin zapłaty całości" },
      { name: "{{insurance_scope}}", description: "Zakres ubezpieczenia (z modułu Ubezpieczenia)" },
      { name: "{{room_type}}", description: "Rodzaj, typ pokoju (pole w szablonie umowy)" },
      { name: "{{meals_info}}", description: "Ilość, rodzaj posiłków (pole w szablonie umowy)" },
      { name: "{{transfer_info}}", description: "Transfery (pole w szablonie umowy)" },
    ],
  },
  {
    category: "Pola ręczne (do wypełnienia w szablonie)",
    items: [
      { name: "{{nights_count}}", description: "Liczba noclegów (tekst)" },
      { name: "{{accommodation_location}}", description: "Lokalizacja, rodzaj, kategoria obiektu" },
      { name: "{{transport_type}}", description: "Rodzaj kategoria środka transportu" },
      { name: "{{flight_info}}", description: "Przelot liniami (szczegóły)" },
      { name: "{{baggage_info}}", description: "Bagaż (wymiary, waga)" },
      { name: "{{additional_services}}", description: "Dodatkowe świadczenia" },
      { name: "{{selected_services}}", description: "Usługi dodatkowe pogrupowane per uczestnik (diety, ubezpieczenia, atrakcje z ceną)" },
      { name: "{{additional_costs}}", description: "Dodatkowe koszty" },
    ],
  },
];

async function loadTemplatesFromApi(tripId: string): Promise<{
  individual: AgreementTemplate;
  company: AgreementTemplate;
} | null> {
  const templatesRes = await fetch(`/api/trips/${tripId}/agreement-templates`);

  if (!templatesRes.ok) {
    if (templatesRes.status === 403) {
      toast.error("Brak uprawnień do wczytania szablonu umowy");
    } else {
      toast.error("Nie udało się wczytać szablonów umowy");
    }
    return null;
  }

  const templates = await templatesRes.json();
  return {
    individual: ensureTripInfoTableFields(
      parseHtmlToTemplate(templates.individual || DEFAULT_TEMPLATE),
    ),
    company: ensureTripInfoTableFields(parseHtmlToTemplate(templates.company || DEFAULT_TEMPLATE)),
  };
}

export default function AgreementPage() {
  const { selectedTrip, tripFullData, tripContentData, isLoadingTripData } = useTrip();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<"individual" | "company" | "both">("both");
  const [templateIndividual, setTemplateIndividual] = useState<AgreementTemplate | null>(null);
  const [templateCompany, setTemplateCompany] = useState<AgreementTemplate | null>(null);
  const [insuranceScope, setInsuranceScope] = useState<string | null>(null);

  useEffect(() => {
    if (tripFullData?.registration_mode) {
      setRegistrationMode(
        (tripFullData.registration_mode as "individual" | "company" | "both") || "both",
      );
    }
  }, [tripFullData?.registration_mode]);

  const loadTemplates = useCallback(async (tripId: string) => {
    try {
      setLoading(true);
      const loaded = await loadTemplatesFromApi(tripId);
      if (loaded) {
        setTemplateIndividual(loaded.individual);
        setTemplateCompany(loaded.company);
      } else {
        setTemplateIndividual(parseHtmlToTemplate(DEFAULT_TEMPLATE));
        setTemplateCompany(parseHtmlToTemplate(DEFAULT_TEMPLATE));
      }
    } catch {
      toast.error("Nie udało się wczytać szablonów");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedTrip?.id) {
      setLoading(false);
      return;
    }

    void loadTemplates(selectedTrip.id);
  }, [selectedTrip?.id, loadTemplates]);

  useEffect(() => {
    if (!selectedTrip?.id) return;

    const loadScope = async () => {
      try {
        const res = await fetch(`/api/trips/${selectedTrip.id}/insurance-scope`);
        if (res.ok) {
          const data = await res.json();
          setInsuranceScope(data.scope || null);
        }
      } catch {
        setInsuranceScope(null);
      }
    };

    void loadScope();
  }, [selectedTrip?.id]);

  const previewContentData = tripContentData;

  const handleSave = async (type: "individual" | "company") => {
    if (!selectedTrip?.id) return;

    const template = type === "individual" ? templateIndividual : templateCompany;
    if (!template) return;

    try {
      setSaving(true);
      const html = templateToHtml(template);

      const res = await fetch(`/api/trips/${selectedTrip.id}/agreement-templates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_type: type,
          template_html: html,
        }),
      });

      if (res.ok) {
        toast.success(
          `Szablon umowy dla ${type === "individual" ? "osób fizycznych" : "firm"} został zapisany`,
        );
        const reloaded = await loadTemplatesFromApi(selectedTrip.id);
        if (reloaded) {
          if (type === "individual") {
            setTemplateIndividual(reloaded.individual);
          } else {
            setTemplateCompany(reloaded.company);
          }
        }
      } else if (res.status === 403) {
        toast.error("Brak uprawnień do zapisu szablonu umowy");
      } else {
        toast.error("Nie udało się zapisać szablonu");
      }
    } catch {
      toast.error("Nie udało się zapisać szablonu");
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateChange = (type: "individual" | "company", template: AgreementTemplate) => {
    if (type === "individual") {
      setTemplateIndividual(template);
    } else {
      setTemplateCompany(template);
    }
  };

  if (!selectedTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Wybierz wycieczkę</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading || isLoadingTripData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!templateIndividual || !templateCompany) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const previewProps = {
    tripFullData,
    tripContentData: previewContentData,
    insuranceScope,
  };

  const reserveSlug = tripFullData?.slug || selectedTrip.slug;
  const reservePreviewUrl = `/trip/${reserveSlug}/reserve?podglad=1`;

  const sampleFormIndividual = getAgreementPreviewSampleFormDataIndividual();
  const sampleFormCompany = getAgreementPreviewSampleFormDataCompany();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Podgląd poniżej używa przykładowych danych klienta — tak jak na ostatnim kroku rezerwacji.
          Po zapisie szablonu odśwież podgląd lub otwórz stronę rezerwacji w trybie podglądu.
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={reservePreviewUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Podgląd na stronie rezerwacji
          </a>
        </Button>
      </div>
      {registrationMode === "both" ? (
        <Tabs defaultValue="individual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual">Podgląd - Osoba fizyczna</TabsTrigger>
            <TabsTrigger value="company">Podgląd - Firma</TabsTrigger>
          </TabsList>
          <TabsContent value="individual" className="mt-4">
            <AgreementPreview
              template={templateIndividual}
              {...previewProps}
              hideCompanySection
              formData={sampleFormIndividual}
            />
          </TabsContent>
          <TabsContent value="company" className="mt-4">
            <AgreementPreview
              template={templateCompany}
              {...previewProps}
              formData={sampleFormCompany}
            />
          </TabsContent>
        </Tabs>
      ) : registrationMode === "individual" ? (
        <AgreementPreview
          template={templateIndividual}
          {...previewProps}
          hideCompanySection
          formData={sampleFormIndividual}
        />
      ) : (
        <AgreementPreview
          template={templateCompany}
          {...previewProps}
          formData={sampleFormCompany}
        />
      )}

      <Card className="p-4">
        <CardHeader className="px-0 pb-2">
          <CardTitle>Edytor szablonu umowy</CardTitle>
          <p className="text-sm text-muted-foreground">
            Edytuj szablon umowy dla wycieczki. Przeciągnij sekcje, aby zmienić ich kolejność. Użyj
            placeholderów w formacie {"{{placeholder_name}}"} aby wstawić dane z formularza i
            wycieczki.
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {registrationMode === "both" ? (
            <Tabs defaultValue="individual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="individual">Osoba fizyczna</TabsTrigger>
                <TabsTrigger value="company">Firma</TabsTrigger>
              </TabsList>
              <TabsContent value="individual" className="mt-4">
                <AgreementEditor
                  template={templateIndividual}
                  onChange={(template) => handleTemplateChange("individual", template)}
                  onSave={() => handleSave("individual")}
                  saving={saving}
                />
              </TabsContent>
              <TabsContent value="company" className="mt-4">
                <AgreementEditor
                  template={templateCompany}
                  onChange={(template) => handleTemplateChange("company", template)}
                  onSave={() => handleSave("company")}
                  saving={saving}
                />
              </TabsContent>
            </Tabs>
          ) : registrationMode === "individual" ? (
            <AgreementEditor
              template={templateIndividual}
              onChange={(template) => handleTemplateChange("individual", template)}
              onSave={() => handleSave("individual")}
              saving={saving}
            />
          ) : (
            <AgreementEditor
              template={templateCompany}
              onChange={(template) => handleTemplateChange("company", template)}
              onSave={() => handleSave("company")}
              saving={saving}
            />
          )}

          <div className="pt-2 border-t">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted/50 rounded text-xs">
                <Info className="h-3 w-3" />
                <span className="font-medium">Dostępne placeholdery</span>
                <ChevronDown className="h-3 w-3 ml-auto transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 pt-2">
                  {PLACEHOLDERS.map((category) => (
                    <div key={category.category} className="space-y-1.5">
                      <h4 className="font-semibold text-xs">{category.category}</h4>
                      <div className="grid grid-cols-1 gap-1.5">
                        {category.items.map((item) => (
                          <div
                            key={item.name}
                            className="flex items-start gap-1.5 p-1.5 bg-muted/50 rounded text-xs"
                          >
                            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                              {item.name}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {item.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
