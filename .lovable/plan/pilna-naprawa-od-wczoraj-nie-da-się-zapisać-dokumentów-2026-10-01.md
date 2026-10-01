# Pilna naprawa: od wczoraj nie da się zapisać dokumentów

## Przyczyna (moja wina)
Wczorajsza blokada zamrożonych placówek zawiera błąd. Jedna wspólna funkcja sprawdza zarówno dokumenty, jak i operacje. Przy każdym zapisie szuka w operacji pola „data dokumentu”, którego operacje nie mają. Przez to każdy zapis kończy się błędem, także w placówkach, które wcale nie są zamrożone.

Potwierdza to baza: ostatni zapisany dokument i ostatnia operacja mają godzinę 14:02 wczoraj, czyli chwilę przed wprowadzeniem blokady. Od tamtej pory nic się nie zapisało.

## Naprawa (kilka minut)
1. Zastąpię wspólną funkcję dwiema osobnymi: jedną dla dokumentów, drugą dla operacji. Każda sprawdza tylko własne pole daty.
2. Działanie blokady się nie zmienia: zamrożona placówka nie przyjmuje zapisów od daty zamrożenia, a pozostałe placówki działają normalnie.
3. Po naprawie sprawdzę w bazie, że funkcje są poprawne. Następny zapis użytkownika potwierdzi, że wszystko działa.
4. Dane nie zostały uszkodzone. Zapisy, które wczoraj wieczorem się nie powiodły, użytkownicy muszą wprowadzić ponownie.

## Szczegóły techniczne
- `enforce_location_not_frozen` używał `CASE WHEN TG_TABLE_NAME=... THEN NEW.document_date ELSE NEW.date END`. PL/pgSQL rozwiązuje wszystkie pola rekordu w wyrażeniu, więc wywołanie kończyło się błędem „record new has no field …” dla obu tabel.
- Migracja: `enforce_document_location_not_frozen()` (pole `document_date`) i `enforce_transaction_location_not_frozen()` (pole `date`), podmiana triggerów, usunięcie starej funkcji, `REVOKE EXECUTE` dla nowych funkcji.
