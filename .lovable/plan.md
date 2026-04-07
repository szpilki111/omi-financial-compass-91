

## Funkcjonalność: Automatyczne tworzenie operacji "procent na prowincję"

### Opis

Gdy użytkownik tworzy operację zawierającą konto z "listy kont prowincjalnych" (zdefiniowanej w administracji), system automatycznie tworzy dodatkową operację read-only z tytułem "procent na prowincję", z kwotą wyliczoną jako % od kwoty bazowej.

### Zakres zmian

#### 1. Baza danych — nowa tabela `provincial_fee_settings`

Tabela przechowująca konfigurację: procent i listę kont wyzwalających.

```sql
CREATE TABLE provincial_fee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_percentage numeric NOT NULL DEFAULT 0,
  target_debit_account_id uuid REFERENCES accounts(id),
  target_credit_account_id uuid REFERENCES accounts(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE provincial_fee_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id)
);
```

RLS: admin/prowincjal — pełny dostęp; reszta — SELECT.

#### 2. Administracja — nowa zakładka "Procent prowincjalny"

Nowy komponent `ProvincialFeeManagement.tsx` w `src/pages/Administration/`:
- Pole do ustawienia % (np. 10%)
- Selektor konta docelowego Wn i Ma dla automatycznej operacji
- Lista kont wyzwalających (dodawanie/usuwanie kont z listy za pomocą AccountCombobox)

Dodanie zakładki w `AdministrationPage.tsx`.

#### 3. Typ Transaction — nowe pole `is_provincial_fee`

W `src/pages/Documents/types.ts` dodać:
```typescript
is_provincial_fee?: boolean;
```

To pole oznacza operację jako automatycznie wygenerowaną i read-only.

#### 4. Logika auto-generowania w DocumentDialog.tsx

W funkcjach `addTransaction` i `addParallelTransaction`:
1. Po dodaniu operacji sprawdzić, czy `debit_account_id` lub `credit_account_id` jest na liście kont prowincjalnych (pobieranej z `provincial_fee_accounts`)
2. Jeśli tak — automatycznie dodać drugą operację:
   - `description`: "procent na prowincję"
   - `debit_account_id` / `credit_account_id`: z `provincial_fee_settings`
   - kwota: `bazowa_kwota * (fee_percentage / 100)`
   - `is_provincial_fee: true`

Analogicznie: przy usuwaniu operacji bazowej — usunąć powiązaną operację prowincjalną.

#### 5. UI — read-only dla operacji prowincjalnych

W komponentach renderujących wiersze transakcji (`EditableTransactionRow`, `SortableTransactionRow`):
- Jeśli `transaction.is_provincial_fee === true` — wszystkie pola disabled/readOnly
- Specjalne oznaczenie wizualne (np. tło fioletowe/szare, badge "Auto")
- Brak przycisku usuwania (usuwana razem z operacją bazową)

#### 6. Zapis do bazy

W `onSubmit` — operacje z `is_provincial_fee` zapisywane normalnie jako transakcje (pole nie jest w schemacie DB, więc nie jest wysyłane do Supabase — służy tylko do UI).

### Pliki do utworzenia
- `src/pages/Administration/ProvincialFeeManagement.tsx`

### Pliki do modyfikacji
- `src/pages/Documents/types.ts` — dodanie `is_provincial_fee`
- `src/pages/Documents/DocumentDialog.tsx` — logika auto-generowania w `addTransaction`/`addParallelTransaction`, query na konfigurację, read-only rendering
- `src/pages/Administration/AdministrationPage.tsx` — nowa zakładka

### Migracja SQL
- Tabele `provincial_fee_settings` i `provincial_fee_accounts` z politykami RLS

