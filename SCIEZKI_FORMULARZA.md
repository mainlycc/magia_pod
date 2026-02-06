# Ścieżki w Formularzu Rezerwacji

## Przegląd ogólny

Formularz rezerwacji składa się z **4 głównych kroków**, z których jeden może być ukryty w zależności od konfiguracji wycieczki:

1. **Kontakt** - Dane osoby zgłaszającej i adres korespondencyjny
2. **Uczestnicy** - Lista uczestników oraz dokumenty podróży
3. **Usługi dodatkowe** - Ubezpieczenia, atrakcje i diety *(opcjonalny - widoczny tylko gdy `form_show_additional_services === true`)*
4. **Zgody i podsumowanie** - Finalne potwierdzenie, zgody oraz wysyłka

---

## Logika nawigacji

### Widoczność kroków
- Krok "Usługi dodatkowe" jest **ukryty**, jeśli `tripConfig.form_show_additional_services !== true`
- Jeśli krok "Usługi dodatkowe" jest ukryty, nawigacja automatycznie pomija go przy przechodzeniu między krokami
- Użytkownik może przechodzić tylko do kroków, które już odwiedził lub do aktualnego kroku (`maxAvailableStep`)

### Walidacja
- Przed przejściem do następnego kroku, walidowane są pola z aktualnego kroku
- Jeśli walidacja nie przejdzie, użytkownik pozostaje na aktualnym kroku
- Przy próbie wysłania formularza z błędami, automatycznie przełącza się na pierwszy krok z błędami

---

## KROK 1: KONTAKT

### Warunki wyświetlania

#### Wybór typu zgłaszającego
- **Pokazuje się gdy**: `tripConfig.registration_mode === "both"`
- **Zawartość**: 
  - Przycisk "1. Osoba fizyczna"
  - Przycisk "2. Firma"
- **Domyślna wartość**: `applicantType = "individual"`

### Pola zawsze widoczne

#### Dane podstawowe
- **Imię** (`contact.first_name`)
  - Wymagane dla osoby fizycznej
  - Opcjonalne dla firmy
- **Nazwisko** (`contact.last_name`)
  - Wymagane dla osoby fizycznej
  - Opcjonalne dla firmy
- **E-mail** (`contact.email`) - **zawsze wymagany**
- **Telefon** (`contact.phone`) - **zawsze wymagany**

### Pola widoczne tylko dla osoby fizycznej (`applicantType === "individual"`)

#### PESEL
- **Pole**: `contact.pesel`
- **Wymagane**: Tak (jeśli `tripConfig.require_pesel === true`)
- **Format**: Dokładnie 11 cyfr
- **Walidacja**: Regex `/^\d{11}$/`

### Pola widoczne tylko dla firmy (`applicantType === "company"`)

#### Osoba do reprezentacji
- **Checkbox**: `company.has_representative`
- **Jeśli zaznaczone**, pokazują się:
  - `company.representative_first_name` - **wymagane**
  - `company.representative_last_name` - **wymagane**

#### Dane firmy
- **Nazwa firmy** (`company.name`) - **wymagane**
- **NIP/KRS** (`company.nip`) - **wymagane**
- **Adres firmy**:
  - `company.address.street` - **wymagane**
  - `company.address.city` - **wymagane**
  - `company.address.zip` - **wymagane**

### Sekcja Faktura (zawsze widoczna)

#### Checkbox "Proszę o wystawienie faktury na inne dane"
- **Pole**: `invoice.use_other_data`
- **Domyślnie**: `false`

#### Jeśli zaznaczone (`invoice.use_other_data === true`)

**Wybór typu danych:**
- **Select**: `invoice.type` - **wymagane**
  - Opcje: "Osoba fizyczna" / "Firma"

**Dla typu "Osoba fizyczna" (`invoice.type === "individual"`):**
- `invoice.person.first_name` - **wymagane**
- `invoice.person.last_name` - **wymagane**
- `invoice.person.address.street` - opcjonalne
- `invoice.person.address.city` - opcjonalne
- `invoice.person.address.zip` - opcjonalne

