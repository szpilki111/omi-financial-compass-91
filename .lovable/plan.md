# Plan: nowa rola „superior" (read-only) przypisana do placówki

## Cel
Dodać nową rolę użytkownika `superior`, która:
- jest przypisana do jednej lub wielu konkretnych placówek (np. dom w Poznaniu 2-15),
- widzi WSZYSTKO co ekonom danej placówki: dokumenty, transakcje, wyszukiwanie kont, raporty, KPIR, budżety, kalendarz, dashboard,
- NIE może niczego utworzyć, edytować ani usunąć,
- nie może też zatwierdzać raportów ani składać ich do akceptacji.

## Zakres zmian

### 1. Baza danych (migracja)
Rola obecnie jest tekstem w `profiles.role`, więc nie ma enuma do rozszerzenia – wystarczy zezwolić na nową wartość.

**Migracja SQL:**
- W `get_user_filtered_accounts` i `get_user_filtered_accounts_with_analytics` – traktować `superior` jak ekonoma w zakresie widoczności (czyli filtrować po `user_locations`/`location_identifier`), ale bez różnic, bo to tylko SELECT.
- Aktualizacja polityk RLS – wszędzie tam, gdzie obecnie ekonom ma INSERT/UPDATE/DELETE per-lokalizacja, NIE dodawać `superior`. Dla SELECT dodać `superior` tam, gdzie aktualnie ograniczenie brzmi „ekonom widzi swoje lokalizacje".

Lista tabel do przejrzenia (na podstawie schematu):
- `documents` – polityki SELECT: dodać warunek dla superior po `location_id ∈ user_locations`; INSERT/UPDATE/DELETE: BEZ superior (czyli zostaje blokada przez RLS).
- `transactions` – analogicznie (SELECT po `location_id`/segmenty konta).
- `accounts` / `analytical_accounts` – SELECT już jest dla wszystkich; nie dodawać INSERT/UPDATE/DELETE.
- `reports`, `report_account_details`, `report_*` – SELECT przez `can_access_report` lub po location – rozszerzyć tak, żeby superior miał SELECT po swoich `user_locations`, ale NIC poza tym (żadnych submit/approve/edit).
- `budget_plans`, `budget_items` – SELECT po lokalizacji dla superior; bez INSERT/UPDATE/DELETE.
- `calendar_events`, `admin_notes`, `notifications` – SELECT po lokalizacji.
- `locations`, `location_settings`, `location_accounts` – SELECT już jest dla wszystkich zalogowanych, OK.
- `provincial_fee_*`, `account_*_restrictions`, `knowledge_*` – SELECT jest publiczny dla zalogowanych, OK.

**Wzorzec dla polityki SELECT** (przykład dla `documents`):
```sql
DROP POLICY "Users can view documents from their location" ON public.documents;
CREATE POLICY "Users can view documents from their location"
ON public.documents FOR SELECT
USING (
  CASE
    WHEN get_user_role() = ANY (ARRAY['admin','prowincjal']) THEN true
    WHEN get_user_role() IN ('ekonom','proboszcz','superior','asystent','asystent_ekonoma_prowincjalnego','ekonom_prowincjalny')
      THEN location_id = ANY (get_user_location_ids())
    ELSE false
  END
);
```

**Twardy bezpiecznik – trigger anty-zapis dla roli superior** (na wypadek, gdyby gdzieś pominięto warunek w RLS):
```sql
CREATE OR REPLACE FUNCTION public.block_superior_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF get_user_role() = 'superior' THEN
    RAISE EXCEPTION 'Rola superior nie ma uprawnień do zapisu (tabela %)', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;
```
Podpiąć BEFORE INSERT/UPDATE/DELETE na: `documents`, `transactions`, `reports`, `report_account_details`, `report_*` (pozostałe), `budget_plans`, `budget_items`, `accounts`, `analytical_accounts`, `calendar_events`, `location_*`, `notifications` (jeśli zapisuje user).

### 2. Frontend – warstwa autoryzacji

