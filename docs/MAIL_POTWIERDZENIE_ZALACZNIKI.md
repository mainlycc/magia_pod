# Mail potwierdzenia rezerwacji — załączniki (stan faktyczny)

Dokument porównuje **oczekiwaną listę załączników** (szablon biznesowy) z tym, **co system realnie wysyła** po rezerwacji.

Powiązane pliki:
- `app/api/bookings/route.ts` — składanie załączników i wysyłka maila
- `lib/documents/email-attachments.ts` — dokumenty z zakładki Dokumentacja
- `lib/insurance-local/owu-email-attachments.ts` — OWU ubezpieczeń (tylko wykupione)
- `lib/email/templates/booking-confirmation.ts` — lista w treści maila (dynamiczna, = faktyczne załączniki)

---

## Oczekiwana lista (szablon biznesowy)

```
Załączone dokumenty:
• Program.pdf
• Umowa_{{numer_umowy}}.pdf          → np. Umowa_123456-001.pdf
• OWU.pdf
• RODO.pdf
• Polityka_prywatnosci.pdf
• OWU_Ubezpieczenia.pdf
• OWU_Ubezpieczenia_Dod.pdf
```

---

## Co wysyła system — skrót

| # | Oczekiwany plik | Wysyłany? | Uwagi |
|---|-----------------|-----------|-------|
| 1 | `Program.pdf` | **Częściowo** | Tak, jeśli wgrany dokument typu `agreement`; nazwa zwykle inna |
| 2 | `Umowa_123456-001.pdf` | **Tak** | Generowany przy rezerwacji; slash w numerze → myślnik w nazwie |
| 3 | `OWU.pdf` | **Częściowo** | Tak, jeśli wgrany typ `conditions_de_pl`; nazwa zwykle inna |
| 4 | `RODO.pdf` | **Częściowo** | Tak, jeśli wgrany typ `rodo_info`; nazwa zwykle inna |
| 5 | `Polityka_prywatnosci.pdf` | **Nie** | Brak dedykowanego typu w panelu Dokumentacja |
| 6 | `OWU_Ubezpieczenia.pdf` | **Częściowo / warunkowo** | Typ `insurance_terms` i/lub OWU ubezp. podstawowego (typ 1) |
| 7 | `OWU_Ubezpieczenia_Dod.pdf` | **Tylko warunkowo** | OWU ubezp. dodatkowego (typ 2) — **tylko gdy klient wykupił** |

---

## Szczegóły per pozycja

### 1. `Program.pdf` — częściowo TAK

| Aspekt | Stan |
|--------|------|
| **Typ w systemie** | `agreement` |
| **Panel admina** | Dokumentacja → „Program imprezy turystycznej” |
| **Warunek wysyłki** | Plik wgrany (globalnie lub per wycieczka) + przełącznik „dołącz przy rezerwacji” = włączony (domyślnie: tak) |
| **Domyślna nazwa pliku** | `Program imprezy turystycznej.pdf` (z `display_name`), **nie** `Program.pdf` |
| **Zgodność z listą** | Treść OK, nazwa pliku zwykle **nie** |

---

### 2. `Umowa_123456-001.pdf` — TAK

| Aspekt | Stan |
|--------|------|
| **Źródło** | Generowanie PDF umowy (`/api/pdf`) przy tworzeniu rezerwacji |
| **Nazwa** | `Umowa_{numer_umowy}.pdf`, np. `Umowa_123456-001.pdf` |
| **Warunek wysyłki** | PDF musi się poprawnie wygenerować |
| **Numer w nazwie** | Publiczny numer umowy/rezerwacji (`123456/001`), **nie** `booking_ref` PayNow |
| **Zgodność z listą** | **Tak** (format z myślnikiem zamiast slasha) |

---

### 3. `OWU.pdf` — częściowo TAK