**Dla typu "Firma" (`invoice.type === "company"`):**
- `invoice.company.name` - **wymagane**
- `invoice.company.nip` - **wymagane**
- `invoice.company.address.street` - opcjonalne
- `invoice.company.address.city` - opcjonalne
- `invoice.company.address.zip` - opcjonalne

### Przyciski nawigacji
- **Anuluj** - Link do `/trip/${slug}`
- **Dalej** - Przechodzi do kroku "Uczestnicy" (po walidacji)

---

## KROK 2: UCZESTNICY

### Warunki wyświetlania

#### Alert informacyjny (tylko dla firm)
- **Pokazuje się gdy**: `applicantType === "company" && reservationInfoText !== null`
- **Zawartość**: Wyświetla tekst z `tripConfig.reservation_info_text`

### Widok dla FIRMY (`applicantType === "company"`)

#### Tytuł sekcji
- **Tytuł**: "Liczba uczestników"

#### Wyświetlane informacje
- **Liczba uczestników**: Automatycznie ustawiona na `tripConfig.seats_total`
  - Pole `participants_count` jest automatycznie ustawiane i **nie można go zmienić**
- **Informacja tekstowa**: 
  - Wyświetla `tripConfig.company_participants_info` lub domyślny tekst:
    > "Dane uczestników wyjazdu należy przekazać organizatorowi na adres mailowy: office@grupa-depl.com najpóźniej 7 dni przed wyjazdem. Lista powinna zawierać imię i nazwisko oraz datę urodzenia każdego uczestnika."

**Uwaga**: Dla firm **nie ma możliwości** dodawania uczestników w formularzu - tylko wyświetlana jest liczba miejsc.

### Widok dla OSOBY FIZYCZNEJ (`applicantType === "individual"`)

#### Tytuł sekcji
- **Tytuł**: "Uczestnicy"

#### Lista uczestników
- **Jeśli brak uczestników** (`fields.length === 0`):
  - Wyświetla komunikat: "Brak uczestników. Dodaj co najmniej jednego uczestnika, aby wysłać rezerwację."

- **Dla każdego uczestnika** (`participants[index]`):

##### Pola podstawowe (zawsze widoczne)
- **Imię** (`participants[index].first_name`) - **wymagane**
- **Nazwisko** (`participants[index].last_name`) - **wymagane**
- **Data urodzenia** (`participants[index].birth_date`) - **wymagane** (typ: date)

##### Pola opcjonalne (widoczne zawsze, ale wymagalność zależy od konfiguracji)
- **Płeć** (`participants[index].gender_code`)
  - Opcje: "Kobieta" (F) / "Mężczyzna" (M)
  - **Wymagane gdy**: `tripConfig.form_required_participant_fields?.gender === true`
- **Telefon** (`participants[index].phone`)
  - **Wymagane gdy**: `tripConfig.form_required_participant_fields?.phone === true`

##### Pola dokumentu (widoczne zawsze, ale wymagalność zależy od konfiguracji)
- **Typ dokumentu** (`participants[index].document_type`)
  - Opcje: "Dowód osobisty" (ID) / "Paszport" (PASSPORT)
  - **Wymagane gdy**: `tripConfig.form_required_participant_fields?.document === true`
- **Seria i numer dokumentu** (`participants[index].document_number`)
  - **Wymagane gdy**: `tripConfig.form_required_participant_fields?.document === true`
- **Data wydania** (`participants[index].document_issue_date`) - opcjonalne (typ: date)
- **Data ważności** (`participants[index].document_expiry_date`) - opcjonalne (typ: date)

##### Opcje uczestnika
- **Przycisk "Usuń"**: 
  - Widoczny tylko gdy `fields.length > 1`
  - Usuwa uczestnika z listy

#### Dodawanie uczestników
- **Przycisk "Dodaj kolejnego uczestnika"**
  - **Blokada**: Nie można dodać więcej uczestników niż `tripConfig.seats_total`
  - Jeśli `currentCount >= maxSeats`, przycisk nie działa

