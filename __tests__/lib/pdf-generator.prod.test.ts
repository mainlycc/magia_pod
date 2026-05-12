import { describe, it, expect, beforeEach } from "@jest/globals";

import { generatePdfFromHtml } from "@/lib/pdf-generator";

describe("generatePdfFromHtml (production guards)", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.PDF_FORCE_NO_CHROMIUM = "1";
  });

  it("powinien zwrócić błąd w produkcji, jeśli Chromium nie jest dostępny (bez fallbacku jsPDF)", async () => {
    await expect(generatePdfFromHtml("<html><head></head><body><h1>Test</h1></body></html>", "test.pdf")).rejects.toThrow(
      /Brak Chromium do renderowania HTML→PDF/i,
    );
  });
});

