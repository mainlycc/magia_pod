import { describe, expect, it } from "@jest/globals";
import {
  isEmptyRichTextHtml,
  resolveRichTextContent,
  sanitizePastedHtml,
} from "@/lib/agreements/rich-text-html";

describe("rich-text-html", () => {
  it("isEmptyRichTextHtml: pusty paragraf TipTap", () => {
    expect(isEmptyRichTextHtml("")).toBe(true);
    expect(isEmptyRichTextHtml("<p></p>")).toBe(true);
    expect(isEmptyRichTextHtml("<p><br></p>")).toBe(true);
    expect(isEmptyRichTextHtml("<p>&nbsp;</p>")).toBe(true);
  });

  it("isEmptyRichTextHtml: tekst z formatowaniem nie jest pusty", () => {
    expect(isEmptyRichTextHtml("<p>Treść umowy</p>")).toBe(false);
    expect(isEmptyRichTextHtml("<p><strong>Ważne</strong></p>")).toBe(false);
  });

  it("resolveRichTextContent: preferuje niepusty edytor, potem stan", () => {
    expect(resolveRichTextContent("<p>ze stanu</p>", "<p></p>")).toBe("<p>ze stanu</p>");
    expect(resolveRichTextContent("", "<p>z edytora</p>")).toBe("<p>z edytora</p>");
    expect(resolveRichTextContent("<p>stan</p>", "<p>edytor</p>")).toBe("<p>edytor</p>");
  });

  it("sanitizePastedHtml: usuwa style Worda", () => {
    const dirty =
      '<p class="MsoNormal" style="margin:0cm"><span style="font-weight:bold">Tekst</span></p>';
    const clean = sanitizePastedHtml(dirty);
    expect(clean).not.toContain("style=");
    expect(clean).not.toContain("class=");
    expect(clean).toContain("Tekst");
  });
});
