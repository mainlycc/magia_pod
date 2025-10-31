"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function CoordMessagePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    const res = await fetch(`/api/trips/${params.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    if (!res.ok) setError("Błąd wysyłki");
    else router.back();
    setSending(false);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label>Temat</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Wiadomość</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
        </div>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Anuluj</Button>
        <Button disabled={sending || !subject || !body} onClick={send}>Wyślij</Button>
      </div>
    </Card>
  );
}


