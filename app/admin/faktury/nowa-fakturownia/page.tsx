"use client";

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";

interface InvoiceItemForm {
  name: string;
  quantity: string;
  unit: string;
  unit_price: string;
  tax: string;
}

const VAT_RATES = [
  { value: "np", label: "NP (nie podlega)" },
  { value: "zw", label: "ZW (zwolniony)" },
  { value: "0", label: "0%" },
  { value: "5", label: "5%" },
  { value: "8", label: "8%" },
  { value: "23", label: "23%" },
];

const PAYMENT_TYPES = [
  { value: "transfer", label: "Przelew" },
  { value: "cash", label: "Gotówka" },
  { value: "card", label: "Karta" },
];

const INVOICE_KINDS = [
  { value: "advance", label: "Zaliczkowa (faktura zaliczkowa)" },
  { value: "vat", label: "VAT (zwykła faktura)" },
  { value: "proforma", label: "Proforma" },
];

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export default function NowaFakturowniaPage() {
  const router = useRouter();

  // Dane faktury
  const [invoiceKind, setInvoiceKind] = useState("advance");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(todayDate());
  const [saleDate, setSaleDate] = useState(todayDate());
  const [paymentTo, setPaymentTo] = useState("");
  const [currency, setCurrency] = useState("PLN");
  const [paymentType, setPaymentType] = useState("transfer");
  const [useGross, setUseGross] = useState(true);
  const [marginProcedure, setMarginProcedure] = useState(true);

  // Dane nabywcy
  const [buyerName, setBuyerName] = useState("");
  const [buyerTaxNo, setBuyerTaxNo] = useState("");
  const [buyerStreet, setBuyerStreet] = useState("");
  const [buyerCity, setBuyerCity] = useState("");
  const [buyerPostCode, setBuyerPostCode] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  // Pozycje
  const [items, setItems] = useState<InvoiceItemForm[]>([
    { name: "", quantity: "1", unit: "szt.", unit_price: "", tax: "np" },
  ]);

  // Wysyłanie
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const addItem = () => {
    setItems([...items, { name: "", quantity: "1", unit: "szt.", unit_price: "", tax: "np" }]);
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
    if (!invoiceNumber.trim()) {
      toast.error("Wpisz numer faktury");
      return;
    }
    if (!buyerName.trim()) {
      toast.error("Wpisz nazwę nabywcy");
      return;
    }
    if (!issueDate || !saleDate) {
      toast.error("Uzupełnij daty");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name || !item.quantity || !item.unit || !item.unit_price) {
        toast.error("Uzupełnij wszystkie pola pozycji " + (i + 1));
        return;
      }
    }

    setSending(true);
    setResult(null);

    try {
      const payload = {
        kind: invoiceKind,
        number: invoiceNumber.trim(),
        issue_date: issueDate,
        sell_date: saleDate,
        payment_to: paymentTo || undefined,
        payment_type: paymentType,
        currency,
        use_gross: useGross,
        buyer_name: buyerName.trim(),
        buyer_tax_no: buyerTaxNo.trim() || undefined,
        buyer_street: buyerStreet.trim() || undefined,
        buyer_city: buyerCity.trim() || undefined,
        buyer_post_code: buyerPostCode.trim() || undefined,
        buyer_email: buyerEmail.trim() || undefined,
        margin_procedure: marginProcedure,
        margin_kind: marginProcedure ? "trip" : undefined,
        positions: items.map((item) => ({
          name: item.name,
          quantity: Number(item.quantity),
          unit: item.unit,
          unit_price: Number(item.unit_price),
          tax: item.tax,
        })),
      };

      const res = await fetch("/api/fakturownia/invoice/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        toast.success("Faktura wystawiona w Fakturownia! ID: " + (data.invoiceId || "brak"));
      } else {
        toast.error("Błąd: " + (data.error || "nieznany"));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Błąd sieci";
      setResult({ success: false, error: msg });
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const totalGross = items.reduce((sum, item) => {
    const val = Number(item.unit_price) || 0;
    const qty = Number(item.quantity) || 0;
    return sum + val * qty;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/admin/faktury")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Wstecz
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Wystaw fakturę w Fakturownia</h1>
          <p className="text-muted-foreground text-sm">
            Ręczne wystawianie faktury przez API Fakturownia
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Nabywca */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nabywca</CardTitle>
              <CardDescription>
                Dane nabywcy faktury — tworzone dynamicznie w Fakturownia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>Nazwa nabywcy *</Label>
                  <Input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="np. Jan Kowalski lub Firma Sp. z o.o."
                  />
                </div>
                <div className="space-y-2">
                  <Label>NIP</Label>
                  <Input
                    value={buyerTaxNo}
                    onChange={(e) => setBuyerTaxNo(e.target.value)}
                    placeholder="np. 1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="np. jan@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ulica</Label>
                  <Input
                    value={buyerStreet}
                    onChange={(e) => setBuyerStreet(e.target.value)}
                    placeholder="np. ul. Przykładowa 1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Kod pocztowy</Label>
                    <Input
                      value={buyerPostCode}
                      onChange={(e) => setBuyerPostCode(e.target.value)}
                      placeholder="00-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Miasto</Label>
                    <Input
                      value={buyerCity}
                      onChange={(e) => setBuyerCity(e.target.value)}
                      placeholder="Warszawa"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dane faktury */}
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
                    placeholder="np. FZal/2026/001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rodzaj faktury *</Label>
                  <Select value={invoiceKind} onValueChange={setInvoiceKind}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
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
                  <Label>Data wystawienia *</Label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data sprzedaży *</Label>
                  <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Termin płatności</Label>
                  <Input
                    type="date"
                    value={paymentTo}
                    onChange={(e) => setPaymentTo(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Puste = brak terminu</p>
                </div>
                <div className="space-y-2">
                  <Label>Forma płatności *</Label>
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
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="useGross"
                    checked={useGross}
                    onCheckedChange={(v) => setUseGross(Boolean(v))}
                  />
                  <Label htmlFor="useGross" className="cursor-pointer">
                    Ceny brutto (ceny w pozycjach to kwoty brutto)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="marginProcedure"
                    checked={marginProcedure}
                    onCheckedChange={(v) => setMarginProcedure(Boolean(v))}
                  />
                  <Label htmlFor="marginProcedure" className="cursor-pointer">
                    Procedura marży biur podróży
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pozycje */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pozycje faktury</CardTitle>
              <CardDescription>
                Dodaj co najmniej jedną pozycję. Cena jednostkowa to cena{" "}
                {useGross ? "brutto" : "netto"}.
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
                        placeholder="np. Faktura zaliczkowa - Wycieczka do Berlina"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Ilość *</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
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
                      <Label>Cena jedn. {useGross ? "brutto" : "netto"} *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Stawka VAT</Label>
                      <Select value={item.tax} onValueChange={(v) => updateItem(index, "tax", v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VAT_RATES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
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
                Dodaj pozycję
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Prawa kolumna */}
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
                {buyerName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Nabywca:</span>
                    <span className="font-medium text-right max-w-[150px] truncate">{buyerName}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pozycji:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Suma {useGross ? "brutto" : "netto"}:
                  </span>
                  <span className="font-medium">
                    {totalGross.toFixed(2)} {currency}
                  </span>
                </div>
                {marginProcedure && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Marża:</span>
                    <Badge variant="secondary" className="text-xs">Biuro podróży</Badge>
                  </div>
                )}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={sending || !buyerName.trim() || !invoiceNumber.trim()}
                className="w-full"
                size="lg"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wysyłanie do Fakturownia...
                  </>
                ) : (
                  "Wystaw fakturę"
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
                  Odpowiedź Fakturownia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">Status:</span>{" "}
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? "OK" : "BŁĄD"}
                    </Badge>
                  </p>
                  {result.invoiceId && (
                    <p className="text-sm">
                      <span className="font-medium">ID faktury:</span> {result.invoiceId}
                    </p>
                  )}
                  {result.invoiceNumber && (
                    <p className="text-sm">
                      <span className="font-medium">Numer:</span> {result.invoiceNumber}
                    </p>
                  )}
                  {result.error && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription className="text-xs">{result.error}</AlertDescription>
                    </Alert>
                  )}
                </div>

                {result.success && (result.pdfUrl || result.viewUrl) && (
                  <div className="space-y-2 pt-2 border-t">
                    {result.pdfUrl && (
                      <a
                        href={result.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors w-full justify-center"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Pobierz PDF
                      </a>
                    )}
                    {result.viewUrl && (
                      <a
                        href={result.viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted text-sm font-medium transition-colors w-full justify-center"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Podgląd faktury
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