**`src/context/AuthContext.tsx`:**
- Rozszerzyć typ `Role` o `'superior'`.
- Dodać do obiektu wystawianego z kontekstu pole `isReadOnly = user?.role === 'superior'`.
- `canCreateReports` – pozostaje bez `superior`.
- `canApproveReports` – bez `superior`.
- W `checkPermission`: dodać obsługę `case 'superior'` (lub po prostu dopuścić tę rolę do tras dla ekonoma w trybie odczytu – patrz niżej).

**`src/components/auth/ProtectedRoute.tsx`:**
- Dodać `'superior'` do typu Role.
- Dla tras wymagających `requiredRole="ekonom"` (np. `/kpir`) – zezwolić również dla `superior`, bo to tylko podgląd.

**`src/App.tsx`:**
- Trasy `/dokumenty`, `/wyszukaj-konta`, `/reports`, `/budzet`, `/wizualizacja`, `/kalendarz`, `/baza-wiedzy`, `/dashboard` – `superior` ma dostęp (nie wymagają `requiredRole`, więc OK).
- `/kpir` – dziś wymaga `ekonom` – zmienić na `requiredRole={['ekonom','superior','prowincjal','admin']}`.
- `/administracja` – NIE dla superior (zostaje).
- `/settings` – dozwolone (własny profil/2FA).

### 3. Frontend – ukrycie/wyłączenie akcji zapisu

Wprowadzić jeden helper `useIsReadOnly()` (lub użyć `isReadOnly` z AuthContext). Następnie w każdym miejscu, gdzie renderujemy CTA zapisu, dopiąć `disabled` lub `hidden`.

Miejsca do zmiany (z grepa po projekcie):
- **Dokumenty** (`src/pages/Documents/`):
  - `DocumentsPage.tsx` / `DocumentsTable.tsx` – ukryć przyciski „Nowy dokument", „Import CSV", „Import MT940", „Import Excel", „Duplikuj", „Usuń", „Edytuj" → zostawić tylko „Podgląd".
  - `DocumentDialog.tsx` – uruchamiać w trybie read-only: wszystkie pola `disabled`, brak przycisku „Zapisz", brak „Dodaj transakcję", brak „Rozbij", brak „Usuń". Pokazać banner „Tryb tylko do odczytu".
  - `TransactionEditDialog.tsx`, `TransactionSplitDialog.tsx`, `InlineTransactionRow.tsx`, `TransactionForm.tsx` – nie powinny się otwierać; jeśli się otworzą (np. z linku), również read-only.
- **Wyszukiwarka kont** (`src/pages/AccountSearch/`):
  - `AccountSearchPage.tsx` – ukryć „Utwórz dokument z zaznaczonych", „Eksport" zostawić.
  - `TransactionsList.tsx` – ukryć akcje edycji/usuwania.
- **Raporty** (`src/pages/Reports/`):
  - `ReportsPage.tsx` – ukryć „Nowy raport" (już opiera się o `canCreateReports`, więc OK).
  - `ReportDetails.tsx` – ukryć „Złóż do akceptacji", „Edytuj", „Usuń"; sekcja zatwierdzania używa `canApproveReports` – OK.
  - `ReportForm.tsx` – nie wchodzimy w nią dla superior.
  - `DeleteReportDialog.tsx` – ukryć trigger.
- **Budżet** (`src/pages/Budget/`):
  - `BudgetList.tsx`, `BudgetView.tsx`, `BudgetForm.tsx`, `BudgetItemsTable.tsx`, `BudgetImportDialog.tsx` – ukryć przyciski tworzenia/edycji/importu/zatwierdzania; zostawić podgląd, eksport XLSX, porównania.
- **KPIR** (`src/pages/KPIR/`):
  - `KpirPage.tsx`, `KpirTable.tsx`, `KpirOperationDialog.tsx`, `KpirEditDialog.tsx`, `KpirImportDialog.tsx`, `AccountsImport.tsx` – ukryć dodawanie/edycję/import; zostawić tabelę i eksport.
- **Kalendarz** (`src/pages/Calendar/`):
  - `EventDialog.tsx`, `CalendarView.tsx` – ukryć „Dodaj wydarzenie", „Edytuj", „Usuń".