| Aspekt | Stan |
|--------|------|
| **Typ w systemie** | `conditions_de_pl` |
| **Panel admina** | Dokumentacja → „Warunki Udziału w Imprezach Turystycznych GRUPY DE-PL” |
| **Warunek wysyłki** | Plik wgrany + dołączanie przy rezerwacji włączone |
| **Domyślna nazwa pliku** | `Warunki Udziału w Imprezach Turystycznych GRUPY DE-PL.pdf`, **nie** `OWU.pdf` |
| **Zgodność z listą** | Dokument OK, nazwa **nie** |

> **Uwaga:** To OWU / warunki udziału DE-PL z modułu Dokumentacja — to **nie** to samo co OWU ubezpieczeń (poz. 6–7).

---

### 4. `RODO.pdf` — częściowo TAK

| Aspekt | Stan |
|--------|------|
| **Typ w systemie** | `rodo_info` |
| **Panel admina** | Dokumentacja → „Informacja nt przetwarzania danych osobowych” |
| **Warunek wysyłki** | Plik wgrany + dołączanie przy rezerwacji włączone |
| **Domyślna nazwa pliku** | `Informacja nt przetwarzania danych osobowych.pdf`, **nie** `RODO.pdf` |
| **Zgodność z listą** | Dokument OK, nazwa **nie** |

---

### 5. `Polityka_prywatnosci.pdf` — NIE

| Aspekt | Stan |
|--------|------|
| **Typ w systemie** | **Brak** dedykowanego typu w panelu Dokumentacja |
| **Możliwe obejście** | Ręcznie wgrać plik jako `electronic_services` (Regulamin online) lub legacy typ `rodo` / `terms` (niewidoczne w UI) |
| **Domyślnie** | **Nie wysyłany** |
| **Zgodność z listą** | **Nie** |

---

### 6. `OWU_Ubezpieczenia.pdf` — częściowo / warunkowo

System ma **dwa możliwe źródła** tego dokumentu:

#### A) Moduł Dokumentacja — typ `insurance_terms`

| Aspekt | Stan |
|--------|------|
| **Panel** | Dokumentacja → „Ogólne Warunki Ubezpieczenia” |
| **Warunek** | Plik wgrany + dołączanie włączone |
| **Domyślna nazwa** | `Ogólne Warunki Ubezpieczenia.pdf`, **nie** `OWU_Ubezpieczenia.pdf` |

#### B) Moduł OWU ubezpieczeń — typ 1 (podstawowe, PZU)

| Aspekt | Stan |
|--------|------|
| **Panel** | Ubezpieczenia globalne → OWU typ 1 |
| **Warunek** | Klient **wykupił** ubezpieczenie typu 1 w formularzu + plik OWU wgrany + wysyłka włączona |
| **Domyślna nazwa** | `OWU Typ 1 — Podstawowe (PZU).pdf` lub `display_name` z panelu |

**Zgodność z listą:** treść może być, nazwa i logika **nie** są 1:1 z szablonem.

---

### 7. `OWU_Ubezpieczenia_Dod.pdf` — tylko warunkowo

| Aspekt | Stan |
|--------|------|
| **Typ w systemie** | OWU ubezpieczeń — typ 2 (dodatkowe medyczne, TU Europa) |
| **Panel** | Ubezpieczenia globalne → OWU typ 2 |
| **Warunek wysyłki** | Klient **musi wykupić** ubezpieczenie dodatkowe w formularzu rezerwacji |
| **Bez wykupienia** | Plik **nie trafia** do maila, nawet jeśli jest wgrany w systemie |
| **Domyślna nazwa** | `OWU Typ 2 — Dodatkowe medyczne (TU Europa).pdf`, **nie** `OWU_Ubezpieczenia_Dod.pdf` |
| **Zgodność z listą** | Logika i nazwa **nie** |

---

## Dodatkowe pliki — wysyłane, ale POZA Twoją listą

Jeśli są wgrane globalnie (domyślnie dołączanie = włączone), do maila mogą trafić **także**:

