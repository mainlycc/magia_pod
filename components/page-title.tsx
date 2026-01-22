"use client"

import { usePathname } from "next/navigation"

const pageTitles: Record<string, string> = {
  "/admin": "Podsumowanie",
  "/admin/trips": "Wycieczki",
  "/admin/bookings": "Rezerwacje i Umowy",
  "/admin/payments": "Płatności",
  "/admin/faktury": "Faktury",
  "/admin/uczestnicy": "Uczestnicy",
  "/admin/koordynatorzy": "Koordynatorzy",
  "/admin/insurance": "Ubezpieczenia",
  "/admin/coordinators/invite": "Zaproszenia koordynatorów",
  "/admin/komunikacja-masowa": "Komunikacja masowa",
  "/admin/przyklad": "Przykład",
  "/coord": "Moje wyjazdy",
  // Trip dashboard
  "/trip-dashboard": "Dashboard wycieczki",
  "/trip-dashboard/informacje": "Informacje",
  "/trip-dashboard/informacje/formularz": "Formularz zgłoszeń",
  "/trip-dashboard/publiczny-wyglad": "Publiczny wygląd",
  "/trip-dashboard/rezerwacje": "Rezerwacje i umowy",
  "/trip-dashboard/platnosci": "Płatności",
  "/trip-dashboard/faktury": "Faktury",
  "/trip-dashboard/ubezpieczenia": "Ubezpieczenia",
  "/trip-dashboard/uczestnicy": "Uczestnicy",
  "/trip-dashboard/zaproszenia-koordynatorow": "Zaproszenia koordynatorów",
  "/trip-dashboard/komunikacja-masowa": "Komunikacja masowa",
  "/trip-dashboard/dokumentacja": "Dokumentacja wycieczki",
  "/trip-dashboard/dokumenty": "Dokumenty zgód",
  "/trip-dashboard/dodaj-wycieczke": "Dodaj wycieczkę",
}

// Wzorce ścieżek z dynamicznymi segmentami
const pathPatterns: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /^\/admin\/trips\/[^/]+\/content$/, title: "Edycja treści wycieczki" },
  { pattern: /^\/admin\/trips\/[^/]+\/edit$/, title: "Edytuj wycieczkę" },
  { pattern: /^\/admin\/trips\/[^/]+\/bookings$/, title: "Rezerwacje wycieczki" },
  { pattern: /^\/admin\/trips\/[^/]+$/, title: "Szczegóły wycieczki" },
  { pattern: /^\/admin\/trips\/new$/, title: "Nowa wycieczka" },
  { pattern: /^\/admin\/bookings\/[^/]+$/, title: "Szczegóły rezerwacji" },
  { pattern: /^\/admin\/uczestnicy\/[^/]+$/, title: "Szczegóły uczestnika" },
  { pattern: /^\/admin\/insurance\/config$/, title: "Konfiguracja integracji HDI" },
  { pattern: /^\/admin\/insurance\/[^/]+$/, title: "Szczegóły zgłoszenia" },
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
  if (pathname.startsWith("/admin")) {
    return <h1 className="text-2xl font-semibold">Panel administracyjny</h1>
  }
  if (pathname.startsWith("/coord")) {
    return <h1 className="text-2xl font-semibold">Panel koordynatora</h1>
  }
  if (pathname.startsWith("/trip-dashboard")) {
    return <h1 className="text-2xl font-semibold">Dashboard wycieczki</h1>
  }

  return <h1 className="text-2xl font-semibold">Panel administracyjny</h1>
}

