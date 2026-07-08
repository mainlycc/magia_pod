"use client"

import { usePathname } from "next/navigation"

const pageTitles: Record<string, string> = {
  "/coord": "Moje wyjazdy",
  // Trip dashboard
  "/trip-dashboard": "Dashboard wycieczki",
  "/trip-dashboard/informacje": "Informacje",
  "/trip-dashboard/informacje/formularz": "Formularz zgłoszeń",
  "/trip-dashboard/publiczny-wyglad": "Publiczny wygląd",
  "/trip-dashboard/rezerwacje": "Rezerwacje i umowy",
  "/trip-dashboard/umowa": "Wzór umowy",
  "/trip-dashboard/platnosci": "Płatności",
  "/trip-dashboard/faktury": "Faktury",
  "/trip-dashboard/ubezpieczenia": "Ubezpieczenia",
  "/trip-dashboard/uczestnicy": "Uczestnicy",
  "/trip-dashboard/zaproszenia-koordynatorow": "Zaproszenia koordynatorów",
  "/trip-dashboard/komunikacja-masowa": "Komunikacja masowa",
  "/trip-dashboard/dokumentacja": "Dokumentacja wycieczki",
  "/trip-dashboard/dokumenty": "Dokumenty zgód",
  "/trip-dashboard/ubezpieczenia-globalne": "Ubezpieczenia globalne",
  "/trip-dashboard/dodaj-wycieczke": "Dodaj wycieczkę",
}

// Wzorce ścieżek z dynamicznymi segmentami
const pathPatterns: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /^\/coord\/trips\/[^/]+\/participants$/, title: "Uczestnicy" },
  { pattern: /^\/coord\/trips\/[^/]+\/message$/, title: "Wyślij wiadomość" },
]

export function PageTitle() {
  const pathname = usePathname()
  
  // Sprawdź dokładne dopasowanie
  if (pageTitles[pathname]) {
    return <h1 className="text-2xl font-semibold">{pageTitles[pathname]}</h1>
  }
  
  // Sprawdź wzorce ścieżek
  for (const { pattern, title } of pathPatterns) {
    if (pattern.test(pathname)) {
      return <h1 className="text-2xl font-semibold">{title}</h1>
    }
  }
  
  // Domyślny tytuł na podstawie sekcji
  if (pathname.startsWith("/coord")) {
    return <h1 className="text-2xl font-semibold">Panel koordynatora</h1>
  }
  if (pathname.startsWith("/trip-dashboard")) {
    return <h1 className="text-2xl font-semibold">Dashboard wycieczki</h1>
  }

  return <h1 className="text-2xl font-semibold">Panel administracyjny</h1>
}