| Typ | Domyślna nazwa pliku |
|-----|----------------------|
| `standard_form` | `Standardowy Formularz Informacyjny.pdf` |
| `electronic_services` | `Regulamin Świadczenia Usług Drogą Elektroniczną.pdf` |

Legacy typy (iterowane w kodzie, ale **niewidoczne w panelu Dokumentacja**):

| Typ | Uwagi |
|-----|-------|
| `rodo` | Stary typ — tylko jeśli istnieje w bazie |
| `terms` | Stary typ |
| `conditions` | Stary typ |

---

## Kolejność załączników — różni się od szablonu

**Oczekiwana kolejność (szablon):**
Program → Umowa → OWU → RODO → Polityka → OWU_Ubezp → OWU_Ubezp_Dod

**Faktyczna kolejność w kodzie:**

1. **Umowa PDF** (`Umowa_123456-001.pdf`) — zawsze pierwsza
2. **Dokumenty z Dokumentacji** — wg kolejności typów w `DOCUMENT_TYPES`:
   `rodo` → `terms` → `conditions` → `agreement` → `conditions_de_pl` → `standard_form` → `electronic_services` → `rodo_info` → `insurance_terms`
   (tylko te, które istnieją w bazie i mają włączone dołączanie)
3. **OWU ubezpieczeń** — na końcu, tylko wykupione typy (1, 2, 3)

---

## Lista w treści maila

Sekcja „Załączone dokumenty” w mailu **nie jest sztywna**.

Pokazuje **dokładnie nazwy plików**, które faktycznie poszły w załączniku Resend — w tej samej kolejności co załączniki.

Jeśli pliku braku (nie wgrany, wyłączony przełącznik, ubezpieczenie niewykupione, błąd PDF) — **nie pojawi się** ani w załączniku, ani na liście w treści.

---

## Warunki braku załączników (edge cases)

| Sytuacja | Efekt |
|----------|-------|
| Brak wgranych dokumentów globalnych / wycieczkowych | Mail może zawierać **tylko umowę PDF** |
| Błąd generowania umowy PDF | Brak pliku umowy |
| Wyłączony przełącznik „dołącz przy rezerwacji” w Dokumentacji | Dany typ pomijany |
| Klient nie wykupił ubezpieczenia dodatkowego | Brak `OWU_Ubezpieczenia_Dod` |
| Brak `RESEND_API_KEY` / błąd Resend | Mail nie wysłany (rezerwacja i tak zapisana) |

---

## Podsumowanie

| Kategoria | Liczba pozycji z listy (7) |
|-----------|----------------------------|
| Wysyłane zgodnie (treść + sens) | **2** — umowa PDF + program (jeśli wgrany) |
| Wysyłane, ale pod **inną nazwą** pliku | **3–4** — OWU DE-PL, RODO, ewent. OWU ubezpieczeń |
| **Nigdy** domyślnie (brak typu) | **1** — Polityka prywatności |
| **Tylko warunkowo** (wykup ubezpieczenia) | **1** — OWU ubezpieczenia dodatkowego |
| **Poza listą**, a domyślnie możliwe | **2+** — formularz standardowy, regulamin online, legacy typy |

---

## Co trzeba zmienić, żeby lista była 1:1 z szablonem

1. **Mapowanie typ → stała nazwa pliku** w kodzie (np. `agreement` → `Program.pdf`)
2. **Nowy typ dokumentu** lub przypisanie dla `Polityka_prywatnosci.pdf`
3. **Stała kolejność** załączników (Program → Umowa → OWU → …)
4. **Decyzja biznesowa:** czy OWU ubezpieczeń (typ 1 i 2) ma iść **zawsze**, czy tylko po wykupieniu
5. **Wyłączenie** `standard_form` i `electronic_services` z domyślnej wysyłki (jeśli nie mają być w mailu)

---

*Ostatnia aktualizacja: na podstawie kodu w `app/api/bookings/route.ts`, `lib/documents/email-attachments.ts`, `lib/insurance-local/owu-email-attachments.ts`.*
