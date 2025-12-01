## Zasady budowy aplikacji

Poniższy dokument opisuje podstawowe konwencje, których należy przestrzegać przy rozwoju tej aplikacji.

### UI i komponenty (`shadcn/ui`)

- **Wszystkie komponenty UI w aplikacji** (przyciski, pola formularzy, dialogi, tabelki, layouty itd.) powinny być budowane z wykorzystaniem biblioteki `shadcn/ui`.
- **Nie tworzymy własnych "od zera" komponentów UI**, jeśli istnieje odpowiednik w `shadcn/ui`. Możemy je rozszerzać/komponować, ale bazowy element powinien pochodzić z `shadcn/ui`.
- **Nowe komponenty projektujemy jako kompozycję** istniejących elementów `shadcn/ui` (np. `Button`, `Dialog`, `Input`, `Table`, `Card` itd.).
- W przypadku potrzeby użycia nowego komponentu `shadcn/ui`:
  - najpierw dodajemy go przez zalecane polecenie CLI `shadcn` (zgodnie z dokumentacją),
  - następnie używamy go w naszych komponentach zamiast kopiować kod z dokumentacji.

### Tabele i komponent `ReusableTable`

- **Wszystkie nowe tabelki w UI** powinny używać wspólnego komponentu `ReusableTable` z pliku `components/reusable-table.tsx`.
- **Nie tworzymy własnych, jednorazowych implementacji tabel**, jeśli przypadek użycia da się obsłużyć przez `ReusableTable`.
- **Konfiguracja tabeli** (kolumny, akcje, filtrowanie, wyszukiwanie itd.) powinna być przekazywana do `ReusableTable` poprzez:
  - typowane `ColumnDef` z `@tanstack/react-table`,
  - odpowiednie propsy komponentu (`searchable`, `enableRowSelection`, `onAdd`, `onDeleteSelected`, `filters` itd.),
  - dedykowane komponenty/elementy przekazywane jako `filters`, `addFormFields` itp.
- **Domyślny wzorzec tabeli administracyjnej**:
  - nowe widoki tabel w panelu admina powinny **domyślnie** używać konfiguracji analogicznej do podstrony `/admin/przyklad`,
  - oznacza to w szczególności: globalne wyszukiwanie (`searchable`), zaznaczanie wierszy checkboxami (`enableRowSelection`), paginację (`enablePagination`), przycisk „Dodaj” z wbudowanym dialogiem (`enableAddDialog`, `onConfirmAdd`) oraz opcjonalny przycisk „Usuń” dla zaznaczonych (`enableDeleteDialog`, `onConfirmDelete`),
  - odchylenia od tego domyślnego wzorca (np. brak checkboxów, własne rozbudowane filtry nad tabelą) wprowadzamy **tylko wtedy**, gdy jest to wyraźnie ustalone w wymaganiach dla danej podstrony.

### Migracje SQL i zmiany w bazie danych

- **Każda zmiana w bazie danych** (dodanie/zmiana/usunięcie tabel, kolumn, indeksów, constraintów itd.) musi być wprowadzana poprzez **osobny plik migracji SQL**.
- **Pliki migracji SQL są numerowane kolejno** – nowa zmiana w bazie danych to nowy plik z kolejnym numerem w nazwie (np. `001_...sql`, `002_...sql`, `003_...sql` itd. lub zgodnie z aktualnie przyjętym schematem nazw w projekcie).
- **Nie modyfikujemy wstecz istniejących plików migracji**, jeśli zostały już użyte/aplikowane:
  - zamiast tego tworzymy nowy plik z kolejnym numerem,
  - opisujemy w nim tylko nowe/aktualne zmiany.
- **Nazwy plików migracji** powinny jasno opisywać zakres zmiany, np.:
  - `00X_add_bookings_table.sql`
  - `00Y_bookings_enhancements.sql`
  - `00Z_coordinator_invitations.sql`

### Ogólne zalecenia

- **Zmiany w logice aplikacji** powinny być spójne z aktualnym stylem kodu (prettier/eslint).
- **Nazwy plików i modułów** powinny być czytelne i opisywać przeznaczenie (np. `bookings-table.tsx`, `coordinators-table.tsx`).
- Przed dodaniem nowej tabeli lub migracji **sprawdź istniejące pliki**, aby zachować jednolitość stylu i numeracji.