### Przyciski nawigacji
- **Wstecz** - Przechodzi do kroku "Kontakt"
- **Dalej** - Przechodzi do następnego kroku (po walidacji)
  - Jeśli `hasAdditionalServices === true` → przechodzi do "Usługi dodatkowe"
  - Jeśli `hasAdditionalServices === false` → przechodzi do "Zgody i podsumowanie"

---

## KROK 3: USŁUGI DODATKOWE (OPCJONALNY)

### Warunki wyświetlania
- **Pokazuje się gdy**: `tripConfig.form_show_additional_services === true`
- **Jeśli ukryty**: Automatycznie pomijany w nawigacji

### Warunki wstępne
- **Dla osoby fizycznej**: Wymagane jest dodanie co najmniej jednego uczestnika
  - Jeśli `applicantType === "individual" && fields.length === 0`:
    - Wyświetla komunikat: "Dodaj uczestników, aby wybrać usługi dodatkowe."
    - Nie można wybierać usług

### Sekcje usług

#### 1. DIETY (`tripConfig.diets`)

**Warunek wyświetlania:**
- Pokazuje się tylko diety, gdzie `diet.enabled !== false`

**Dla każdej diety:**

##### Informacje o diecie
- **Tytuł**: `diet.title`
- **Cena**: Jeśli `diet.price_cents > 0`, wyświetla `(+XX.XX PLN)`

##### Dodawanie diety
- **Przycisk "Dodaj dietę"**
  - Tworzy nową usługę typu `"diet"` z `service_id = diet.id`
  - **Dla osoby fizycznej**: Automatycznie przypisuje do pierwszego uczestnika (`participant_index = 0`)
  - **Dla firmy**: Pozostawia puste pola `participant_first_name` i `participant_last_name` do wypełnienia

##### Konfiguracja dodanej diety

**Dla osoby fizycznej:**
- **Select "Uczestnik"**: Wybór uczestnika z listy (`participant_services[index].participant_index`)
  - Lista pokazuje: "Imię Nazwisko" lub "Uczestnik X" jeśli brak danych

**Dla firmy:**
- **Pole "Imię uczestnika"**: `participant_services[index].participant_first_name`
- **Pole "Nazwisko uczestnika"**: `participant_services[index].participant_last_name`

**Warianty diety (jeśli dostępne):**
- **Select "Wariant diety"**: `participant_services[index].variant_id`
  - Wyświetla wszystkie warianty z `diet.variants`
  - Pokazuje cenę wariantu: `(+XX.XX PLN)` lub `(bezpłatna)`
  - Po wyborze wariantu, aktualizuje `price_cents` na podstawie `variant.price_cents`

**Usuwanie diety:**
- **Przycisk "X"**: Usuwa usługę z listy

#### 2. UBEZPIECZENIA DODATKOWE (`tripConfig.extra_insurances`)

**Warunek wyświetlania:**
- Pokazuje się tylko ubezpieczenia, gdzie `insurance.enabled !== false`

**Dla każdego ubezpieczenia:**

##### Informacje o ubezpieczeniu
- **Tytuł**: `insurance.title`
- **Opis**: `insurance.description` (jeśli dostępny)
- **Cena**: Jeśli brak wariantów i `insurance.price_cents > 0`, wyświetla `(+XX.XX PLN)`
- **Link OWU**: Jeśli `insurance.owu_url` istnieje, wyświetla link z ikoną ExternalLink

##### Dodawanie ubezpieczenia
- **Przycisk "Dodaj ubezpieczenie"**
  - Tworzy nową usługę typu `"insurance"` z `service_id = insurance.id`
  - **Jeśli ubezpieczenie ma warianty** (`insurance.variants.length > 0`):
    - Automatycznie ustawia pierwszy wariant (`variant_id = variants[0].id`)
    - Ustawia `price_cents = variants[0].price_cents`
  - **Jeśli brak wariantów**:
    - Ustawia `price_cents = insurance.price_cents`
  - **Dla osoby fizycznej**: Automatycznie przypisuje do pierwszego uczestnika
  - **Dla firmy**: Pozostawia puste pola do wypełnienia

