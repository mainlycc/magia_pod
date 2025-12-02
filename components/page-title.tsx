"use client"

import { usePathname } from "next/navigation"

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/trips": "Wycieczki",
  "/admin/bookings": "Rezerwacje i Umowy",
  "/admin/payments": "Płatności",
  "/admin/uczestnicy": "Uczestnicy",
  "/admin/coordinators/invite": "Zaproszenia koordynatorów",
  "/admin/przyklad": "Przykład",
  "/coord": "Wyjazdy",
}

// Wzorce ścieżek z dynamicznymi segmentami
const pathPatterns: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /^\/admin\/trips\/[^/]+\/edit$/, title: "Edytuj wycieczkę" },
  { pattern: /^\/admin\/trips\/[^/]+\/bookings$/, title: "Rezerwacje wycieczki" },
  { pattern: /^\/admin\/trips\/[^/]+$/, title: "Szczegóły wycieczki" },
  { pattern: /^\/admin\/trips\/new$/, title: "Nowa wycieczka" },
  { pattern: /^\/admin\/bookings\/[^/]+$/, title: "Szczegóły rezerwacji" },
  { pattern: /^\/admin\/uczestnicy\/[^/]+$/, title: "Szczegóły uczestnika" },
  { pattern: /^\/coord\/trips\/[^/]+\/participants$/, title: "Uczestnicy" },
  { pattern: /^\/coord\/trips\/[^/]+\/message$/, title: "Wyślij wiadomość" },
]

export function PageTitle() {
  const pathname = usePathname()
  
  // Sprawdź dokładne dopasowanie
  if (pageTitles[pathname]) {
    return <span className="text-sm text-muted-foreground">{pageTitles[pathname]}</span>
  }
  
  // Sprawdź wzorce ścieżek
  for (const { pattern, title } of pathPatterns) {
    if (pattern.test(pathname)) {
      return <span className="text-sm text-muted-foreground">{title}</span>
    }
  }
  
  // Domyślny tytuł na podstawie sekcji
  if (pathname.startsWith("/admin")) {
    return <span className="text-sm text-muted-foreground">Panel administracyjny</span>
  }
  if (pathname.startsWith("/coord")) {
    return <span className="text-sm text-muted-foreground">Panel koordynatora</span>
  }
  
  return <span className="text-sm text-muted-foreground">Panel administracyjny</span>
}

