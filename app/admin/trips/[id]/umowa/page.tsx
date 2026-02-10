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
