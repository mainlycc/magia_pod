import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { readFileSync } from "fs";
import { join } from "path";

type PdfPayload = {
  booking_ref: string;
  trip: { title: string; start_date?: string | null; end_date?: string | null; price_cents?: number | null };
  contact_email: string;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_phone?: string | null;
  address?: {
    street: string;
    city: string;
    zip: string;
  } | null;
  company_name?: string | null;
  company_nip?: string | null;
  company_address?: {
    street: string;
    city: string;
    zip: string;
  } | null;
  participants: Array<{
    first_name: string;
    last_name: string;
    pesel: string;
    email?: string;
    phone?: string;
    document_type?: string;
    document_number?: string;
  }>;
};

// Rejestracja czcionki Noto Sans - obsługuje polskie znaki diakrytyczne
let fontRegistered = false;
let useCustomFont = false;

async function registerFont() {
  if (fontRegistered) return useCustomFont;
  
  try {
    // Ścieżka do folderu z czcionkami
    const fontPath = join(process.cwd(), "public", "fonts");
    const normalFontPath = join(fontPath, "NotoSans-Regular.ttf");
    const boldFontPath = join(fontPath, "NotoSans-Bold.ttf");
    
    // Sprawdź czy pliki istnieją
    try {
      // Wczytaj pliki jako Buffer i przekonwertuj na base64
      const normalFont = readFileSync(normalFontPath);
      const boldFont = readFileSync(boldFontPath);
      
      const normalBase64 = normalFont.toString("base64");
      const boldBase64 = boldFont.toString("base64");
      
      // Użyj base64 jako data URL - react-pdf powinien to obsłużyć
      Font.register({
        family: "NotoSans",
        fonts: [
          {
            src: `data:font/ttf;base64,${normalBase64}`,
            fontWeight: "normal",
          },
          {
            src: `data:font/ttf;base64,${boldBase64}`,
            fontWeight: "bold",
          },
        ],
      });
      
      useCustomFont = true;
      fontRegistered = true;
      console.log("Font Noto Sans registered successfully from local files");
      return true;
    } catch (fileError) {
      // Jeśli lokalne pliki nie istnieją, użyj Helvetica jako fallback
      console.warn("Local font files not found. Please download Noto Sans fonts to public/fonts/ folder.");
      console.warn("Falling back to Helvetica (may not support all Polish characters).");
      useCustomFont = false;
      fontRegistered = true; // Oznacz jako zarejestrowane, żeby nie próbować ponownie
      return false;
    }
  } catch (error) {
    console.error("Font registration error, falling back to Helvetica:", error);
    useCustomFont = false;
    fontRegistered = true;
    return false;
  }
}

// Dane firmy organizującej (stałe)
const ORGANIZER_DATA = {
  name: "Magia Podróżowania GRUPA DE-PL",
  address: "Szczepankowo 37, 61-311 Poznań",
  nip: "6981710393",
};

// Funkcja tworząca StyleSheet z odpowiednią czcionką
function createStyles(fontFamily: string) {
  return StyleSheet.create({
    page: {
      padding: 50,
      fontSize: 11,
      fontFamily: fontFamily,
      lineHeight: 1.6,
      color: "#000000",
    },
  header: {
    marginBottom: 30,
    textAlign: "center",
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 0,
    marginTop: 8,
  },
  section: {
    marginBottom: 20,
    marginTop: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 12,
    marginTop: 8,
    textDecoration: "underline",
  },
  paragraph: {
    marginBottom: 10,
    textAlign: "justify",
    lineHeight: 1.6,
  },
  row: {
    flexDirection: "row",
    marginBottom: 8,
    paddingVertical: 2,
  },
  label: {
    fontWeight: "bold",
    width: 140,
    minWidth: 140,
  },
  value: {
    flex: 1,
  },
  table: {
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#000000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 30,
  },
  tableHeader: {
    backgroundColor: "#e8e8e8",
    fontWeight: "bold",
    fontSize: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
  },
  tableCell: {
    flex: 2,
    fontSize: 10,
    paddingHorizontal: 4,
  },
  tableCellSmall: {
    flex: 1,
    fontSize: 10,
    paddingHorizontal: 4,
    minWidth: 50,
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: "#000000",
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 50,
    gap: 30,
  },
  signatureBox: {
    width: "45%",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#000000",
    marginTop: 50,
    paddingTop: 5,
    minHeight: 50,
  },
  small: {
    fontSize: 9,
    color: "#333333",
  },
  bold: {
    fontWeight: "bold",
  },
  });
}

