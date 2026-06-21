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

  it("round-trip: dodane pole tabeli jest zachowane", () => {
    const parsed = parseHtmlToTemplate(DEFAULT_AGREEMENT_TEMPLATE_HTML);
    const table = parsed.sections.find((s) => s.type === "table" && s.fields?.length);
    expect(table).toBeDefined();

    const marker = "TEST-CUSTOM-FIELD-123";
    table!.fields!.push({
      id: "field-custom-test",
      label: "TEST Etykieta:",
      value: marker,
      type: "static",
    });

    const html = templateToHtml(parsed);
    expect(html).toContain(marker);
    expect(html).toContain("TEST Etykieta:");

    const reparsed = parseHtmlToTemplate(html);
    const customField = reparsed.sections
      .flatMap((s) => (s.type === "table" ? s.fields || [] : []))
      .find((f) => f.value === marker);
    expect(customField?.label).toContain("TEST Etykieta");
  });

  it("round-trip: usunięte pole tabeli znika z HTML", () => {
    const parsed = parseHtmlToTemplate(DEFAULT_AGREEMENT_TEMPLATE_HTML);
    const marker = "TEST-REMOVE-FIELD";
    const table = parsed.sections.find((s) => s.type === "table" && s.fields?.length);
    table!.fields!.push({
      id: "field-to-remove",
      label: "Do usunięcia:",
      value: marker,
      type: "static",
    });

    const withField = templateToHtml(parsed);
    expect(withField).toContain(marker);

    table!.fields = table!.fields!.filter((f) => f.value !== marker);
    const withoutField = templateToHtml(parsed);
    expect(withoutField).not.toContain(marker);
  });

  it("round-trip: dodany paragraf jest zachowany", () => {
    const parsed = parseHtmlToTemplate(DEFAULT_AGREEMENT_TEMPLATE_HTML);
    const marker = "PARAGRAF-TEST-MARKER";
    parsed.sections.push({
      id: "section-para-test",
      title: "Sekcja testowa",
      type: "paragraph",
      order: parsed.sections.length,
      content: `<p>${marker}</p>`,
    });

    const html = templateToHtml(parsed);
    expect(html).toContain(marker);

    const reparsed = parseHtmlToTemplate(html);
    const para = reparsed.sections.find((s) => (s.content || "").includes(marker));
    expect(para?.type).toBe("paragraph");
  });
});
