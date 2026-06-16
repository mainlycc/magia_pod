import { describe, expect, it } from "@jest/globals";
import { DEFAULT_AGREEMENT_TEMPLATE_HTML } from "@/lib/agreements/default-template";
import { parseHtmlToTemplate, templateToHtml } from "@/lib/agreement-template-parser";

describe("agreement-template-parser round-trip", () => {
  it("zachowuje dwie osobne tabele z domyślnego szablonu", () => {
    const parsed = parseHtmlToTemplate(DEFAULT_AGREEMENT_TEMPLATE_HTML);
    const tableSections = parsed.sections.filter((s) => s.type === "table");

    expect(tableSections.length).toBeGreaterThanOrEqual(2);

    const tripInfoTable = tableSections.find((s) =>
      s.fields?.some((f) => f.value.includes("{{trip_title}}")),
    );
    const pricingTable = tableSections.find((s) =>
      s.fields?.some((f) => f.value.includes("{{trip_total_price}}")),
    );

    expect(tripInfoTable).toBeDefined();
    expect(pricingTable).toBeDefined();
    expect(tripInfoTable?.id).not.toBe(pricingTable?.id);
  });

  it("round-trip zachowuje dodany paragraf", () => {
    const html = `<h1>UMOWA TEST</h1>
<h2>Sekcja testowa</h2>
<p>Treść paragrafu testowego.</p>`;

    const parsed = parseHtmlToTemplate(html);
    const roundTripped = templateToHtml(parsed);

    expect(roundTripped).toContain("UMOWA TEST");
    expect(roundTripped).toContain("Sekcja testowa");
    expect(roundTripped).toContain("Treść paragrafu testowego.");
  });

  it("round-trip zachowuje wartość statyczną w tabeli", () => {
    const html = `<h1>UMOWA</h1>
<h2>Dane</h2>
<table>
  <tr><td>Pokój:</td><td>Pokój 2-osobowy deluxe</td></tr>
</table>`;

    const parsed = parseHtmlToTemplate(html);
    const field = parsed.sections.find((s) => s.type === "table")?.fields?.[0];

    expect(field?.value).toContain("Pokój 2-osobowy deluxe");

    const roundTripped = templateToHtml(parsed);
    expect(roundTripped).toContain("Pokój 2-osobowy deluxe");
  });
});
