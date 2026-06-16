## Problem

Automatyczny wiersz „procent na prowincję" (50%/30%) jest oznaczony jako `is_provincial_fee` (rozpoznawany po opisie `procent na prowincję`) i w UI ma w kolumnie akcji tylko etykietę **„Auto"** zamiast kosza. Funkcje `removeTransaction` / `removeParallelTransaction` dodatkowo twardo blokują usunięcie takiego wiersza (`if (tx.is_provincial_fee) return prev;`).

Skutek (Lubliniec, maj): po skopiowaniu dokumentu wiersz prowincyjny zostaje jako osierocony zapis bez kont (świeci się na czerwono), nie da się go usunąć inaczej niż przez skasowanie całego dokumentu — co blokuje złożenie raportu.

## Rozwiązanie

Pozwolić usuwać pojedynczy wiersz „procent na prowincję" ręcznie, zachowując dotychczasową logikę „usuń bazę → usuń też powiązany automat".

### Zmiany w `src/pages/Documents/DocumentDialog.tsx`

1. **`removeTransaction` (linia 1287) i `removeParallelTransaction` (linia 1301)** — usunąć linijkę `if (tx.is_provincial_fee) return prev;`. Pozostała logika (gdy usuwamy bazę z następującym po niej wierszem prowincyjnym, kasujemy oba) zostaje bez zmian.

2. **`EditableTransactionRow` render akcji (linia ~2713)** — zamiast `isProvincialFee ? <span>Auto</span> : <akcje>` pokazywać dla wiersza prowincyjnego sam przycisk kosza (bez „Kopiuj" i „Rozdziel", które nie mają sensu dla automatu). Tooltip: „Usuń automat prowincyjny".

### Czego NIE ruszamy

- Logiki tworzenia automatu (`useProvincialFee`).
- `duplicate_document` w bazie — duplikowanie nadal kopiuje wiersz z `description = 'procent na prowincję'`, ale teraz da się go ręcznie usunąć po skopiowaniu.
- Zapisu w DB — usunięcie po stronie stanu front-endu trafia do istniejącej ścieżki `supabase.from("transactions").delete().in("id", ...)` w `handleSave` (linia ~1106).
- Walidacji / blokad raportu — czerwone podświetlenie zniknie naturalnie po usunięciu pustego wiersza.

## Weryfikacja

1. Otworzyć dokument Lublińca z osieroconym wierszem prowincyjnym → w wierszu „Auto" widać kosz → klik → wiersz znika → Zapisz → dokument przestaje być na czerwono → raport za maj da się złożyć.
2. Stary scenariusz: usunięcie bazowego wiersza nadal kasuje powiązany automat (oba wiersze znikają jednym kliknięciem).
3. Dodanie nowego dokumentu z kontem 7xx z automatem → automat tworzy się jak dotąd; można go osobno usunąć, jeżeli ekonom się rozmyśli.