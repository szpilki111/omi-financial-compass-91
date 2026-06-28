## Cel
Na stronie Dokumenty wyszukiwanie startuje już po wpisaniu pierwszej litery, co przeszkadza użytkownikowi. Trzeba zmienić zachowanie tak, by wyszukiwanie uruchamiało się dopiero po zatwierdzeniu (Enter lub przycisk "Szukaj").

## Zakres zmian
Plik: `src/pages/Documents/DocumentsPage.tsx`

1. Rozdzielić stan pola wyszukiwania na dwa:
   - `searchInput` — to, co użytkownik wpisuje w polu (kontrolowane lokalnie, nie wyzwala zapytania).
   - `searchQuery` — fraza faktycznie używana do filtrowania/zapytania do bazy (zmienia się tylko po zatwierdzeniu).

2. Wyzwalanie wyszukiwania:
   - Enter w polu input → `setSearchQuery(searchInput)`.
   - Klik ikony lupy (lub mały przycisk "Szukaj" obok) → to samo.
   - Wyczyszczenie pola (pusty input + Enter) → reset filtra.

3. useEffect/zapytania do Supabase pozostają bez zmian logicznie, ale zależą od `searchQuery` zamiast bieżącego inputu.

4. Placeholder pozostaje informacyjny: "Szukaj: numer, nazwa, lokalizacja, data (RRRR-MM), kwota, opis transakcji... (Enter aby szukać)".

## Co pozostaje bez zmian
- Logika parsowania daty/kwoty oraz wyszukiwania pośredniego (locations, transactions) — dokładnie ta sama.
- Filtr placówki (lewy dropdown) działa nadal natychmiastowo.
- Inne strony (KPIR, Raporty itd.) nie są ruszane — użytkownik mówił tylko o ekranie Dokumenty.

## Weryfikacja
- Wpisanie "rap" bez Enter nie powoduje filtrowania listy.
- Naciśnięcie Enter (lub kliknięcie lupy) filtruje wyniki po "rap".
- Wyczyszczenie pola + Enter przywraca pełną listę.
