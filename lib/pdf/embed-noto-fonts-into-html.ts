import { existsSync, readFileSync } from "fs";
import { join } from "path";

function readFontBase64OrNull(filename: string): string | null {
  const p = join(process.cwd(), "public", "fonts", filename);
  if (!existsSync(p)) return null;
  const buf = readFileSync(p);
  if (buf.length < 4096) return null;
  return buf.toString("base64");
}

/**
 * Wstrzykuje Noto Sans (@font-face z base64) do HTML.
 * Cel: identyczny rendering na Vercel/Chromium niezależnie od dostępnych fontów systemowych.
 */
export function embedNotoSansIntoHtml(html: string): { html: string; embedded: boolean } {
  const regular = readFontBase64OrNull("NotoSans-Regular.ttf");
  const bold = readFontBase64OrNull("NotoSans-Bold.ttf");
  if (!regular || !bold) {
    return { html, embedded: false };
  }

  const style = `<style>
@font-face {
  font-family: "Noto Sans Embedded";
  src: url(data:font/ttf;base64,${regular}) format("truetype");
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: "Noto Sans Embedded";
  src: url(data:font/ttf;base64,${bold}) format("truetype");
  font-weight: 700;
  font-style: normal;
}
html, body, * {
  font-family: "Noto Sans Embedded", Arial, "DejaVu Sans", "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif !important;
}
</style>`;

  // Najbezpieczniej wkleić tuż przed </head> jeśli istnieje, inaczej na początek.
  if (/<\/head>/i.test(html)) {
    return { html: html.replace(/<\/head>/i, `${style}</head>`), embedded: true };
  }
  return { html: `${style}${html}`, embedded: true };
}

