## Problem

Obecnie wyszukiwarka na stronie Dokumenty filtruje serwerowo tylko po dwóch polach:
- `document_number`
- `document_name`

Nie da się znaleźć dokumentu po opisie transakcji, nazwie placówki, dacie ani kwocie — stąd wrażenie "ograniczenia".

## Cel

Wyszukiwarka znajduje dokument, jeśli wpisana fraza pasuje do dowolnego z:
1. numer dokumentu
2. nazwa dokumentu
3. nazwa lokalizacji (Oblaci)
4. data dokumentu (np. `2025-05`, `05.2025`, `15.05.2025`)
5. kwota transakcji (np. `1234,56` lub `1234.56`)
6. opis dowolnej transakcji w dokumencie

Wszystkie warunki działają jako OR. Wyszukiwanie pozostaje serwerowe (paginacja po wszystkich dokumentach w bazie, nie tylko bieżąca strona).

## Zmiany w kodzie

Plik: `src/pages/Documents/DocumentsPage.tsx`, funkcja `queryFn` dla `['documents', ...]`.

Nowa logika (gdy `debouncedSearch` jest niepusty):

1. **Normalizacja frazy** — przyciąć spacje, zamienić przecinek na kropkę dla wariantu kwotowego, spróbować zinterpretować jako datę w formatach `YYYY-MM-DD`, `DD.MM.YYYY`, `YYYY-MM`, `MM.YYYY`.

2. **Pre-fetch ID dokumentów pasujących pośrednio** (równolegle, każde z `fetchAllRows` żeby nie obciąć na 1000):
   - `locations`: `id` gdzie `name ILIKE %fraza%` → potem `documents.location_id IN (...)`.
   - `transactions`: `document_id` gdzie `description ILIKE %fraza%` **lub** (jeśli fraza parsuje się jako liczba) `amount = X` lub `debit_amount = X` lub `credit_amount = X`.
   - Zbiór `matchedDocIds` = unia obu list.

3. **Główne zapytanie `documents`** — `.or(...)` z warunkami:
   - `document_number.ilike.%fraza%`
   - `document_name.ilike.%fraza%`
   - `id.in.(matchedDocIds)` (jeśli niepuste)
   - `document_date.eq.YYYY-MM-DD` (jeśli sparsowano pełną datę)
   - dla miesięcznej frazy (`YYYY-MM`): `document_date.gte.YYYY-MM-01,document_date.lte.YYYY-MM-<last>`

   Reszta (paginacja `range(from,to)`, sortowanie, filtr lokalizacji dla admina) bez zmian.

4. **Limit bezpieczeństwa** — jeśli `matchedDocIds` > 500 elementów, ciąć do pierwszych 500 i logować w konsoli (URL `.in()` ma limit długości). Przy realnym użyciu (jedna fraza opisu) tyle nie wystąpi; gdyby było — użytkownik dostanie pierwsze trafienia i komunikat w toaście "Zawęź wyszukiwanie".

## Czego NIE zmieniam

- Brak migracji SQL — pełnotekstowy indeks na razie zbędny, baza ma ~tysiące dokumentów.
- Brak zmian w RLS — używamy tylko istniejących polityk SELECT dla `documents`, `locations`, `transactions`.
- Brak zmian w UI — input wyszukiwarki pozostaje ten sam, tylko placeholder zaktualizuję na: „Szukaj: numer, nazwa, lokalizacja, data, kwota, opis transakcji”.
- Liczenie sumy/ilości transakcji per dokument — bez zmian (już używa `fetchAllRows`).

## Weryfikacja

1. Wpisać fragment opisu transakcji znanego dokumentu → dokument pojawia się na liście.
2. Wpisać nazwę placówki (np. „Łeba”) → wszystkie dokumenty tej placówki.
3. Wpisać `2025-05` → wszystkie dokumenty z maja 2025.
4. Wpisać kwotę np. `1500,00` → dokumenty zawierające taką transakcję.
5. Wpisać numer/nazwę dokumentu → działa jak dziś.
6. Pusta fraza → cała lista bez filtra.
