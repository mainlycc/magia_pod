import { jsPDF } from "jspdf";
import { NOTO_SANS_FAMILY, registerNotoFonts } from "@/lib/pdf/register-noto-fonts";

// Funkcja do prostego parsowania HTML i renderowania w jsPDF
function parseHtmlToPdf(html: string, doc: jsPDF, fontFamily: string): void {
  // Usuń style inline i skrypty
  let cleanHtml = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  let y = 20;
  const pageWidth = 210; // A4 width in mm
  const margin = 10;
  const contentWidth = pageWidth - 2 * margin;

  // Proste parsowanie HTML używając regex
  // Najpierw wyciągnij zawartość body jeśli istnieje
  const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    cleanHtml = bodyMatch[1];
  }

  // Parsuj nagłówki h1
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  let match;
  const h1Matches: Array<{ text: string; index: number }> = [];
  while ((match = h1Regex.exec(cleanHtml)) !== null) {
    h1Matches.push({ text: match[1].replace(/<[^>]*>/g, "").trim(), index: match.index });
  }

  // Parsuj nagłówki h2
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2Matches: Array<{ text: string; index: number }> = [];
  while ((match = h2Regex.exec(cleanHtml)) !== null) {
    h2Matches.push({ text: match[1].replace(/<[^>]*>/g, "").trim(), index: match.index });
  }

  // Parsuj tabele
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tableMatches: Array<{ content: string; index: number }> = [];
  while ((match = tableRegex.exec(cleanHtml)) !== null) {
    tableMatches.push({ content: match[1], index: match.index });
  }

  // Parsuj listy
  const ulRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  const ulMatches: Array<{ content: string; index: number }> = [];
  while ((match = ulRegex.exec(cleanHtml)) !== null) {
    ulMatches.push({ content: match[1], index: match.index });
  }

  // Parsuj paragrafy
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const pMatches: Array<{ text: string; index: number }> = [];
  while ((match = pRegex.exec(cleanHtml)) !== null) {
    pMatches.push({ text: match[1].replace(/<[^>]*>/g, "").trim(), index: match.index });
  }

  // Sortuj wszystkie elementy według pozycji w HTML
  const allElements: Array<{ type: string; index: number; data: any }> = [];
  h1Matches.forEach((m) => allElements.push({ type: "h1", index: m.index, data: m.text }));
  h2Matches.forEach((m) => allElements.push({ type: "h2", index: m.index, data: m.text }));
  tableMatches.forEach((m) => allElements.push({ type: "table", index: m.index, data: m.content }));
  ulMatches.forEach((m) => allElements.push({ type: "ul", index: m.index, data: m.content }));
  pMatches.forEach((m) => allElements.push({ type: "p", index: m.index, data: m.text }));

  allElements.sort((a, b) => a.index - b.index);

  // Renderuj elementy w kolejności
  allElements.forEach((element) => {
    if (element.type === "h1") {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(18);
      doc.setFont(fontFamily, "bold");
      const lines = doc.splitTextToSize(element.data, contentWidth);
      lines.forEach((line: string) => {
        doc.text(line, pageWidth / 2, y, { align: "center" });
        y += 10;
      });
      y += 5;
      doc.setFontSize(10);
      doc.setFont(fontFamily, "normal");
    } else if (element.type === "h2") {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.setFont(fontFamily, "bold");
      const lines = doc.splitTextToSize(element.data, contentWidth);
      lines.forEach((line: string) => {
        doc.text(line, margin, y);
        y += 8;
      });
      y += 3;
      doc.setFontSize(10);
      doc.setFont(fontFamily, "normal");
    } else if (element.type === "table") {
      // Parsuj wiersze tabeli
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      const rows: string[] = [];
      let trMatch;
      while ((trMatch = trRegex.exec(element.data)) !== null) {
        rows.push(trMatch[1]);
      }

      rows.forEach((row) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        // Parsuj komórki
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const cells: string[] = [];
        let tdMatch;
        while ((tdMatch = tdRegex.exec(row)) !== null) {
          cells.push(tdMatch[1].replace(/<[^>]*>/g, "").trim());
        }

        if (cells.length >= 2) {
          const label = cells[0];
          const value = cells[1];

          // Rysuj ramkę
          doc.rect(margin, y - 5, contentWidth, 8);

          // Label (lewa kolumna)
          doc.setFont(fontFamily, "bold");
          const labelLines = doc.splitTextToSize(label, contentWidth * 0.4);
          doc.text(labelLines, margin + 2, y);

          // Value (prawa kolumna)
          doc.setFont(fontFamily, "normal");
          const valueLines = doc.splitTextToSize(value, contentWidth * 0.55);
          doc.text(valueLines, margin + contentWidth * 0.42, y);

          y += Math.max(labelLines.length, valueLines.length) * 5 + 2;
        }
      });
      y += 3;
    } else if (element.type === "ul") {
      // Parsuj elementy listy
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      const items: string[] = [];
      let liMatch;
      while ((liMatch = liRegex.exec(element.data)) !== null) {
        items.push(liMatch[1].replace(/<[^>]*>/g, "").trim());
      }

      items.forEach((item) => {
        const text = `• ${item}`;
        const lines = doc.splitTextToSize(text, contentWidth - 5);
        lines.forEach((line: string) => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, margin + 5, y);
          y += 7;
        });
      });
      y += 3;
    } else if (element.type === "p") {
      const text = element.data;
      if (text) {
        const lines = doc.splitTextToSize(text, contentWidth);
        lines.forEach((line: string) => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, margin, y);
          y += 7;
        });
        y += 3;
      }
    }
  });

  // Jeśli nie znaleziono żadnych elementów, użyj prostego tekstu
  if (allElements.length === 0) {
    const textContent = cleanHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (textContent) {
      const lines = doc.splitTextToSize(textContent, contentWidth);
      lines.forEach((line: string) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 7;
      });
    }
  }
}