##### Konfiguracja dodanego ubezpieczenia

**Przypisanie uczestnika** (identyczne jak w dietach):
- Dla osoby fizycznej: Select z listą uczestników
- Dla firmy: Pola imię i nazwisko

**Warianty ubezpieczenia (jeśli dostępne):**
- **Select "Wariant ubezpieczenia"**: `participant_services[index].variant_id`
  - Wyświetla wszystkie warianty z `insurance.variants`
  - Pokazuje cenę wariantu
  - Po wyborze wariantu, aktualizuje `price_cents`

**Usuwanie ubezpieczenia:**
- **Przycisk "X"**: Usuwa usługę z listy

#### 3. ATRAKCJE DODATKOWE (`tripConfig.additional_attractions`)

**Warunek wyświetlania:**
- Pokazuje się tylko atrakcje, gdzie `attraction.enabled !== false`

**Dla każdej atrakcji:**

##### Informacje o atrakcji
- **Tytuł**: `attraction.title`
- **Opis**: `attraction.description` (jeśli dostępny)
- **Cena**: Jeśli `attraction.price_cents > 0`, wyświetla `(+XX.XX PLN)`
- **Waluta**: Jeśli `attraction.currency !== "PLN"`, wyświetla walutę (np. EUR)

##### Dodawanie atrakcji
- **Przycisk "Dodaj atrakcję"**
  - Tworzy nową usługę typu `"attraction"` z `service_id = attraction.id`
  - Ustawia `price_cents = attraction.price_cents`
  - Ustawia `currency = attraction.currency || "PLN"`
  - **Dla osoby fizycznej**: Automatycznie przypisuje do pierwszego uczestnika
  - **Dla firmy**: Pozostawia puste pola do wypełnienia

##### Konfiguracja dodanej atrakcji

**Przypisanie uczestnika** (identyczne jak w dietach i ubezpieczeniach):
- Dla osoby fizycznej: Select z listą uczestników
- Dla firmy: Pola imię i nazwisko

**Warianty atrakcji (jeśli dostępne):**
- **Select "Wariant atrakcji"**: `participant_services[index].variant_id`
  - Wyświetla wszystkie warianty z `attraction.variants`
  - Pokazuje cenę wariantu z walutą
  - Po wyborze wariantu, aktualizuje `price_cents` i `currency`

**Usuwanie atrakcji:**
- **Przycisk "X"**: Usuwa usługę z listy

### Przyciski nawigacji
- **Wstecz** - Przechodzi do kroku "Uczestnicy"
- **Dalej** - Przechodzi do kroku "Zgody i podsumowanie" (po walidacji)

---

## KROK 4: ZGODY I PODSUMOWANIE

### Sekcja: Podsumowanie rezerwacji

#### 1. Dane osoby zgłaszającej / firmy

**Dla FIRMY (`applicantType === "company"`):**

**Najpierw wyświetlane są dane firmy:**
- Nazwa firmy (`company.name`)
- NIP/KRS (`company.nip`)
- Adres firmy (`company.address`)

**Następnie dane osoby do kontaktu:**
- Imię i nazwisko (`contact.first_name`, `contact.last_name`)
- E-mail (`contact.email`)
- Telefon (`contact.phone`)
- Adres (`contact.address`)

**Dla OSOBY FIZYCZNEJ (`applicantType === "individual"`):**

**Wyświetlane są dane osoby zgłaszającej:**
- Imię i nazwisko (`contact.first_name`, `contact.last_name`)
- E-mail (`contact.email`)
- Telefon (`contact.phone`)
- Adres (`contact.address`)
- PESEL (`contact.pesel`) - jeśli wypełniony

#### 2. Uczestnicy

