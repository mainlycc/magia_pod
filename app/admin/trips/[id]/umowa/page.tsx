"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Info } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { DEFAULT_AGREEMENT_TEMPLATE_HTML } from "@/lib/agreements/default-template";

const DEFAULT_TEMPLATE = DEFAULT_AGREEMENT_TEMPLATE_HTML;

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
    ],
  },
  {
    category: "Pola ręczne (do wypełnienia w szablonie)",
    items: [
      { name: "{{nights_count}}", description: "Liczba noclegów (tekst)" },
      { name: "{{accommodation_location}}", description: "Lokalizacja, rodzaj, kategoria obiektu" },
      { name: "{{room_type}}", description: "Rodzaj, typ pokoju" },
      { name: "{{meals_info}}", description: "Ilość, rodzaj posiłków" },
      { name: "{{transport_type}}", description: "Rodzaj kategoria środka transportu" },
      { name: "{{flight_info}}", description: "Przelot liniami (szczegóły)" },
      { name: "{{baggage_info}}", description: "Bagaż (wymiary, waga)" },
      { name: "{{transfer_info}}", description: "Transfery" },
      { name: "{{additional_services}}", description: "Dodatkowe świadczenia" },
      { name: "{{selected_services}}", description: "Usługi dodatkowe pogrupowane per uczestnik (diety, ubezpieczenia, atrakcje z ceną)" },
      { name: "{{insurance_scope}}", description: "Zakres ubezpieczenia" },
      { name: "{{additional_costs}}", description: "Dodatkowe koszty" },
    ],
  },
];

export default function AgreementPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tripTitle, setTripTitle] = useState("");
  const [registrationMode, setRegistrationMode] = useState<"individual" | "company" | "both">("both");
  const [templateIndividual, setTemplateIndividual] = useState("");
  const [templateCompany, setTemplateCompany] = useState("");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const [templatesRes, tripRes] = await Promise.all([
          fetch(`/api/trips/${id}/agreement-templates`),
          fetch(`/api/trips/${id}`),
        ]);

        if (templatesRes.ok) {
          const templates = await templatesRes.json();
          setTemplateIndividual(templates.individual || DEFAULT_TEMPLATE);
          setTemplateCompany(templates.company || DEFAULT_TEMPLATE);
        }

        if (tripRes.ok) {
          const trip = await tripRes.json();
          setTripTitle(trip.title || "");
          setRegistrationMode((trip.registration_mode as "individual" | "company" | "both") || "both");
        }
      } catch (err) {
        toast.error("Nie udało się wczytać danych");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleSave = async (type: "individual" | "company") => {
    if (!id) return;

    try {
      setSaving(true);
      const template = type === "individual" ? templateIndividual : templateCompany;
      const res = await fetch(`/api/trips/${id}/agreement-templates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_type: type,
          template_html: template,
        }),
      });

      if (res.ok) {
        toast.success(`Szablon umowy dla ${type === "individual" ? "osób fizycznych" : "firm"} został zapisany`);
      } else {
        toast.error("Nie udało się zapisać szablonu");
      }
    } catch (err) {
      toast.error("Nie udało się zapisać szablonu");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBoth = async () => {
    if (!id) return;

    try {
      setSaving(true);
      const [res1, res2] = await Promise.all([
        fetch(`/api/trips/${id}/agreement-templates`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registration_type: "individual",
            template_html: templateIndividual,
          }),
        }),
        fetch(`/api/trips/${id}/agreement-templates`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registration_type: "company",
            template_html: templateCompany,
          }),
        }),
      ]);

      if (res1.ok && res2.ok) {
        toast.success("Szablony umów zostały zapisane");
      } else {
        toast.error("Nie udało się zapisać wszystkich szablonów");
      }
    } catch (err) {
      toast.error("Nie udało się zapisać szablonów");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/admin/trips">Wycieczki</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/admin/trips/${id}/edit`}>{tripTitle || "Wycieczka"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Wzór umowy</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle>Szablon umowy</CardTitle>
          <p className="text-sm text-muted-foreground">
            Edytuj szablon umowy dla wycieczki. Użyj placeholderów w formacie {"{{placeholder_name}}"} aby wstawić dane z formularza i wycieczki.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {registrationMode === "both" ? (
            <Tabs defaultValue="individual" className="w-full">
              <TabsList>
                <TabsTrigger value="individual">Osoba fizyczna</TabsTrigger>
                <TabsTrigger value="company">Firma</TabsTrigger>
              </TabsList>
              <TabsContent value="individual" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-individual">Szablon HTML dla osób fizycznych</Label>
                  <Textarea
                    id="template-individual"
                    value={templateIndividual}
                    onChange={(e) => setTemplateIndividual(e.target.value)}
                    className="font-mono text-sm min-h-[500px]"
                    placeholder="Wpisz szablon HTML..."
                  />
                </div>
                <Button onClick={() => handleSave("individual")} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Zapisywanie...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Zapisz szablon dla osób fizycznych
                    </>
                  )}
                </Button>
              </TabsContent>
              <TabsContent value="company" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-company">Szablon HTML dla firm</Label>
                  <Textarea
                    id="template-company"
                    value={templateCompany}
                    onChange={(e) => setTemplateCompany(e.target.value)}
                    className="font-mono text-sm min-h-[500px]"
                    placeholder="Wpisz szablon HTML..."
                  />
                </div>
                <Button onClick={() => handleSave("company")} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Zapisywanie...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Zapisz szablon dla firm
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          ) : registrationMode === "individual" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-individual">Szablon HTML dla osób fizycznych</Label>
                <Textarea
                  id="template-individual"
                  value={templateIndividual}
                  onChange={(e) => setTemplateIndividual(e.target.value)}
                  className="font-mono text-sm min-h-[500px]"
                  placeholder="Wpisz szablon HTML..."
                />
              </div>
              <Button onClick={() => handleSave("individual")} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Zapisz szablon
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-company">Szablon HTML dla firm</Label>
                <Textarea
                  id="template-company"
                  value={templateCompany}
                  onChange={(e) => setTemplateCompany(e.target.value)}
                  className="font-mono text-sm min-h-[500px]"
                  placeholder="Wpisz szablon HTML..."
                />
              </div>
              <Button onClick={() => handleSave("company")} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Zapisz szablon
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="pt-4 border-t">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted/50 rounded">
                <Info className="h-4 w-4" />
                <span className="font-medium">Dostępne placeholdery</span>
                <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-4 pt-4">
                  {PLACEHOLDERS.map((category) => (
                    <div key={category.category} className="space-y-2">
                      <h4 className="font-semibold text-sm">{category.category}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {category.items.map((item) => (
                          <div key={item.name} className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                            <Badge variant="outline" className="font-mono text-xs">
                              {item.name}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{item.description}</span>
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
