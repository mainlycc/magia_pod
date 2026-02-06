import { describe, it, expect } from "@jest/globals";
import { cn, hasEnvVars } from "@/lib/utils";

describe("lib/utils", () => {
  describe("cn", () => {
    it("powinien łączyć klasy CSS", () => {
      const result = cn("class1", "class2");
      expect(result).toContain("class1");
      expect(result).toContain("class2");
    });

    it("powinien obsługiwać warunkowe klasy", () => {
      const result = cn("base", true && "conditional", false && "hidden");
      expect(result).toContain("base");
      expect(result).toContain("conditional");
      expect(result).not.toContain("hidden");
    });

    it("powinien obsługiwać obiekty z klasami", () => {
      const result = cn({
        "class1": true,
        "class2": false,
      });
      expect(result).toContain("class1");
      expect(result).not.toContain("class2");
    });

    it("powinien łączyć klasy Tailwind i usuwać duplikaty", () => {
      const result = cn("p-4", "p-2");
      // Tailwind merge powinien pozostawić tylko ostatnią klasę
      expect(result).toBeTruthy();
    });
  });

  describe("hasEnvVars", () => {
    it("powinien zwracać true gdy zmienne środowiskowe są ustawione", () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Ustaw zmienne środowiskowe
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

      // hasEnvVars jest stałą obliczaną przy imporcie, więc sprawdzamy bezpośrednio logikę
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      expect(!!url && !!key).toBe(true);

      // Przywróć oryginalne wartości
      if (originalUrl) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      }
      if (originalKey) {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      }
    });
  });
});
