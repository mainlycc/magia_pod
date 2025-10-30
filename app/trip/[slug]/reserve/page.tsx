"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Participant = {
  first_name: string;
  last_name: string;
  pesel: string;
  email: string;
  phone: string;
  document_type: string;
  document_number: string;
};

export default function ReservePage({
  params,
}: {
  params: { slug: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState({ street: "", city: "", zip: "" });

  const [participants, setParticipants] = useState<Participant[]>([
    {
      first_name: "",
      last_name: "",
      pesel: "",
      email: "",
      phone: "",
      document_type: "ID",
      document_number: "",
    },
  ]);

  const [consents, setConsents] = useState({ rodo: false, terms: false, conditions: false });

  const canContinue1 = useMemo(() => {
    return contactEmail.length > 3 && contactPhone.length > 5;
  }, [contactEmail, contactPhone]);

  const canContinue2 = useMemo(() => {
    return participants.every((p) => p.first_name && p.last_name && p.pesel);
  }, [participants]);

  const canContinue3 = useMemo(() => {
    return consents.rodo && consents.terms && consents.conditions;
  }, [consents]);

  const addParticipant = () => {
    setParticipants((prev) => [
      ...prev,
      { first_name: "", last_name: "", pesel: "", email: "", phone: "", document_type: "ID", document_number: "" },
    ]);
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: params.slug,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          address,
          participants,
          consents,
        }),
      });
      if (!res.ok) throw new Error("Nie udało się utworzyć rezerwacji");
      const data = await res.json();
      router.push(`/trip/${params.slug}`);
    } catch (e: any) {
      setError(e.message ?? "Błąd rezerwacji");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rezerwacja</h1>
        <Button asChild variant="ghost">
          <Link href={`/trip/${params.slug}`}>Wróć</Link>
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {step === 1 && (
        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-medium">Dane kontaktowe</h2>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Ulica</Label>
                <Input value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Miasto</Label>
                <Input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Kod</Label>
                <Input value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" asChild>
              <Link href={`/trip/${params.slug}`}>Anuluj</Link>
            </Button>
            <Button disabled={!canContinue1} onClick={() => setStep(2)}>Dalej</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-medium">Uczestnicy</h2>
          <div className="space-y-4">
            {participants.map((p, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>Imię</Label>
                  <Input value={p.first_name} onChange={(e) => {
                    const v = e.target.value; setParticipants((prev) => prev.map((pp, i) => i === idx ? { ...pp, first_name: v } : pp));
                  }} />
                </div>
                <div className="grid gap-2">
                  <Label>Nazwisko</Label>
                  <Input value={p.last_name} onChange={(e) => {
                    const v = e.target.value; setParticipants((prev) => prev.map((pp, i) => i === idx ? { ...pp, last_name: v } : pp));
                  }} />
                </div>
                <div className="grid gap-2">
                  <Label>PESEL</Label>
                  <Input value={p.pesel} onChange={(e) => {
                    const v = e.target.value; setParticipants((prev) => prev.map((pp, i) => i === idx ? { ...pp, pesel: v } : pp));
                  }} />
                </div>
                <div className="grid gap-2">
                  <Label>E-mail</Label>
                  <Input value={p.email} onChange={(e) => {
                    const v = e.target.value; setParticipants((prev) => prev.map((pp, i) => i === idx ? { ...pp, email: v } : pp));
                  }} />
                </div>
                <div className="grid gap-2">
                  <Label>Telefon</Label>
                  <Input value={p.phone} onChange={(e) => {
                    const v = e.target.value; setParticipants((prev) => prev.map((pp, i) => i === idx ? { ...pp, phone: v } : pp));
                  }} />
                </div>
                <div className="grid gap-2">
                  <Label>Dokument</Label>
                  <Input value={p.document_number} onChange={(e) => {
                    const v = e.target.value; setParticipants((prev) => prev.map((pp, i) => i === idx ? { ...pp, document_number: v } : pp));
                  }} />
                </div>
              </div>
            ))}
            <Button variant="secondary" onClick={addParticipant}>Dodaj uczestnika</Button>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Wstecz</Button>
            <Button disabled={!canContinue2} onClick={() => setStep(3)}>Dalej</Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-medium">Zgody</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <Checkbox checked={consents.rodo} onCheckedChange={(v) => setConsents((c) => ({ ...c, rodo: Boolean(v) }))} />
              <span>RODO</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={consents.terms} onCheckedChange={(v) => setConsents((c) => ({ ...c, terms: Boolean(v) }))} />
              <span>Regulamin</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={consents.conditions} onCheckedChange={(v) => setConsents((c) => ({ ...c, conditions: Boolean(v) }))} />
              <span>Warunki udziału</span>
            </label>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Wstecz</Button>
            <Button disabled={!canContinue3} onClick={() => setStep(4)}>Podgląd umowy</Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-medium">Podgląd umowy (MVP)</h2>
          <p className="text-sm text-muted-foreground">W kolejnych krokach dołączymy generowanie PDF i wysyłkę maila.</p>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>Wstecz</Button>
            <Button disabled={loading} onClick={submit}>{loading ? "Przetwarzanie..." : "Potwierdź i wyślij"}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}


