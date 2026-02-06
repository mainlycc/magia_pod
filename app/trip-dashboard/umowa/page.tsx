"use client";

import { useEffect, useState } from "react";
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
      { name: "{{selected_services}}", description: "Usługi dodatkowe (atrakcje, dieta, ubezpieczenie)" },
      { name: "{{insurance_scope}}", description: "Zakres ubezpieczenia" },
      { name: "{{additional_costs}}", description: "Dodatkowe koszty" },
    ],
  },
];

export default function AgreementPage() {
  const { selectedTrip, tripFullData, tripContentData, isLoadingTripData } = useTrip();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<"individual" | "company" | "both">("both");
  const [templateIndividual, setTemplateIndividual] = useState<AgreementTemplate | null>(null);
  const [templateCompany, setTemplateCompany] = useState<AgreementTemplate | null>(null);

  useEffect(() => {
    if (!selectedTrip) {
      setLoading(false);
      return;
    }

    if (!selectedTrip.id) {
      setLoading(false);
      toast.error("Brak ID wybranej wycieczki");
      return;
    }

    // Jeśli dane są już załadowane w cache, użyj ich
    if (tripFullData && tripFullData.id === selectedTrip.id) {
      setRegistrationMode((tripFullData.registration_mode as "individual" | "company" | "both") || "both");
    } else if (isLoadingTripData) {
      // Czekaj na załadowanie danych
      setLoading(true);
      return;
    }

    const loadTemplates = async () => {
      try {
        setLoading(true);
        const templatesRes = await fetch(`/api/trips/${selectedTrip.id}/agreement-templates`);

        if (templatesRes.ok) {
          const templates = await templatesRes.json();
          const htmlIndividual = templates.individual || DEFAULT_TEMPLATE;
          const htmlCompany = templates.company || DEFAULT_TEMPLATE;
          
          // Parsuj HTML do struktury danych
          setTemplateIndividual(parseHtmlToTemplate(htmlIndividual));
          setTemplateCompany(parseHtmlToTemplate(htmlCompany));
        } else {
          // Użyj domyślnego szablonu jeśli nie ma zapisanego
          setTemplateIndividual(parseHtmlToTemplate(DEFAULT_TEMPLATE));
          setTemplateCompany(parseHtmlToTemplate(DEFAULT_TEMPLATE));
        }
      } catch (err) {
        toast.error("Nie udało się wczytać szablonów");
      } finally {
        setLoading(false);
      }
    };

    void loadTemplates();
  }, [selectedTrip, tripFullData, isLoadingTripData]);

  const handleSave = async (type: "individual" | "company") => {
    if (!selectedTrip?.id) return;
    
    const template = type === "individual" ? templateIndividual : templateCompany;
    if (!template) return;

    try {
      setSaving(true);
      // Konwertuj strukturę danych z powrotem do HTML
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

  if (loading) {
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

  return (
    <div className="space-y-4">
      {/* Podgląd dokumentu */}
      {registrationMode === "both" ? (
        <Tabs defaultValue="individual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual">Podgląd - Osoba fizyczna</TabsTrigger>
            <TabsTrigger value="company">Podgląd - Firma</TabsTrigger>
          </TabsList>
          <TabsContent value="individual" className="mt-4">
            <AgreementPreview 
              template={templateIndividual} 
              tripFullData={tripFullData}
              tripContentData={tripContentData}
            />
          </TabsContent>
          <TabsContent value="company" className="mt-4">
            <AgreementPreview 
              template={templateCompany} 
              tripFullData={tripFullData}
              tripContentData={tripContentData}
            />
          </TabsContent>
        </Tabs>
      ) : registrationMode === "individual" ? (
        <AgreementPreview 
          template={templateIndividual} 
          tripFullData={tripFullData}
          tripContentData={tripContentData}
        />
      ) : (
        <AgreementPreview 
          template={templateCompany} 
          tripFullData={tripFullData}
          tripContentData={tripContentData}
        />
      )}

      {/* Edytor */}
      <Card className="p-4">
        <CardHeader className="px-0 pb-2">
          <CardTitle>Edytor szablonu umowy</CardTitle>
          <p className="text-sm text-muted-foreground">
            Edytuj szablon umowy dla wycieczki. Przeciągnij sekcje, aby zmienić ich kolejność. Użyj placeholderów w formacie {"{{placeholder_name}}"} aby wstawić dane z formularza i wycieczki.
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
                          <div key={item.name} className="flex items-start gap-1.5 p-1.5 bg-muted/50 rounded text-xs">
                            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                              {item.name}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{item.description}</span>
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