**Dla FIRMY:**
- **Liczba uczestników**: Wyświetla `participants_count` lub `tripConfig.seats_total`
- **Informacja tekstowa**: Wyświetla `tripConfig.company_participants_info` lub domyślny tekst

**Dla OSOBY FIZYCZNEJ:**
- **Jeśli brak uczestników**: Wyświetla "Brak uczestników."
- **Dla każdego uczestnika** wyświetla:
  - Numer i imię nazwisko
  - Typ dokumentu
  - Płeć
  - Telefon
  - Numer dokumentu
  - **Usługi dodatkowe przypisane do uczestnika**:
    - Diety (z wariantem jeśli wybrany, z ceną jeśli > 0)
    - Ubezpieczenia (z wariantem jeśli wybrany, z ceną jeśli > 0)
    - Atrakcje (z ceną i walutą jeśli > 0, informacja jeśli waluta !== PLN)

#### 3. Cena

**Warunek wyświetlania:**
- Pokazuje się tylko gdy `tripPrice !== null`

**Dla FIRMY:**

**Obliczenia:**
- Cena za osobę: `tripPrice`
- Liczba uczestników: `participants_count || tripConfig.seats_total`
- Usługi dodatkowe: Suma wszystkich usług z `currency === "PLN"` (inne waluty nie wliczają się do umowy)
- Cena całkowita: `(tripPrice * participantsCount) + additionalServicesTotal`
- Zaliczka: `(basePrice * paymentSplitFirstPercent) / 100`

**Wyświetlane:**
- Cena za osobę
- Liczba uczestników
- Usługi dodatkowe (jeśli > 0)
- Separator
- Cena całkowita (duży, pogrubiony)
- Zaliczka (duży, pogrubiony)
- Informacja o zaliczce

**Dla OSOBY FIZYCZNEJ:**

**Obliczenia:**
- Cena za osobę: `tripPrice`
- Jeśli więcej niż 1 uczestnik: Cena za X osób (`tripPrice * participantsSummary.length`)
- Zaliczka: `(tripPrice * participantsSummary.length * paymentSplitFirstPercent) / 10000`

**Wyświetlane:**
- Cena za osobę
- Cena za X osób (jeśli `participantsSummary.length > 1`)
- Separator
- Zaliczka (duży, pogrubiony)
- Informacja o zaliczce

**Uwaga**: Usługi dodatkowe dla osoby fizycznej nie są wyświetlane w sekcji ceny, ale są widoczne przy każdym uczestniku.

#### 4. Podgląd umowy

**Zawartość:**
- Iframe z `/api/pdf/preview`
- Wysokość: 400px (mobile) / 600px (desktop)
- Informacja: "Po przesłaniu zgłoszenia wygenerujemy wzór umowy w formacie PDF i wyślemy go na podany e-mail."

#### 5. Zgody

**Sekcja "Zapoznałem się i akceptuję":**

1. **Umowa o udział** (`consents.agreement_consent`) - **wymagane**
   - Link do dokumentu: `documents.agreement.url` lub `/api/documents/file/${documents.agreement.file_name}`

2. **Warunki Udziału** (`consents.conditions_de_pl_consent`) - **wymagane**
   - Link do dokumentu: `documents.conditions_de_pl.url` lub `/api/documents/file/${documents.conditions_de_pl.file_name}`

3. **Standardowy Formularz Informacyjny** (`consents.standard_form_consent`) - **wymagane**
   - Link do dokumentu: `documents.standard_form.url` lub `/api/documents/file/${documents.standard_form.file_name}`

4. **Regulamin Świadczenia Usług Drogą Elektroniczną** (`consents.electronic_services_consent`) - **wymagane**
   - Link do dokumentu: `documents.electronic_services.url` lub `/api/documents/file/${documents.electronic_services.file_name}`

5. **Informacja nt przetwarzania danych osobowych** (`consents.rodo_info_consent`) - **wymagane**
   - Link do dokumentu: `documents.rodo_info.url` lub `/api/documents/file/${documents.rodo_info.file_name}`

