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

  it("round-trip: paragraf z tytułem H2 i treścią jest zachowany", () => {
    const marker = "TRESC-PARAGRAFU-TEST";
    const html = `<h1>UMOWA</h1>
<h2>Nagłówek sekcji</h2>
<p>${marker}</p>`;

    const parsed = parseHtmlToTemplate(html);
    const section = parsed.sections.find((s) => s.title === "Nagłówek sekcji");

    expect(section?.type).toBe("paragraph");
    expect(section?.content).toContain(marker);

    const roundTripped = templateToHtml(parsed);
    expect(roundTripped).toContain("Nagłówek sekcji");
    expect(roundTripped).toContain(marker);

    const reparsed = parseHtmlToTemplate(roundTripped);
    const sectionAgain = reparsed.sections.find((s) => s.title === "Nagłówek sekcji");
    expect(sectionAgain?.content).toContain(marker);
  });

  it("round-trip: sam tytuł H2 bez treści daje edytowalny paragraf", () => {
    const html = `<h1>UMOWA</h1>
<h2>Tylko tytuł</h2>`;

    const parsed = parseHtmlToTemplate(html);
    const section = parsed.sections.find((s) => s.title === "Tylko tytuł");

    expect(section?.type).toBe("paragraph");
    expect(section?.content ?? "").toBe("");
  });

  it("round-trip: wiele akapitów pod jednym H2 zostaje w jednej sekcji", () => {
    const html = `<h1>UMOWA</h1>
<h2>Warunki</h2>
<p>Akapit pierwszy.</p>
<p>Akapit drugi.</p>`;

    const parsed = parseHtmlToTemplate(html);
    const sectionsWithTitle = parsed.sections.filter((s) => s.title === "Warunki");

    expect(sectionsWithTitle).toHaveLength(1);
    expect(sectionsWithTitle[0]?.content).toContain("Akapit pierwszy");
    expect(sectionsWithTitle[0]?.content).toContain("Akapit drugi");
  });

  it("round-trip: wiele akapitów bez H2 zostaje w jednej sekcji", () => {
    const html = `<h1>UMOWA</h1>
<p>Akapit pierwszy.</p>
<p>Akapit drugi.</p>`;

    const parsed = parseHtmlToTemplate(html);
    const paragraphSections = parsed.sections.filter((s) => s.type === "paragraph");

    expect(paragraphSections).toHaveLength(1);
    expect(paragraphSections[0]?.content).toContain("Akapit pierwszy");
    expect(paragraphSections[0]?.content).toContain("Akapit drugi");
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

  it("round-trip: nowy paragraf bez tytułu obok bloku page-break nie jest wchłaniany", () => {
    // Odwzorowanie zachowania UI: 'Dodaj paragraf' tworzy sekcję z pustym tytułem.
    const parsed = parseHtmlToTemplate(DEFAULT_AGREEMENT_TEMPLATE_HTML);
    const marker = "NOWY-AKAPIT-BEZ-TYTULU";
    parsed.sections.push({
      id: "section-new-para",
      title: "",
      type: "paragraph",
      order: parsed.sections.length,
      content: `<p>${marker}</p>`,
    });

    const html = templateToHtml(parsed);
    expect(html).toContain(marker);

    const reparsed = parseHtmlToTemplate(html);
    const para = reparsed.sections.find((s) => (s.content || "").includes(marker));

    // Musi pozostać osobną, edytowalną sekcją (nie scaloną z page-break / załącznikiem).
    expect(para).toBeDefined();
    expect(para?.type).toBe("paragraph");
    expect((para?.content || "").includes("page-break-before")).toBe(false);
    expect((para?.content || "").toLowerCase().includes("imprezy samolotowe")).toBe(false);
  });

  it("round-trip: akapit przed podpisem nie scala się z blokiem podpisu", () => {
    const html = `<h1>UMOWA</h1>
<p>Moja dodatkowa klauzula.</p>
<p>................................<br/>Podpis Klienta</p>`;

    const parsed = parseHtmlToTemplate(html);
    const klauzula = parsed.sections.find((s) =>
      (s.content || "").includes("Moja dodatkowa klauzula"),
    );
    const podpis = parsed.sections.find((s) =>
      (s.content || "").toLowerCase().includes("podpis klienta"),
    );

    expect(klauzula).toBeDefined();
    expect(podpis).toBeDefined();
    expect(klauzula?.id).not.toBe(podpis?.id);
  });
});