- **Knowledge Base** (`src/pages/KnowledgeBase/`):
  - Uploady i edycja – ukryć dla superior (zostaje podgląd).
- **Dashboard** (`src/pages/Dashboard.tsx`):
  - Quick actions prowadzące do tworzenia – ukryć lub zamienić na linki do podglądu.
- **Header / Menu**:
  - `src/components/layout/Header.tsx` – upewnić się, że link do Administracji jest ukryty dla superior (już jest, bo wymaga admin/prowincjał).
- **Globalne przyciski**:
  - `ErrorReportButton` – ZOSTAWIĆ (zgłaszanie błędów jest po stronie user_id = auth.uid()).

### 4. UI – Administracja (tworzenie użytkownika superior)

**`src/pages/Administration/UserDialog.tsx`:**
- W `userSchema` rozszerzyć `z.enum([...])` o `'superior'`.
- W selektorze ról dodać opcję „Superior (tylko podgląd)".
- W `UsersManagement.tsx` – w wyświetlaniu roli przetłumaczyć `superior` na „Superior (podgląd)".
- Walidacja: superior MUSI mieć co najmniej jedną przypisaną lokalizację (`location_ids.length >= 1`) – dodać refinement w zod.

### 5. Edge functions
- `create-user-admin` – sprawdzić, czy nie ma listy dozwolonych ról; jeśli tak – dodać `superior`.
- Inne edge functions (notyfikacje, raporty) – brak zmian.

### 6. Test / weryfikacja
1. Utworzyć użytkownika z rolą superior przypisanego do np. Poznania (2-15).
2. Zalogować się – sprawdzić, że:
   - widzi dokumenty, transakcje, raporty, budżety, KPIR tylko dla Poznania,
   - nie widzi przycisków „Nowy", „Edytuj", „Usuń", „Importuj", „Złóż do akceptacji", „Zatwierdź",
   - nie ma dostępu do `/administracja`,
   - próba bezpośredniego POST do `documents` przez API kończy się błędem RLS / triggera `block_superior_writes`,
   - eksporty (XLSX, PDF) działają,
   - kalendarz i baza wiedzy są w trybie podglądu.
3. Potwierdzić, że istniejący ekonom / prowincjał / admin działają bez zmian.

## Szczegóły techniczne (dla dewelopera)

### Helper
W `AuthContext` dodać:
```ts
const isReadOnly = user?.role === 'superior';
```
i wyeksportować przez kontekst. Użyć wzorca `const { isReadOnly } = useAuth();` we wszystkich komponentach, w których są CTA zapisu.

### Wzorzec ukrywania CTA
```tsx
{!isReadOnly && <Button onClick={handleNew}>Nowy dokument</Button>}
```
W formularzach edycji:
```tsx
<Input {...field} disabled={isReadOnly || originalDisabled} />
...
{!isReadOnly && <Button type="submit">Zapisz</Button>}
```

### Banner w dialogach (gdy otwarte przez superior)
W `DocumentDialog`, `TransactionEditDialog`, `BudgetForm` itp. dodać na górze:
```tsx
{isReadOnly && (
  <Alert>Jesteś w trybie tylko do odczytu. Edycja jest niedostępna.</Alert>
)}
```

### Zabezpieczenie tras pisanych
W komponentach z mutacjami (np. `onSubmit` w `DocumentDialog`) dodać guard:
```ts
if (isReadOnly) return;
```
żeby uniknąć round-tripów do bazy zakończonych błędem RLS.

## Ryzyka
- Pominięte miejsca z mutacjami → łapie trigger `block_superior_writes` (twarda blokada).
- Polityki RLS dla `reports`/`report_account_details` używają `can_access_report` – funkcja już opiera się o `get_user_location_ids()`, więc superior automatycznie zyska SELECT bez zmian, o ile mamy go w `user_locations`.
- Lista ról w wielu plikach – konieczne `rg "'ekonom'"` i ręczne przejrzenie wszystkich gatingów (Dashboard, Header, ProtectedRoute).