export async function generatePdfFromHtml(html: string, filename: string = "umowa.pdf"): Promise<{ base64: string; filename: string }> {
  const isDev = process.env.NODE_ENV === "development";
  const allowJspdfFallback = isDev; // w prod/Vercel nie wolno generować "uproszczonego" PDF, bo psuje układ
  const forceNoChromium = process.env.PDF_FORCE_NO_CHROMIUM === "1"; // do testów/diagnozy

  // Spróbuj użyć Playwright jeśli jest dostępny (tylko w dev)
  if (isDev && !forceNoChromium) {
    try {
      // Dynamiczny import z użyciem eval aby uniknąć sprawdzania przez TypeScript podczas kompilacji
      // Najpierw spróbuj załadować pakiet "playwright", a jeśli go nie ma,
      // spróbuj użyć "@playwright/test" (często instalowany tylko do testów)
      // eslint-disable-next-line no-eval
      let playwrightModule: any = await eval('import("playwright")').catch(() => null);
      if (!playwrightModule) {
        // eslint-disable-next-line no-eval
        playwrightModule = await eval('import("@playwright/test")').catch(() => null);
      }

      if (playwrightModule && playwrightModule.chromium) {
        const { chromium } = playwrightModule;
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        // Ustaw kodowanie UTF-8 dla poprawnego wyświetlania polskich znaków
        await page.setContent(html, { 
          waitUntil: "networkidle",
          timeout: 30000 
        });
        // Czekaj na załadowanie fontów
        await page.waitForTimeout(500);
        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
          preferCSSPageSize: false,
        });
        await browser.close();
        const base64 = Buffer.from(pdfBuffer).toString("base64");
        console.log("[generatePdfFromHtml] Render: playwright/chromium");
        return { base64, filename };
      }
    } catch (playwrightError) {
      console.warn(
        "[generatePdfFromHtml] Playwright not available:",
        playwrightError instanceof Error ? playwrightError.message : String(playwrightError),
      );
    }
  }

  // Spróbuj użyć puppeteer-core z @sparticuz/chromium (dla produkcji/Vercel)
  if (!forceNoChromium) {
    try {
    // Używamy statycznie analizowalnych dynamicznych importów (bez eval),
    // dzięki czemu Vercel/@vercel/nft poprawnie dołączy te pakiety (wraz z binarką
    // Chromium) do bundla funkcji serverless. W połączeniu z `serverExternalPackages`
    // w next.config pakiety są ładowane natywnym require w runtime.
    const puppeteerModule = await import("puppeteer-core").catch(() => null);
    const chromiumModule = await import("@sparticuz/chromium").catch(() => null);
    
    if (puppeteerModule && chromiumModule) {
      const puppeteer = puppeteerModule.default;
      const chromium = chromiumModule.default;

      // Wyłącz WebGL (niepotrzebny do PDF) — w @sparticuz/chromium v148 to setter.
      chromium.setGraphicsMode = false;

      const browser = await puppeteer.launch({
        args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
        defaultViewport: { width: 1280, height: 1024 },
        executablePath: await chromium.executablePath(),
        headless: "shell",
      });

      const page = await browser.newPage();
      // Ustaw kodowanie UTF-8 dla poprawnego wyświetlania polskich znaków
      await page.setContent(html, { 
        waitUntil: "load",
        timeout: 30000 
      });
      // Czekaj na załadowanie fontów (puppeteer-core v24 nie ma page.waitForTimeout)
      await new Promise((resolve) => setTimeout(resolve, 500));
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
        preferCSSPageSize: false,
      });
      await browser.close();
      
      const base64 = Buffer.from(pdfBuffer).toString("base64");
      console.log("[generatePdfFromHtml] Render: puppeteer/@sparticuz/chromium");
      return { base64, filename };
    }
  } catch (puppeteerError) {
    console.warn(
      "[generatePdfFromHtml] Puppeteer/Chromium not available:",
      puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError),
    );
  }
  }

  if (!allowJspdfFallback) {
    // W produkcji wolimy jawny błąd niż wysłanie klientowi źle sformatowanego PDF.
    throw new Error(
      "Brak Chromium do renderowania HTML→PDF. Na produkcji fallback jsPDF jest wyłączony (chroni przed zepsutym formatowaniem).",
    );
  }

  console.warn("[generatePdfFromHtml] Render: jsPDF fallback (dev only)");

  // Fallback (dev only): użyj jsPDF z parsowaniem HTML
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let pdfFont = "helvetica";
  try {
    registerNotoFonts(doc);
    pdfFont = NOTO_SANS_FAMILY;
  } catch (e) {
    console.warn("[generatePdfFromHtml] Brak Noto Sans (pnpm run download-fonts):", e);
  }

  doc.setFont(pdfFont, "normal");
  doc.setFontSize(10);

  // Parsuj i renderuj HTML
  try {
    console.log("[generatePdfFromHtml] Parsing HTML to PDF (jsPDF), HTML length:", html.length);
    parseHtmlToPdf(html, doc, pdfFont);
    console.log("[generatePdfFromHtml] HTML parsed successfully (jsPDF)");
  } catch (parseError) {
    console.warn("[generatePdfFromHtml] HTML parsing failed (jsPDF), using simple text conversion:", parseError);
    // Fallback do prostego tekstu
    const textContent = html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const lines = doc.splitTextToSize(textContent, 190);
    let y = 20;
    lines.forEach((line: string) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 10, y);
      y += 7;
    });
  }

  console.log("[generatePdfFromHtml] Generating PDF buffer (jsPDF)...");
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const base64 = pdfBuffer.toString("base64");
  console.log("[generatePdfFromHtml] PDF generated successfully (jsPDF), size:", base64.length);

  return { base64, filename };
}
