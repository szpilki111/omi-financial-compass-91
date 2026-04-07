

## Analiza zgłoszenia: "Niemożliwość zapisu dokumentu" — dokument z lutego zniknął po zmianie daty na marzec

### Co się stało

Użytkownik **edytował** istniejący dokument "BANK 2026.02" (luty) i zmienił mu datę na 31 marca. System:
1. Sprawdził `isEditingBlocked` dla **nowej daty** (marzec) — brak raportu → pozwolił zapisać
2. Zaktualizował dokument **in-place** (UPDATE, nie INSERT) — zmienił datę, numer dokumentu i daty transakcji na marzec
3. Dokument lutowy **zniknął** — nie został skopiowany, tylko przeniesiony
4. Teraz użytkownik nie może zmienić daty z powrotem na luty, bo raport za luty istnieje i blokuje edycję

### Przyczyna w kodzie

**`DocumentDialog.tsx`, linia 161-173**: sprawdzenie `isEditingBlocked` używa `documentDate` (aktualnej daty z formularza), a nie oryginalnej daty dokumentu. Gdy użytkownik zmienia datę z lutego na marzec, walidacja sprawdza marzec (wolny) zamiast lutego (zablokowany raportem).

**Brakuje dwóch zabezpieczeń:**
1. Przy edycji istniejącego dokumentu nie sprawdza się, czy **oryginalna data** (luty) jest zablokowana raportem — zmiana daty powinna być zablokowana, jeśli oryginalny okres jest zamknięty raportem
2. Nie ma sprawdzenia, czy zmiana daty przenosi dokument **z** zablokowanego okresu

### Proponowane rozwiązanie

**Plik: `src/pages/Documents/DocumentDialog.tsx`**

1. Dodać **drugie sprawdzenie** — czy oryginalna data dokumentu jest zablokowana raportem. Jeśli tak, zablokować zmianę daty na inny miesiąc.

2. W `onSubmit` dodać walidację: jeśli edytujemy dokument i zmieniliśmy miesiąc/rok, sprawdzić czy stary okres jest zablokowany raportem. Jeśli tak — zablokować zapis z komunikatem.

Konkretnie:
- Zapamiętać oryginalną datę dokumentu (`document.document_date`) przy otwarciu
- W `onSubmit` porównać miesiąc/rok nowej daty z oryginalną
- Jeśli się różnią i oryginalny okres ma raport → zablokować z komunikatem: "Nie można przenieść dokumentu z okresu, za który istnieje raport"

### Natychmiastowa pomoc dla użytkownika

Administrator musi ręcznie w Supabase zmienić datę dokumentu z powrotem na luty (UPDATE na tabeli `documents` i `transactions`), lub odblokować raport za luty, poprawić datę, i ponownie złożyć raport. Mogę pomóc przygotować zapytanie SQL jeśli potrzebne.

### Zakres zmian
- Jeden plik: `src/pages/Documents/DocumentDialog.tsx`
- Dodanie walidacji w `onSubmit` (~15 linii)
- Opcjonalnie: komunikat informujący dlaczego zmiana daty jest zablokowana

