import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createAdminClient } from "@/lib/supabase/admin";

type PdfPayload = {
  booking_ref: string;
  trip: { title: string; start_date?: string | null; end_date?: string | null; price_cents?: number | null };
  contact_email: string;
  participants: Array<{
    first_name: string;
    last_name: string;
    pesel: string;
    email?: string;
  }>;
};

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 12 },
  h1: { fontSize: 18, marginBottom: 12 },
  section: { marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  small: { fontSize: 10, color: "#444" },
});

function AgreementDoc({ data }: { data: PdfPayload }) {
  const price = data.trip.price_cents ? (data.trip.price_cents / 100).toFixed(2) : "-";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Umowa uczestnictwa — {data.trip.title}</Text>
        <View style={styles.section}>
          <Text>Kod rezerwacji: {data.booking_ref}</Text>
          <Text>Email kontaktowy: {data.contact_email}</Text>
          <Text>Termin: {data.trip.start_date ?? "-"} — {data.trip.end_date ?? "-"}</Text>
          <Text>Cena: {price} PLN</Text>
        </View>
        <View style={styles.section}>
          <Text>Uczestnicy:</Text>
          {data.participants.map((p, i) => (
            <View key={i} style={styles.row}>
              <Text>
                {i + 1}. {p.first_name} {p.last_name}
              </Text>
              <Text style={styles.small}>PESEL: {p.pesel}</Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.small}>Zgody RODO i regulaminy zostały zaakceptowane podczas rezerwacji.</Text>
        </View>
      </Page>
    </Document>
  );
}

async function pdfBufferFromData(data: PdfPayload): Promise<Buffer> {
  const stream = await renderToStream(<AgreementDoc data={data} />);
  const chunks: Uint8Array[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve());
    stream.on("error", (err) => reject(err));
  });
  return Buffer.concat(chunks);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PdfPayload;
    if (!body?.booking_ref || !body?.trip?.title || !Array.isArray(body?.participants)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const buf = await pdfBufferFromData(body);

    // Upload do Supabase Storage (agreements/<booking_ref>.pdf)
    const supabaseAdmin = createAdminClient();
    const { error: upErr } = await supabaseAdmin.storage
      .from("agreements")
      .upload(`${body.booking_ref}.pdf`, buf, { contentType: "application/pdf", upsert: true });

    if (upErr) {
      // jeśli nie uda się upload, i tak zwróć PDF base64, żeby e-mail mógł pójść
      const base64 = buf.toString("base64");
      return NextResponse.json({ base64, filename: `${body.booking_ref}.pdf` });
    }

    // Zapisz URL w bookings (przechowuj ścieżkę, generuj signed URL na żądanie)
    await supabaseAdmin
      .from("bookings")
      .update({ agreement_pdf_url: `${body.booking_ref}.pdf` })
      .eq("booking_ref", body.booking_ref);

    const base64 = buf.toString("base64");
    return NextResponse.json({ base64, filename: `${body.booking_ref}.pdf` });
  } catch (e) {
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}