// Domyślne style z Helvetica (fallback)
const defaultStyles = createStyles("Helvetica");

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function AgreementDoc({ data, styles }: { data: PdfPayload; styles: ReturnType<typeof createStyles> }) {
  const price = data.trip.price_cents ? (data.trip.price_cents / 100).toFixed(2) : "-";
  const totalPrice = data.trip.price_cents
    ? ((data.trip.price_cents * data.participants.length) / 100).toFixed(2)
    : "-";
  const clientName = [data.contact_first_name, data.contact_last_name]
    .filter(Boolean)
    .join(" ") || "Klient";
  const clientAddress = data.address
    ? `${data.address.street}, ${data.address.zip} ${data.address.city}`
    : "-";
  const hasCompany = !!(data.company_name || data.company_nip);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Nagłówek */}
        <View style={styles.header}>
          <Text style={styles.title}>Umowa uczestnictwa w wycieczce</Text>
          <Text style={styles.subtitle}>Kod rezerwacji: {data.booking_ref}</Text>
        </View>

        {/* Strony umowy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>§ 1. Strony umowy</Text>
          
          <View style={styles.paragraph}>
            <Text style={styles.bold}>1. Organizator:</Text>
            <Text>{"\n"}   {ORGANIZER_DATA.name}</Text>
            <Text>{"\n"}   Adres: {ORGANIZER_DATA.address}</Text>
            <Text>{"\n"}   NIP: {ORGANIZER_DATA.nip}</Text>
          </View>

          <View style={styles.paragraph}>
            <Text style={styles.bold}>2. Klient:</Text>
            <Text>{"\n"}   {clientName}</Text>
            {data.address && (
              <>
                <Text>{"\n"}   Adres: {clientAddress}</Text>
              </>
            )}
            <Text>{"\n"}   E-mail: {data.contact_email}</Text>
            {data.contact_phone && <Text>{"\n"}   Telefon: {data.contact_phone}</Text>}
          </View>

          {hasCompany && (
            <View style={styles.paragraph}>
              <Text style={styles.bold}>3. Firma klienta:</Text>
              {data.company_name && <Text>{"\n"}   Nazwa: {data.company_name}</Text>}
              {data.company_nip && <Text>{"\n"}   NIP: {data.company_nip}</Text>}
              {data.company_address && (
                <Text>
                  {"\n"}   Adres: {data.company_address.street}, {data.company_address.zip}{" "}
                  {data.company_address.city}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Przedmiot umowy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>§ 2. Przedmiot umowy</Text>
          <View style={styles.paragraph}>
            <Text>
              Organizator zobowiązuje się do zorganizowania i przeprowadzenia wycieczki, a Klient
              zobowiązuje się do uiszczenia należnej opłaty za uczestnictwo w wycieczce.
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Nazwa wycieczki:</Text>
            <Text style={styles.value}>{data.trip.title}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Termin wycieczki:</Text>
            <Text style={styles.value}>
              {formatDate(data.trip.start_date)} – {formatDate(data.trip.end_date)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Cena za osobę:</Text>
            <Text style={styles.value}>{price} PLN</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Liczba uczestników:</Text>
            <Text style={styles.value}>{data.participants.length}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Cena całkowita:</Text>
            <Text style={styles.value}>
              <Text style={styles.bold}>{totalPrice} PLN</Text>
            </Text>
          </View>
        </View>

        {/* Uczestnicy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>§ 3. Uczestnicy wycieczki</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCellSmall, styles.bold, { textAlign: "center" }]}>Lp.</Text>
              <Text style={[styles.tableCell, styles.bold]}>Imię i nazwisko</Text>
              <Text style={[styles.tableCellSmall, styles.bold, { textAlign: "center" }]}>PESEL</Text>
              <Text style={[styles.tableCellSmall, styles.bold]}>Dokument</Text>
            </View>
            {data.participants.map((p, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCellSmall, { textAlign: "center" }]}>{i + 1}</Text>
                <Text style={styles.tableCell}>
                  {p.first_name} {p.last_name}
                </Text>
                <Text style={[styles.tableCellSmall, { textAlign: "center" }]}>{p.pesel}</Text>
                <Text style={styles.tableCellSmall}>
                  {p.document_type && p.document_number
                    ? `${p.document_type}: ${p.document_number}`
                    : "-"}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Page>

      {/* Druga strona - warunki i podpisy */}
      <Page size="A4" style={styles.page}>
        {/* Warunki uczestnictwa */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>§ 4. Warunki uczestnictwa</Text>
          <View style={styles.paragraph}>
            <Text>
              1. Klient zobowiązuje się do uiszczenia pełnej opłaty za wycieczkę zgodnie z
              warunkami płatności określonymi przez Organizatora.
            </Text>
          </View>
          <View style={styles.paragraph}>
            <Text>
              2. Klient potwierdza, że zapoznał się z regulaminem wycieczki i warunkami
              uczestnictwa oraz akceptuje je w całości.
            </Text>
          </View>
          <View style={styles.paragraph}>
            <Text>
              3. Klient zobowiązuje się do przestrzegania przepisów bezpieczeństwa oraz
              regulaminu wycieczki podczas całego trwania imprezy.
            </Text>
          </View>
          <View style={styles.paragraph}>
            <Text>
              4. Organizator zobowiązuje się do zapewnienia uczestnikom wycieczki odpowiednich
              warunków zgodnie z programem wycieczki.
            </Text>
          </View>
          <View style={styles.paragraph}>
            <Text>
              5. Wszelkie zmiany w programie wycieczki mogą być wprowadzone wyłącznie za
              zgodą obu stron lub w przypadku wystąpienia siły wyższej.
            </Text>
          </View>
        </View>

        {/* Postanowienia końcowe */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>§ 5. Postanowienia końcowe</Text>
          <View style={styles.paragraph}>
            <Text>
              1. Umowa została zawarta na podstawie danych podanych przez Klienta podczas
              rezerwacji. Klient ponosi odpowiedzialność za prawdziwość i aktualność podanych danych.
            </Text>
          </View>
          <View style={styles.paragraph}>
            <Text>
              2. Klient potwierdza, że wyraził zgodę na przetwarzanie danych osobowych zgodnie
              z RODO oraz akceptuje regulamin i warunki uczestnictwa w wycieczce.
            </Text>
          </View>
          <View style={styles.paragraph}>
            <Text>
              3. W sprawach nieuregulowanych w niniejszej umowie zastosowanie mają przepisy
              Kodeksu Cywilnego oraz przepisy dotyczące imprez turystycznych.
            </Text>
          </View>
          <View style={styles.paragraph}>
            <Text>
              4. Umowa została sporządzona w dwóch jednobrzmiących egzemplarzach, po jednym dla
              każdej ze stron.
            </Text>
          </View>
        </View>

        {/* Podpisy */}
        <View style={styles.footer}>
          <View style={styles.paragraph}>
            <Text style={styles.small}>
              Data wygenerowania umowy: {new Date().toLocaleDateString("pl-PL", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBox}>
              <Text style={[styles.bold, { marginBottom: 5 }]}>Podpis Organizatora</Text>
              <View style={styles.signatureLine}>
                <Text style={styles.small}>{ORGANIZER_DATA.name}</Text>
              </View>
            </View>
            <View style={styles.signatureBox}>
              <Text style={[styles.bold, { marginBottom: 5 }]}>Podpis Klienta</Text>
              <View style={styles.signatureLine}>
                <Text style={styles.small}>{clientName}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

async function pdfBufferFromData(data: PdfPayload): Promise<Buffer> {
  // Zarejestruj czcionkę przed renderowaniem
  const fontAvailable = await registerFont();
  
  // Użyj odpowiedniego StyleSheet w zależności od dostępności czcionki
  const styles = fontAvailable ? createStyles("NotoSans") : defaultStyles;
  
  const stream = await renderToStream(<AgreementDoc data={data} styles={styles} />);
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
    if (
      !body?.booking_ref ||
      !body?.trip?.title ||
      !Array.isArray(body?.participants) ||
      !body?.contact_email
    ) {
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
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "PDF generation failed", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}


