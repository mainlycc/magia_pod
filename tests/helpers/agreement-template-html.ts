import { DEFAULT_AGREEMENT_TEMPLATE_HTML } from "@/lib/agreements/default-template";

/** Operacje na HTML szablonu bez DOMParser (Playwright = Node, brak window). */

export function getDefaultAgreementHtml(): string {
  return DEFAULT_AGREEMENT_TEMPLATE_HTML;
}

export function appendTableRowToHtml(html: string, label: string, value: string): string {
  const row = `  <tr>\n    <td>${label}</td>\n    <td>${value}</td>\n  </tr>\n`;
  const closeIdx = html.lastIndexOf("</table>");
  if (closeIdx === -1) {
    throw new Error("Brak </table> w HTML szablonu");
  }
  return `${html.slice(0, closeIdx)}${row}${html.slice(closeIdx)}`;
}

export function removeTableRowsMatching(html: string, pattern: RegExp): string {
  return html.replace(/<tr>[\s\S]*?<\/tr>\n?/gi, (row) => (pattern.test(row) ? "" : row));
}

export function removeTableRowsContaining(html: string, text: string): string {
  return html.replace(/<tr>[\s\S]*?<\/tr>\n?/gi, (row) => (row.includes(text) ? "" : row));
}

export function appendParagraphToHtml(html: string, title: string, marker: string): string {
  return `${html.trimEnd()}\n\n<h2>${title}</h2>\n<p>${marker}</p>\n`;
}

export function removeParagraphContaining(html: string, marker: string): string {
  if (!html.includes(marker)) return html;
  return html
    .replace(new RegExp(`<h2>[^<]*</h2>\\s*<p>[^<]*${escapeRegExp(marker)}[^<]*</p>\\s*`, "gi"), "")
    .replace(new RegExp(`<p>[^<]*${escapeRegExp(marker)}[^<]*</p>\\s*`, "gi"), "");
}

export function setFirstTableRowValue(html: string, value: string): string {
  const replaced = html.replace(
    /(<table>[\s\S]*?<tr>[\s\S]*?<td>[\s\S]*?<\/td>\s*<td>)([\s\S]*?)(<\/td>)/i,
    `$1${value}$3`,
  );
  if (replaced === html) {
    throw new Error("Nie znaleziono pierwszego wiersza tabeli w HTML");
  }
  return replaced;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