**Sekcja "UBEZPIECZENIE":**

1. **Ogólne Warunki Ubezpieczenia** (`consents.insurance_terms_consent`) - **wymagane**
   - Link do dokumentu: `documents.insurance_terms.url` lub `/api/documents/file/${documents.insurance_terms.file_name}`

2. **Zgoda na przetwarzanie danych** (`consents.insurance_data_consent`) - **wymagane**
   - Brak linku do dokumentu

3. **Zgoda dla innej osoby** (`consents.insurance_other_person_consent`) - **wymagane**
   - Brak linku do dokumentu

### Przyciski nawigacji

**Dla FIRMY:**
- **Wstecz** - Przechodzi do poprzedniego kroku
- **ZAREZERWUJ** - Wysyła formularz (`onSubmit(values, false)`)
  - Tekst podczas wysyłania: "Wysyłanie..."

**Dla OSOBY FIZYCZNEJ:**
- **Wstecz** - Przechodzi do poprzedniego kroku
- **Rezerwuj** - Wysyła formularz bez płatności (`onSubmit(values, false)`)
  - Tekst podczas wysyłania: "Wysyłanie..."
- **Rezerwuj i Zapłać** - Wysyła formularz z płatnością (`onSubmit(values, true)`)
  - Tekst podczas wysyłania: "Wysyłanie..."

---

## Podsumowanie warunków wyświetlania

### Zmienne decydujące o widoczności

1. **`tripConfig.registration_mode`**
   - `"both"` → Pokazuje wybór typu zgłaszającego (osoba fizyczna / firma)
   - `"individual"` → Tylko osoba fizyczna
   - `"company"` → Tylko firma

2. **`applicantType`**
   - `"individual"` → Widok dla osoby fizycznej
   - `"company"` → Widok dla firmy

3. **`tripConfig.form_show_additional_services`**
   - `true` → Pokazuje krok "Usługi dodatkowe"
   - `false` → Ukrywa krok "Usługi dodatkowe"

4. **`tripConfig.form_required_participant_fields`**
   - Określa, które pola uczestnika są wymagane:
     - `gender` → Płeć wymagana
     - `phone` → Telefon wymagany
     - `document` → Dokument wymagany

5. **`tripConfig.seats_total`**
   - Maksymalna liczba miejsc w wycieczce
   - Dla firm: automatycznie ustawia liczbę uczestników
   - Dla osób fizycznych: limit dodawania uczestników

6. **`tripConfig.reservation_info_text`**
   - Tekst informacyjny wyświetlany dla firm w kroku "Uczestnicy"

7. **`tripConfig.company_participants_info`**
   - Tekst informacyjny o przekazywaniu danych uczestników dla firm

8. **`invoice.use_other_data`**
   - `true` → Pokazuje sekcję danych do faktury
   - `false` → Ukrywa sekcję danych do faktury

9. **`invoice.type`**
   - `"individual"` → Pokazuje pola dla osoby fizycznej
   - `"company"` → Pokazuje pola dla firmy

10. **`fields.length`** (liczba uczestników)
    - Dla osoby fizycznej: określa, czy można wybierać usługi dodatkowe
    - Określa, czy można dodać kolejnego uczestnika (limit: `seats_total`)

11. **`tripConfig.diets`**, **`tripConfig.extra_insurances`**, **`tripConfig.additional_attractions`**
    - Filtrowane przez `enabled !== false`
    - Określają, które usługi są dostępne

12. **`tripPrice`**
    - `null` → Ukrywa sekcję ceny
    - `number` → Pokazuje sekcję ceny

---

## Walidacja pól w każdym kroku

### Krok 1: Kontakt

**Dla osoby fizycznej:**
- `applicant_type` - wymagane
- `contact.first_name` - wymagane
- `contact.last_name` - wymagane
- `contact.pesel` - wymagane (jeśli `require_pesel === true`)
- `contact.email` - wymagane
- `contact.phone` - wymagane

