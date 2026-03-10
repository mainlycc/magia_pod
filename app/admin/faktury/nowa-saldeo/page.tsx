"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Loader2, CheckCircle, XCircle, Download, ExternalLink } from "lucide-react";

interface Contractor {
  contractorId: string;
  shortName: string;
  fullName?: string;
  nip?: string;
  city?: string;
  inactive?: boolean;
}

interface InvoiceItemForm {
  name: string;
  amount: string;
  unit: string;
  unitValue: string;
  rate: string;
}

const VAT_RATES = ["23", "8", "5", "0", "ZW", "NP"];
const PAYMENT_TYPES = [
  { value: "TRANSFER", label: "Przelew" },
  { value: "CASH", label: "Gotowka" },
  { value: "CARD", label: "Karta" },
  { value: "PREPAYMENT", label: "Przedplata" },
  { value: "OTHER", label: "Inna" },
];

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export default function NowaSaldeoPage() {
  const router = useRouter();

  // Stan kontrahentow
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loadingContractors, setLoadingContractors] = useState(true);
  const [contractorsError, setContractorsError] = useState<string | null>(null);

  // Dane faktury
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(todayDate());
  const [saleDate, setSaleDate] = useState(todayDate());
  const [selectedContractor, setSelectedContractor] = useState<string>("");
  const [currency, setCurrency] = useState("PLN");
  const [paymentType, setPaymentType] = useState("TRANSFER");
  const [dueDate, setDueDate] = useState("");
  const [calcFromGross, setCalcFromGross] = useState(false);
  const [issuePerson, setIssuePerson] = useState("");

  // Pozycje
  const [items, setItems] = useState<InvoiceItemForm[]>([
    { name: "", amount: "1", unit: "szt.", unitValue: "", rate: "23" },
  ]);

  // Wyslanie
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  // PDF
  const [fetchingPdf, setFetchingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Pobierz kontrahentow z Saldeo
  useEffect(() => {
    async function loadContractors() {
      setLoadingContractors(true);
      setContractorsError(null);
      try {
        const res = await fetch("/api/saldeo/contractors");
        const data = await res.json();
        if (data.success && data.contractors) {
          setContractors(data.contractors.filter((c: Contractor) => !c.inactive));
        } else {
          setContractorsError(data.error || "Nie udalo sie pobrac kontrahentow");
        }
      } catch (err) {
        setContractorsError(err instanceof Error ? err.message : "Blad sieci");
      } finally {
        setLoadingContractors(false);
      }
    }
    loadContractors();
  }, []);

  const addItem = () => {
    setItems([...items, { name: "", amount: "1", unit: "szt.", unitValue: "", rate: "23" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItemForm, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async () => {
    // Walidacja
    if (!invoiceNumber.trim()) {
      toast.error("Wpisz numer faktury");
      return;
    }
    if (!selectedContractor) {
      toast.error("Wybierz kontrahenta");
      return;
    }
    if (!issueDate || !saleDate) {
      toast.error("Uzupelnij daty");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name || !item.amount || !item.unit || !item.unitValue) {
        toast.error("Uzupelnij wszystkie pola pozycji " + (i + 1));
        return;
      }
    }

    setSending(true);
    setResult(null);

    try {
      const payload = {
        NUMBER: invoiceNumber.trim(),
        issueDate,
        saleDate,
        purchaserContractorId: Number(selectedContractor),
        currencyIso4217: currency,
        paymentType,
        dueDate: dueDate || undefined,
        calculatedFromGross: calcFromGross,
        issuePerson: issuePerson || undefined,
        items: items.map((item) => ({
          name: item.name,
          amount: Number(item.amount),
          unit: item.unit,
          unitValue: Number(item.unitValue),
          rate: item.rate || undefined,
        })),
      };

      const res = await fetch("/api/saldeo/invoice/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        toast.success("Faktura wystawiona w SaldeoSMART! ID: " + (data.invoiceId || "brak"));
      } else {
        toast.error("Blad: " + (data.error || "nieznany"));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Blad sieci";
      setResult({ success: false, error: msg });
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleFetchPdf = async (saldeoInvoiceId: string) => {
    setFetchingPdf(true);
    setPdfError(null);
    setPdfUrl(null);
    try {
      const res = await fetch(
        "/api/saldeo/invoice/pdf-by-saldeo-id?saldeo_id=" + encodeURIComponent(saldeoInvoiceId)
      );
      const data = await res.json();
      if (data.success && data.pdfUrl) {
        setPdfUrl(data.pdfUrl);
        toast.success("Link do PDF gotowy!");
      } else {
        const errMsg = data.error || "Nie udalo sie pobrac PDF";
        setPdfError(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Blad sieci";
      setPdfError(msg);
      toast.error(msg);
    } finally {
      setFetchingPdf(false);
    }
  };

  // Oblicz podsumowanie
  const totalNetto = items.reduce((sum, item) => {
    const val = Number(item.unitValue) || 0;
    const amt = Number(item.amount) || 0;
    return sum + val * amt;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Naglowek */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/admin/faktury")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Wstecz
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Wystaw fakture w SaldeoSMART</h1>
          <p className="text-muted-foreground text-sm">
            Testowe wystawianie faktury bezposrednio przez API
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lewa kolumna - formularz */}
        <div className="lg:col-span-2 space-y-6">
          {/* Kontrahent */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Kontrahent (nabywca)</CardTitle>
              <CardDescription>
                Kontrahent musi istniec w SaldeoSMART. Lista jest pobierana z API.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingContractors ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pobieranie kontrahentow z Saldeo...
                </div>
              ) : contractorsError ? (
                <Alert variant="destructive">
                  <AlertDescription>{contractorsError}</AlertDescription>
                </Alert>
              ) : contractors.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Brak kontrahentow w SaldeoSMART. Dodaj kontrahenta w panelu Saldeo.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <Label>Kontrahent *</Label>
                  <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz kontrahenta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {contractors.map((c) => (
                        <SelectItem key={c.contractorId} value={c.contractorId}>
                          {c.shortName}
                          {c.nip ? " (NIP: " + c.nip + ")" : ""}
                          {c.city ? " - " + c.city : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Znaleziono {contractors.length} kontrahentow
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daty i platnosc */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dane faktury</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>Numer faktury *</Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="np. FV/2026/03/001"
                  />
                  <p className="text-xs text-muted-foreground">
                    Unikalny numer faktury w formacie Twojej firmy
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Data wystawienia *</Label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data sprzedazy *</Label>
                  <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Termin platnosci</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    placeholder="Puste = zgodnie z umowa"
                  />
                  <p className="text-xs text-muted-foreground">
                    Puste = &quot;zgodnie z umowa&quot;
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Typ platnosci *</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value}>
                          {pt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Waluta *</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PLN">PLN</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Osoba wystawiajaca</Label>
                  <Input
                    value={issuePerson}
                    onChange={(e) => setIssuePerson(e.target.value)}
                    placeholder="np. Jan Kowalski"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="calcGross"
                  checked={calcFromGross}
                  onChange={(e) => setCalcFromGross(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="calcGross" className="cursor-pointer">
                  Liczone od brutto (ceny w pozycjach to ceny brutto)
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Pozycje faktury */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pozycje faktury</CardTitle>
              <CardDescription>
                Dodaj co najmniej jedna pozycje. UNIT_VALUE to cena jednostkowa netto (lub brutto jesli zaznaczono).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Pozycja {index + 1}</Badge>
                    {items.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="md:col-span-2 lg:col-span-3 space-y-1">
                      <Label>Nazwa *</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(index, "name", e.target.value)}
                        placeholder="np. Wycieczka do Berlina"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Ilosc *</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => updateItem(index, "amount", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Jednostka *</Label>
                      <Input
                        value={item.unit}
                        onChange={(e) => updateItem(index, "unit", e.target.value)}
                        placeholder="szt."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Cena jedn. *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitValue}
                        onChange={(e) => updateItem(index, "unitValue", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Stawka VAT</Label>
                      <Select value={item.rate} onValueChange={(v) => updateItem(index, "rate", v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VAT_RATES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r === "ZW" ? "ZW (zwolniony)" : r === "NP" ? "NP (nie podlega)" : r + "%"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="outline" onClick={addItem} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Dodaj pozycje
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Prawa kolumna - podsumowanie */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Podsumowanie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {invoiceNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Nr faktury:</span>
                    <span className="font-medium">{invoiceNumber}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pozycji:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {calcFromGross ? "Suma brutto:" : "Suma netto:"}
                  </span>
                  <span className="font-medium">
                    {totalNetto.toFixed(2)} {currency}
                  </span>
                </div>
                {selectedContractor && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kontrahent:</span>
                    <span className="font-medium text-right">
                      {contractors.find((c) => c.contractorId === selectedContractor)?.shortName || "-"}
                    </span>
                  </div>
                )}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={sending || !selectedContractor || !invoiceNumber.trim()}
                className="w-full"
                size="lg"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wysylanie do Saldeo...
                  </>
                ) : (
                  "Wystaw fakture"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Wynik */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  Odpowiedz Saldeo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">Status:</span>{" "}
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? "OK" : "BLAD"}
                    </Badge>
                  </p>
                  {result.invoiceId && (
                    <p className="text-sm">
                      <span className="font-medium">Invoice ID:</span> {result.invoiceId}
                    </p>
                  )}
                  {result.error && (
                    <p className="text-sm text-red-600">
                      <span className="font-medium">Blad:</span> {result.error}
                    </p>
                  )}
                </div>

                {/* PDF section */}
                {result.success && result.invoiceId && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-sm font-medium">Pobierz fakture:</p>
                    {pdfUrl ? (
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Otworz PDF faktury
                      </a>
                    ) : (
                      <div className="space-y-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFetchPdf(result.invoiceId)}
                          disabled={fetchingPdf}
                        >
                          {fetchingPdf ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Pobieranie linku PDF...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Pobierz PDF z Saldeo
                            </>
                          )}
                        </Button>
                        {pdfError && (
                          <p className="text-xs text-red-500">{pdfError}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Uwaga: PDF moze nie byc gotowy od razu. Saldeo potrzebuje chwili na wygenerowanie dokumentu.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {result.rawResponse && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Pelna odpowiedz XML
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                      {result.rawResponse}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