**Dla firmy:**
- `applicant_type` - wymagane
- `contact.email` - wymagane
- `contact.phone` - wymagane
- `company.name` - wymagane
- `company.nip` - wymagane
- `company.address.street` - wymagane
- `company.address.city` - wymagane
- `company.address.zip` - wymagane
- `company.representative_first_name` - wymagane (jeśli `has_representative === true`)
- `company.representative_last_name` - wymagane (jeśli `has_representative === true`)

**Jeśli `invoice.use_other_data === true`:**
- `invoice.type` - wymagane
- Dla `invoice.type === "individual"`:
  - `invoice.person.first_name` - wymagane
  - `invoice.person.last_name` - wymagane
- Dla `invoice.type === "company"`:
  - `invoice.company.name` - wymagane
  - `invoice.company.nip` - wymagane

### Krok 2: Uczestnicy

**Dla osoby fizycznej:**
- `participants` - wymagane (co najmniej 1 uczestnik)
- Dla każdego uczestnika:
  - `participants[index].first_name` - wymagane
  - `participants[index].last_name` - wymagane
  - `participants[index].birth_date` - wymagane
  - `participants[index].gender_code` - wymagane (jeśli `form_required_participant_fields.gender === true`)
  - `participants[index].phone` - wymagane (jeśli `form_required_participant_fields.phone === true`)
  - `participants[index].document_type` - wymagane (jeśli `form_required_participant_fields.document === true`)
  - `participants[index].document_number` - wymagane (jeśli `form_required_participant_fields.document === true`)

**Dla firmy:**
- Brak walidacji uczestników (tylko liczba miejsc)

### Krok 3: Usługi dodatkowe

- Brak wymaganych pól (wszystkie opcjonalne)

### Krok 4: Zgody i podsumowanie

- `consents.agreement_consent` - wymagane
- `consents.conditions_de_pl_consent` - wymagane
- `consents.standard_form_consent` - wymagane
- `consents.electronic_services_consent` - wymagane
- `consents.rodo_info_consent` - wymagane
- `consents.insurance_terms_consent` - wymagane
- `consents.insurance_data_consent` - wymagane
- `consents.insurance_other_person_consent` - wymagane

---

## Przepływ nawigacji

### Przejście do przodu
1. Użytkownik klika "Dalej" lub wybiera zakładkę
2. Walidacja pól aktualnego kroku
3. Jeśli walidacja OK:
   - Przechodzi do następnego widocznego kroku
   - Aktualizuje `maxAvailableStep`
4. Jeśli walidacja NIE OK:
   - Pozostaje na aktualnym kroku
   - Wyświetla błędy walidacji

### Przejście do tyłu
1. Użytkownik klika "Wstecz" lub wybiera poprzednią zakładkę
2. Przechodzi do poprzedniego widocznego kroku (pomija ukryte)
3. Brak walidacji przy przechodzeniu wstecz

### Próba wysłania formularza
1. Walidacja wszystkich wymaganych pól
2. Jeśli błędy:
   - Automatyczne przełączenie na pierwszy krok z błędami
   - Wyświetlenie toast z błędami
   - Przewinięcie do pierwszego błędu
3. Jeśli OK:
   - Wywołanie `onSubmit(values, withPayment)`
   - Dla firmy: zawsze `withPayment = false`
   - Dla osoby fizycznej: `withPayment` zależy od przycisku

---

## Uwagi techniczne

- Wszystkie ceny przechowywane są w groszach (`price_cents`)
- Waluty inne niż PLN nie wliczają się do ceny całkowitej w umowie
- Dla firm liczba uczestników jest zawsze równa `seats_total` i nie można jej zmienić
- Usługi dodatkowe dla firm wymagają ręcznego wpisania imienia i nazwiska uczestnika
- Usługi dodatkowe dla osób fizycznych są automatycznie przypisywane do uczestników z listy
- Dokumenty (zgody) są ładowane z Supabase Storage i wyświetlane jako linki
- Podgląd umowy jest generowany dynamicznie przez endpoint `/api/pdf/preview`
