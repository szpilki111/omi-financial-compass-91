
-- FAZA 1: Usunięcie testowej notatki
DELETE FROM admin_notes WHERE id = '013e5822-e7fd-4b61-a6a2-bddf8c57723e';

-- FAZA 2.1: UPDATE Dokumenty - Kompletny Podręcznik
UPDATE admin_notes SET content = '## 📄 Dokumenty Finansowe - Kompletny Podręcznik

### Spis treści
1. Wprowadzenie do dokumentów
2. Tworzenie nowego dokumentu
3. Waluty obce
4. Struktura operacji księgowej
5. Dodawanie operacji
6. Walidacja i bilans
7. Zapisywanie i edycja
8. Blokady dokumentów
9. Dobre praktyki

---

### 1. Wprowadzenie do dokumentów

**Dokument finansowy** to podstawowa jednostka ewidencji księgowej w systemie. Każdy dokument zawiera jedną lub więcej **operacji księgowych** (zapisów na kontach).

**Typowe dokumenty:**
- Faktury zakupowe
- Wyciągi bankowe
- Rachunki
- Dokumenty kasowe
- Noty księgowe

> 💡 **Wskazówka**: Jeden dokument może zawierać wiele operacji - np. cały wyciąg bankowy w jednym dokumencie.

---

### 2. Tworzenie nowego dokumentu

**Krok 1:** Przejdź do menu **Dokumenty**

**Krok 2:** Kliknij przycisk **"Nowy dokument"**

**Krok 3:** Wypełnij nagłówek dokumentu:

| Pole | Opis | Wymagane | Przykład |
|------|------|----------|----------|
| Nazwa dokumentu | Krótki opis | ✅ Tak | "Faktura za prąd 12/2024" |
| Data dokumentu | Data wystawienia | ✅ Tak | 15.12.2024 |
| Numer dokumentu | **Generowany automatycznie** | 🔒 Auto | "OMI/2025/02/003" |
| Waluta | Domyślnie PLN | ✅ Tak | PLN / EUR / USD |

⚠️ **Numer dokumentu** jest generowany automatycznie na podstawie skrótu placówki, roku, miesiąca i kolejnego numeru sekwencyjnego. **Nie można go edytować ręcznie** — jest polem tylko do odczytu.

⚠️ **Data dokumentu** wpływa na to, do którego miesiąca raportowego zostanie przypisany! Zmiana daty na inny miesiąc automatycznie przelicza numer dokumentu.

> 💡 **Wskazówka**: Możesz tworzyć dokumenty z datami przyszłymi — system nie blokuje dat „do przodu".

---

### 3. Waluty obce

System obsługuje **6 walut**: PLN, EUR, USD, CAD, NOK, AUD.

**Jak utworzyć dokument walutowy:**
1. Przy tworzeniu dokumentu zmień walutę z PLN na inną
2. Wprowadź **kurs wymiany** (ręcznie lub kliknij „Pobierz kurs NBP")
3. Dodaj operacje — kwoty wprowadzasz w wybranej walucie

**Przełączanie widoku walutowego:**
- W nagłówku dokumentu walutowego pojawia się przycisk **🔄 PLN / waluta**
- Kliknij aby przełączyć widok kwot operacji:
  - **Widok waluty**: kwoty w oryginalnej walucie (np. 100 EUR)
  - **Widok PLN**: kwoty przeliczone po kursie (np. 430 PLN)
- W trybie PLN pola kwot są **tylko do odczytu** (widok informacyjny)

**Kurs wymiany:**
- Kurs jest zapisywany **per dokument** i **per transakcja**
- Podsumowanie dokumentu zawsze wyświetla łączną wartość w PLN
- Kurs NBP pobierany jest z tabeli kursów średnich

> ⚠️ **Ważne**: Waluty obce są dostępne tylko dla placówek, które mają włączoną opcję „Obsługa walut obcych" w ustawieniach lokalizacji.

---

### 4. Struktura operacji księgowej

Każda operacja składa się z **dwóch stron** zgodnie z zasadą podwójnego zapisu:

```
┌──────────────────────────────────────────────────────────┐
│ [≡] [Lp] [☐] │ Opis operacji │ Kwota Wn │ Konto Wn │ Kwota Ma │ Konto Ma │
└──────────────────────────────────────────────────────────┘
```

| Element | Opis |
|---------|------|
| [≡] | Uchwyt do przeciągania (zmiana kolejności) |
| [Lp] | Numer porządkowy operacji |
| [☐] | Checkbox do zaznaczenia (usuwanie wielu) |
| Opis | Treść operacji |
| Kwota Wn | Kwota po stronie WINIEN (debet) |
| Konto Wn | Konto księgowe dla strony WINIEN |
| Kwota Ma | Kwota po stronie MA (kredyt) |
| Konto Ma | Konto księgowe dla strony MA |

---

### 5. Dodawanie operacji

**Krok 1:** Kliknij **"Dodaj operację"** pod tabelą operacji

**Krok 2:** Wypełnij opis operacji (np. "Opłata za energię elektryczną")

**Krok 3:** Wprowadź kwotę po stronie **Winien** lub **Ma**
- System automatycznie uzupełni drugą stronę tą samą kwotą

**Krok 4:** Wybierz konta księgowe:
- Kliknij w pole konta
- Wpisz numer lub nazwę konta
- Wybierz z listy

> 💡 **Wskazówka**: Możesz wyszukiwać konta zarówno po **numerze** (np. "401") jak i po **nazwie** (np. "energia").

**Przykład kompletnej operacji:**

| Opis | Kwota Wn | Konto Wn | Kwota Ma | Konto Ma |
|------|----------|----------|----------|----------|
| Opłata za prąd | 500,00 | 401-2-3 Energia | 500,00 | 131-2-3 Bank |

---

### 6. Walidacja i bilans

System waliduje dokument przed zapisem:

**Zasada bilansowania:**
```
Σ Kwot Winien = Σ Kwot Ma
```

⚠️ **Dokument niezrównoważony nie może być zapisany!**

**Typowe błędy walidacji:**
| Błąd | Przyczyna | Rozwiązanie |
|------|-----------|-------------|
| Brak konta | Nie wybrano konta | Wybierz konto z listy |
| Brak kwoty | Puste pole kwoty | Wprowadź kwotę |
| Brak bilansu | Wn ≠ Ma | Sprawdź kwoty |
| Brak opisu | Puste pole opisu | Dodaj opis operacji |

> 💡 **Wskazówka**: Podsumowanie bilansu jest widoczne na dole tabeli operacji w czasie rzeczywistym.

---

### 7. Zapisywanie i edycja

**Zapisywanie:**
1. Sprawdź czy dokument jest zbilansowany
2. Kliknij przycisk **"Zapisz"**
3. System potwierdzi zapisanie dokumentu

**Edycja istniejącego dokumentu:**
1. Znajdź dokument na liście
2. Kliknij na wiersz dokumentu
3. Wprowadź zmiany
4. Zapisz dokument

---

### 8. Blokady dokumentów

⚠️ **Kiedy dokument jest zablokowany?**

Dokument jest zablokowany do edycji i usuwania, gdy istnieje **raport** za dany okres (miesiąc/rok) dla danej lokalizacji — **niezależnie od statusu raportu** (wersja robocza, złożony, zatwierdzony, odrzucony).

**Co robić, gdy dokument jest zablokowany:**
1. Jeśli raport jest w wersji roboczej — ekonom może go usunąć, edytować dokument, i utworzyć raport ponownie
2. Jeśli raport został złożony/zatwierdzony — skontaktuj się z **Administratorem**, który może użyć funkcji **"Odblokuj raport"**

> 💡 **Wskazówka**: Zanim złożysz raport, upewnij się, że wszystkie dokumenty za dany miesiąc są kompletne i poprawne!

---

### 9. Dobre praktyki

**DO (Rób tak):**
- ✅ Twórz dokumenty na bieżąco, nie czekaj do końca miesiąca
- ✅ Używaj opisowych nazw operacji
- ✅ Sprawdzaj bilans przed zapisem
- ✅ Grupuj powiązane operacje w jednym dokumencie
- ✅ Dla walut obcych — pobieraj kurs NBP z dnia operacji

**DON''T (Nie rób tak):**
- ❌ Nie zostawiaj niekompletnych dokumentów
- ❌ Nie używaj skrótów w opisach
- ❌ Nie zapisuj niezrównoważonych dokumentów
- ❌ Nie edytuj zamkniętych okresów

---

### Podsumowanie

- ✅ Dokument = nagłówek + operacje księgowe
- ✅ Numer dokumentu generowany automatycznie (read-only)
- ✅ Obsługa 6 walut: PLN, EUR, USD, CAD, NOK, AUD
- ✅ Każda operacja ma stronę Winien i Ma
- ✅ Σ Winien musi = Σ Ma (bilans)
- ✅ Raport za dany okres blokuje edycję dokumentów

---
*Ostatnia aktualizacja: Luty 2026*', updated_at = now()
WHERE id = 'ec15da5b-93da-482d-a600-0bc25e8a215f';

-- FAZA 2.2: UPDATE Import Danych - CSV i MT940
UPDATE admin_notes SET content = '## 📥 Import Danych - Przewodnik po CSV, MT940 i Excel

### Spis treści
1. Wprowadzenie do importu
2. Import plików CSV
3. Import wyciągów MT940
4. Import z formularza Excel
5. Automatyczne mapowanie kont
6. Walidacja pre-importowa
7. Obsługa kodowania znaków
8. Rozwiązywanie problemów

---

### 1. Wprowadzenie do importu

System obsługuje **automatyczny import** danych z plików zewnętrznych, co znacznie przyspiesza wprowadzanie dużej liczby operacji.

**Obsługiwane formaty:**
| Format | Opis | Typowe źródło |
|--------|------|---------------|
| CSV | Wartości rozdzielone przecinkiem/średnikiem | Excel, systemy księgowe |
| MT940 | Standard bankowy SWIFT | Wyciągi bankowe |
| Excel | Plik .xlsx z formularzem | Szablony, arkusze kalkulacyjne |

---

### 2. Import plików CSV

**Krok 1:** W oknie dokumentu kliknij **"Import CSV"**

**Krok 2:** Wybierz plik CSV z dysku

**Krok 3:** Zmapuj kolumny:
| Kolumna w pliku | Pole w systemie |
|-----------------|-----------------|
| Data | Data operacji |
| Opis | Opis operacji |
| Kwota | Kwota Wn lub Ma |
| Konto | Numer konta |

**Krok 4:** Potwierdź import

**Wymagany format CSV:**
```
Data;Opis;Kwota;Konto
2024-12-15;Opłata za prąd;500.00;401-2-3
2024-12-16;Wpłata gotówki;1000.00;100-2-3
```

> 💡 **Wskazówka**: Używaj średnika (;) jako separatora - przecinek może powodować problemy z kwotami.

---

### 3. Import wyciągów MT940

**MT940** to międzynarodowy standard wyciągów bankowych.

**Krok 1:** Pobierz wyciąg MT940 z bankowości elektronicznej

**Krok 2:** W oknie dokumentu kliknij **"Import MT940"**

**Krok 3:** Wybierz plik MT940 (.sta, .mt940, .txt)

**Krok 4:** System automatycznie rozpozna:
- Numer rachunku
- Daty operacji
- Kwoty i opisy
- Salda początkowe i końcowe

**Krok 5:** Przypisz konta księgowe do zaimportowanych operacji

⚠️ **Uwaga**: Po imporcie MT940 musisz ręcznie przypisać konta księgowe.

---

### 4. Import z formularza Excel

Możesz importować operacje z pliku Excel (.xlsx):

**Krok 1:** W oknie dokumentu kliknij **"Import z Excel"**

**Krok 2:** Wybierz plik .xlsx

**Krok 3:** System rozpozna kolumny:
- Opis operacji
- Kwota Wn / Kwota Ma
- Numer konta Wn / Numer konta Ma

**Krok 4:** Podgląd i potwierdzenie importu

> 💡 **Wskazówka**: Format Excel jest wygodny gdy przygotowujesz operacje w arkuszu kalkulacyjnym przed wprowadzeniem do systemu.

---

### 5. Automatyczne mapowanie kont

Podczas importu system automatycznie mapuje **konta syntetyczne na analityczne** Twojej lokalizacji:

**Przykład:** Plik zawiera konto `420` (syntetyczne)
- System sprawdza Twoją lokalizację (np. identyfikator `2-3`)
- Automatycznie mapuje na `420-2-3` (konto analityczne)

**Reguły mapowania:**
| W pliku | Wynik po imporcie | Warunek |
|---------|-------------------|---------|
| `420` | `420-2-3` | Istnieje konto analityczne 420-2-3 |
| `420-2-3` | `420-2-3` | Już pełne konto — bez zmian |
| `999` | ⚠️ Błąd | Konto nie istnieje w systemie |

> 💡 **Wskazówka**: Nie musisz dodawać sufiksu lokalizacji do kont w pliku importu — system zrobi to automatycznie!

---

### 6. Walidacja pre-importowa

Przed importem system sprawdza:

| Sprawdzenie | Co się stanie |
|-------------|---------------|
| **Blokada raportu** | ❌ Import zablokowany, jeśli istnieje raport za dany okres |
| **Brakujące konta** | ⚠️ Ostrzeżenie o kontach nieistniejących w systemie |
| **Konta syntetyczne** | 🔄 Automatyczna próba mapowania na analityczne |
| **Bilans operacji** | ⚠️ Ostrzeżenie jeśli Wn ≠ Ma |

⚠️ **Ważne**: Jeśli za dany miesiąc istnieje raport (w dowolnym statusie), import jest **całkowicie zablokowany**. Najpierw usuń lub odblokuj raport.

---

### 7. Obsługa kodowania znaków

System automatycznie wykrywa i konwertuje kodowanie plików:

| Kodowanie | Opis | Obsługa |
|-----------|------|---------|
| UTF-8 | Standard międzynarodowy | ✅ Automatyczna detekcja |
| UTF-8 BOM | UTF-8 z nagłówkiem | ✅ Automatyczna detekcja |
| Windows-1250 | Polski Windows | ✅ Automatyczna konwersja |
| ISO-8859-2 | Standard środkowoeuropejski | ✅ Automatyczna konwersja |

> 💡 **Wskazówka**: Jeśli polskie znaki wyświetlają się nieprawidłowo, zapisz plik w UTF-8 przed importem.

---

### 8. Rozwiązywanie problemów

| Problem | Przyczyna | Rozwiązanie |
|---------|-----------|-------------|
| Polskie znaki jako "krzaczki" | Złe kodowanie pliku | Zapisz plik jako UTF-8 |
| Puste kolumny | Zły separator | Użyj średnika zamiast przecinka |
| Błędne kwoty | Przecinek w liczbach | Zamień "1,000.00" na "1000.00" |
| „Import zablokowany" | Istnieje raport za ten okres | Usuń lub odblokuj raport |
| „Konto nie znalezione" | Brak konta w systemie | Dodaj konto lub popraw numer w pliku |
| Brak automatycznego mapowania | Konto syntetyczne bez analitycznego | Utwórz konto analityczne w Ustawienia → Konta |

---

### Podsumowanie

- ✅ CSV dla danych z Excela i innych systemów
- ✅ MT940 dla wyciągów bankowych
- ✅ Excel dla formularzy przygotowanych w arkuszach
- ✅ Automatyczne mapowanie kont syntetycznych na analityczne
- ✅ Walidacja blokad raportów przed importem
- ✅ System automatycznie konwertuje kodowanie znaków

---
*Ostatnia aktualizacja: Luty 2026*', updated_at = now()
WHERE id = 'bbd23048-bc7f-4dbf-9744-06e68f0289d2';

-- FAZA 2.3: UPDATE Planowanie Budżetu
UPDATE admin_notes SET content = '## 💰 Planowanie Budżetu Rocznego - Kompletny Przewodnik

### Spis treści
1. Co to jest budżet
2. Tworzenie budżetu
3. Import budżetu z pliku Excel
4. Metody prognozowania
5. Modyfikatory budżetowe
6. Załączniki i notatki
7. Składanie do zatwierdzenia
8. Kopiowanie z poprzedniego roku
9. Eksport do Excel
10. Porównania wieloletnie

---

### 1. Co to jest budżet

**Budżet roczny** to plan finansowy placówki na nadchodzący rok. Zawiera:

- 📈 **Planowane przychody** - źródła finansowania (ofiary, dotacje, etc.)
- 📉 **Planowane rozchody** - przewidywane koszty (energia, remonty, etc.)
- 🎯 **Cele finansowe** - planowana redukcja kosztów, inwestycje

> 💡 **Wskazówka**: Budżet tworzysz raz w roku, ale możesz go monitorować na bieżąco przez cały rok.

---

### 2. Tworzenie budżetu

**Krok 1:** Przejdź do **Budżet** → **Nowy budżet**

**Krok 2:** Wybierz parametry:
| Pole | Opis |
|------|------|
| Rok | Rok budżetowy (np. 2026) |
| Lokalizacja | Twoja placówka (admin może wybrać dowolną) |
| Metoda prognozowania | Sposób wyliczenia prognoz |

**Krok 3:** Wypełnij pozycje budżetowe

⚠️ **Uwaga**: Dla jednej lokalizacji można mieć **tylko jeden budżet na rok**. Jeśli budżet już istnieje, należy go usunąć przed utworzeniem nowego.

---

### 3. Import budżetu z pliku Excel

Zamiast ręcznego wypełniania pozycji, możesz zaimportować budżet z pliku Excel (.xlsx).

**Krok 1:** Kliknij **"Importuj z pliku"** w formularzu nowego budżetu

**Krok 2:** Pobierz **szablon** klikając „Pobierz szablon Excel"

**Szablon zawiera 5 kolumn:**
| Kolumna | Opis | Przykład | Wymagana |
|---------|------|----------|----------|
| Numer konta | 3-cyfrowy prefiks konta | 701 | ✅ Tak |
| Nazwa | Opis pozycji budżetowej | Ofiary wiernych | ✅ Tak |
| Typ | „przychód" lub „koszt" | przychód | ✅ Tak |
| Kwota planowana | Planowana kwota w PLN | 50000 | ✅ Tak |
| Wykonanie roku poprzedniego | Kwota z poprzedniego roku | 48000 | Opcjonalna |

**Krok 3:** Wypełnij szablon danymi

**Krok 4:** Wgraj plik — system pokaże **podgląd pierwszych 10 pozycji**

**Krok 5:** Potwierdź import

> 💡 **Wskazówki do importu:**
> - Numery kont: prefiksy 3-cyfrowe (np. 701, 401)
> - Typ: wpisz „przychód" (lub fragment) — wszystko inne = „koszt"
> - Kwoty: mogą zawierać spacje i przecinki (np. „50 000,00" → system oczyści automatycznie)
> - Importowany budżet otrzymuje status **„Projekt"** (wersja robocza)

---

### 4. Metody prognozowania

System oferuje **3 metody** automatycznego wyliczania prognoz:

| Metoda | Opis | Kiedy używać |
|--------|------|-------------|
| **Ostatni rok** | Kwoty z poprzedniego roku | Stabilne finanse, brak zmian |
| **Średnia 3 lat** | Średnia z ostatnich 3 lat | Uśrednienie wahań |
| **Ręcznie** | Wprowadzasz wartości sam | Znaczące zmiany planowane |

---

### 5. Modyfikatory budżetowe

| Modyfikator | Opis | Przykład |
|-------------|------|----------|
| **Prognozowane inne wydatki** | Dodatkowe koszty nieprzewidziane | Remont dachu: 50.000 PLN |
| **Planowana redukcja kosztów** | Oczekiwane oszczędności | Wymiana okien = -20% na ogrzewaniu |

---

### 6. Załączniki i notatki

- **Załączniki:** Dołącz pliki (PDF, obrazy) — np. kosztorysy remontów
- **Komentarze:** Dodatkowe wyjaśnienia dla Prowincjała

---

### 7. Składanie do zatwierdzenia

**Workflow budżetu:**

```
  📝 Wersja robocza (Projekt)
         │
         ▼
    [Ekonom składa]
         │
         ▼
     📤 Złożony
         │
    ┌────┴────┐
    ▼         ▼
✅ Zatwierdzony  ❌ Odrzucony
```

⚠️ **Uwaga**: Po zatwierdzeniu budżet staje się **tylko do odczytu**!

---

### 8. Kopiowanie z poprzedniego roku

1. W formularzu nowego budżetu kliknij **"Kopiuj z poprzedniego roku"**
2. System skopiuje pozycje budżetowe i kwoty planowane
3. Dostosuj wartości do nowego roku

---

### 9. Eksport do Excel

Budżet oraz porównania wieloletnie można wyeksportować do pliku Excel:

1. Otwórz budżet lub porównanie wieloletnie
2. Kliknij **"Eksport do Excel"** (ikona 📊)
3. Plik .xlsx zawiera:
   - Arkusz „Podsumowanie" — rok, przychody, rozchody, bilans
   - Arkusz „Przychody" — szczegółowe pozycje przychodów
   - Arkusz „Rozchody" — szczegółowe pozycje rozchodów

---

### 10. Porównania wieloletnie

Moduł **Porównania wieloletnie** pozwala zestawić budżety z kilku lat obok siebie:

- Tabela porównawcza: przychody, rozchody i bilans rok po roku
- Szczegółowe zestawienie kont: jak zmieniały się poszczególne pozycje
- Eksport całości do Excela

> 💡 **Wskazówka**: Porównania wieloletnie ułatwiają identyfikację trendów — np. czy koszty energii rosną rok do roku.

---

### Podsumowanie

- ✅ Budżet to roczny plan finansowy
- ✅ Importuj budżet z pliku Excel (szablon 5-kolumnowy)
- ✅ Wybierz metodę prognozowania odpowiednią dla placówki
- ✅ Używaj modyfikatorów dla specjalnych korekt
- ✅ Eksportuj budżet i porównania wieloletnie do Excela
- ✅ Po zatwierdzeniu budżet jest read-only

---
*Ostatnia aktualizacja: Luty 2026*', updated_at = now()
WHERE id = 'a03c3df0-400f-4896-a4c0-1f7788ee1a4d';

-- FAZA 2.4: UPDATE Raporty
UPDATE admin_notes SET content = '## 📊 Raporty Miesięczne - Kompletny Workflow

### Spis treści
1. Co to jest raport miesięczny
2. Tworzenie raportu
3. Składanie do zatwierdzenia
4. Proces zatwierdzania
5. Eksport i drukowanie
6. Statusy raportów
7. Blokady i odblokowywanie
8. Eksport dwustronicowy

---

### 1. Co to jest raport miesięczny

**Raport miesięczny** to oficjalne sprawozdanie finansowe placówki za dany miesiąc. Zawiera:

- 📈 Podsumowanie przychodów i rozchodów
- 💰 Salda kont na początek i koniec miesiąca
- 📝 Szczegółowe zestawienie obrotów
- 📊 Porównanie z budżetem (opcjonalnie)

> 💡 **Wskazówka**: Raport automatycznie agreguje dane ze wszystkich dokumentów z danego miesiąca.

---

### 2. Tworzenie raportu

**Krok 1:** Przejdź do menu **Raporty** → **Nowy raport**

**Krok 2:** Wybierz parametry:
| Pole | Opis |
|------|------|
| Miesiąc | Miesiąc sprawozdawczy (np. Grudzień) |
| Rok | Rok sprawozdawczy (np. 2025) |
| Lokalizacja | Twoja placówka (auto-wybrana) |

**Krok 3:** Kliknij **"Utwórz raport"**

**Krok 4:** System automatycznie:
- Pobierze wszystkie dokumenty z wybranego miesiąca
- Obliczy obroty na kontach
- Wygeneruje podsumowanie finansowe

⚠️ **Uwaga**: Jeśli w wybranym miesiącu są niekompletne dokumenty, system wyświetli ostrzeżenie.

---

### 3. Składanie do zatwierdzenia

**Krok 1:** Otwórz utworzony raport

**Krok 2:** Sprawdź dane:
- Przejrzyj podsumowanie finansowe
- Sprawdź czy wszystkie operacje są uwzględnione
- Dodaj komentarz (opcjonalnie)

**Krok 3:** Kliknij **"Złóż do zatwierdzenia"**

> ⚠️ **Ważne**: Po złożeniu raportu — a nawet po samym **utworzeniu** raportu — dokumenty z tego miesiąca są **zablokowane** do edycji i usuwania!

---

### 4. Proces zatwierdzania

**Dla Prowincjała/Admina:**

**Krok 1:** Przejdź do **Raporty** → filtruj po statusie

**Krok 2:** Otwórz raport do przeglądu

**Krok 3:** Podejmij decyzję:

| Akcja | Kiedy | Efekt |
|-------|-------|-------|
| ✅ **Zatwierdź** | Raport jest poprawny | Status → "Zatwierdzony" |
| ❌ **Odrzuć** | Wymaga poprawek | Status → "Odrzucony" + komentarz |
| 🔄 **Do poprawy** | Drobne poprawki potrzebne | Status → "Do poprawy" |

---

### 5. Eksport i drukowanie

**Eksport do PDF:**
1. Otwórz raport → Kliknij **"Eksport PDF"**
2. Dostępne warianty: kompaktowy (1-stronicowy) i pełny (2-stronicowy)

**Eksport do Excel:**
1. Otwórz raport → Kliknij **"Eksport Excel"**
2. Plik zawiera pełne zestawienie obrotów i sald

---

### 6. Statusy raportów

| Status | Ikona | Opis | Kto może zmienić |
|--------|-------|------|------------------|
| Wersja robocza | 📝 | Raport w przygotowaniu | Ekonom |
| Złożony | 📤 | Oczekuje na zatwierdzenie | Prowincjał |
| Zatwierdzony | ✅ | Zaakceptowany | (niemożliwa zmiana) |
| Odrzucony | ❌ | Wymaga poprawek | Ekonom (ponowne złożenie) |
| **Do poprawy** | 🔄 | Drobne korekty potrzebne | Ekonom (poprawia i składa ponownie) |

**Diagram workflow:**

```
  📝 Wersja robocza
         │
         ▼
    [Ekonom składa]
         │
         ▼
     📤 Złożony
         │
    ┌────┼────────┐
    ▼    ▼        ▼
 ✅ Zatwierdzony  🔄 Do poprawy  ❌ Odrzucony
                    │               │
                    └───────────────┘
                           │
                      [Ekonom poprawia]
                           │
                           ▼
                     📝 Wersja robocza
```

---

### 7. Blokady i odblokowywanie

⚠️ **Raport z DOWOLNYM statusem** (nawet wersja robocza!) **blokuje edycję i usuwanie dokumentów** za dany miesiąc.

**Dlaczego?** Aby zapewnić spójność danych — raport jest „migawką" stanu finansowego i zmiana dokumentów po jego utworzeniu mogłaby go unieważnić.

**Funkcja „Odblokuj raport" (tylko Admin):**
1. Administrator wchodzi w szczegóły raportu
2. Klika **"Odblokuj raport"**
3. Raport wraca do statusu wersji roboczej
4. Dokumenty z tego miesiąca są ponownie dostępne do edycji

> 💡 **Wskazówka**: Jeśli musisz poprawić dokument z zamkniętego miesiąca — poproś Administratora o odblokowanie raportu.

---

### 8. Eksport dwustronicowy

Pełny eksport raportu do PDF generuje **2-stronicowy** dokument:

**Strona 1 — Sprawozdanie finansowe:**
- Saldo początkowe i końcowe
- Tabela bilansowa (aktywa i pasywa)
- Intencje mszalne
- Należności i zobowiązania

**Strona 2 — Zestawienie obrotów:**
- Przychody (konta 7xx) — szczegółowe zestawienie
- Rozchody (konta 4xx) — szczegółowe zestawienie
- Podsumowania grupowe i łączne

---

### Podsumowanie

- ✅ Raport automatycznie agreguje dokumenty z miesiąca
- ✅ Sprawdź dane przed złożeniem
- ✅ Status „Do poprawy" — drobne korekty bez pełnego odrzucenia
- ✅ Raport z DOWOLNYM statusem blokuje dokumenty
- ✅ Admin może odblokować raport
- ✅ Eksport 2-stronicowy: bilans + zestawienie obrotów

---
*Ostatnia aktualizacja: Luty 2026*', updated_at = now()
WHERE id = '5fd2e6f7-c1d5-423b-bed1-40ebbbf73e53';

-- FAZA 2.5: UPDATE Wyszukiwanie Kont
UPDATE admin_notes SET content = '## 🔍 Wyszukiwanie Kont - Mistrzowski Przewodnik

### Spis treści
1. Wprowadzenie
2. Wyszukiwanie konta
3. Obroty miesięczne
4. Podsumowanie walutowe
5. Lista transakcji
6. Edycja z poziomu wyszukiwarki
7. Eksport danych

---

### 1. Wprowadzenie

Moduł **Wyszukiwanie Kont** pozwala na szczegółową analizę obrotów i transakcji na wybranym koncie księgowym.

**Co możesz sprawdzić:**
- Obroty miesięczne (Wn/Ma)
- Saldo konta
- Listę wszystkich transakcji
- Dokumenty powiązane z transakcjami
- **Podsumowanie walutowe** (jeśli na koncie są operacje w walutach obcych)

---

### 2. Wyszukiwanie konta

**Krok 1:** Przejdź do **Wyszukiwanie kont**

**Krok 2:** Wprowadź numer lub nazwę konta:
- Po numerze: "401" → znajdzie 401-2-3, 401-3-15, etc.
- Po nazwie: "energia" → znajdzie wszystkie konta z "energia" w nazwie

**Krok 3:** Wybierz konto z listy wyników

**Krok 4:** Wybierz okres:
| Opcja | Opis |
|-------|------|
| Miesiąc | Konkretny miesiąc (np. grudzień 2025) |
| Zakres | Od-do (np. styczeń - grudzień 2025) |
| Cały rok | Wszystkie miesiące wybranego roku |

> 💡 **Wskazówka**: System pokazuje tylko konta przypisane do Twojej lokalizacji. Konta z ikoną 📊 mają podkonta analityczne.

---

### 3. Obroty miesięczne

Po wybraniu konta zobaczysz **tabelę obrotów miesięcznych**:

| Miesiąc | Obrót Wn | Obrót Ma | Saldo |
|---------|----------|----------|-------|
| Styczeń | 1.500,00 | 200,00 | 1.300,00 Wn |
| Luty | 800,00 | 100,00 | 700,00 Wn |
| **RAZEM** | **12.000,00** | **1.500,00** | **10.500,00 Wn** |

**Pod tabelą** znajduje się **pasek podsumowania** z 4 kolumnami:

| Saldo początkowe | Obrót Wn | Obrót Ma | Saldo końcowe |
|-------------------|----------|----------|----------------|
| 0,00 | 12.000,00 | 1.500,00 | 10.500,00 Wn |

---

### 4. Podsumowanie walutowe

Jeśli na koncie występują operacje w **walutach obcych** (EUR, USD, CAD, NOK, AUD), pod głównym podsumowaniem PLN pojawia się **dodatkowy pasek walutowy**:

| Waluta | Saldo początkowe | Obrót Wn | Obrót Ma | Saldo końcowe |
|--------|-------------------|----------|----------|----------------|
| EUR | — | 500,00 | 200,00 | 300,00 Wn |
| USD | — | 1.000,00 | 0,00 | 1.000,00 Wn |

**Ważne rozróżnienie:**
- **Główne podsumowanie (PLN)**: Wszystkie kwoty przeliczone po kursie wymiany z dnia operacji — to jest oficjalna wartość księgowa
- **Podsumowanie walutowe**: Kwoty w oryginalnej walucie — wartość informacyjna, np. ile EUR faktycznie wpłynęło/wypłynęło

> 💡 **Wskazówka**: Podsumowanie walutowe pojawia się automatycznie — nie trzeba go włączać. Jeśli wszystkie operacje są w PLN, pasek walutowy się nie wyświetla.

---

### 5. Lista transakcji

Kliknij na miesiąc aby zobaczyć **szczegółową listę transakcji**:

| Data | Dokument | Opis | Kwota Wn | Kwota Ma |
|------|----------|------|----------|----------|
| 05.12 | DOK/2024/12/001 | Faktura za prąd | 500,00 | - |
| 12.12 | DOK/2024/12/003 | Korekta | - | 50,00 |

---

### 6. Edycja z poziomu wyszukiwarki

Możesz **przejść do edycji dokumentu** bezpośrednio z listy transakcji:

1. Znajdź transakcję na liście
2. Kliknij numer dokumentu (link)
3. Otworzy się dokument do edycji

> 💡 **Wskazówka**: To najszybszy sposób na znalezienie i poprawienie konkretnej operacji!

---

### 7. Eksport danych

**Eksport obrotów:**
1. Wygeneruj zestawienie obrotów
2. Kliknij **"Eksport"**
3. Wybierz format: Excel / CSV / PDF

---

### Podsumowanie

- ✅ Wyszukuj po numerze lub nazwie konta
- ✅ Analizuj obroty miesięczne i salda
- ✅ Pasek walutowy dla operacji w EUR/USD/CAD/NOK/AUD
- ✅ Przeglądaj szczegółowe transakcje
- ✅ Edytuj dokumenty bezpośrednio z wyszukiwarki
- ✅ Eksportuj dane do dalszej analizy

---
*Ostatnia aktualizacja: Luty 2026*', updated_at = now()
WHERE id = '6535dcef-5c98-4557-8d7d-2d5a69feef1d';

-- FAZA 2.6: UPDATE FAQ
UPDATE admin_notes SET content = '## ❓ FAQ - Najczęściej Zadawane Pytania

### Spis treści
1. Logowanie i dostęp
2. Dokumenty
3. Waluty
4. Raporty
5. Budżet
6. Konta
7. Kalendarz i KPiR
8. Problemy techniczne

---

## 1. Logowanie i dostęp

**P: Zapomniałem hasła. Co robić?**
O: Kliknij "Zapomniałem hasła" na stronie logowania. Link do resetowania zostanie wysłany na Twój email.

**P: Nie otrzymuję kodu 2FA. Co robić?**
O: Sprawdź folder SPAM. Jeśli kod nie dotarł w ciągu 5 minut, kliknij "Wyślij ponownie" lub skontaktuj się z administratorem.

**P: Moje konto zostało zablokowane. Dlaczego?**
O: Po 5 nieudanych próbach logowania konto jest automatycznie blokowane. Skontaktuj się z administratorem w celu odblokowania.

**P: Czy mogę zalogować się z telefonu?**
O: Tak, system jest responsywny i działa na urządzeniach mobilnych.

**P: Jak zmienić hasło?**
O: Ustawienia → Profil → "Zmień hasło"

---

## 2. Dokumenty

**P: Nie mogę zapisać dokumentu. Dlaczego?**
O: Sprawdź czy dokument jest zbilansowany (Suma Wn = Suma Ma) i czy wszystkie pola są wypełnione.

**P: Nie mogę usunąć/edytować dokumentu. Dlaczego?**
O: Najprawdopodobniej istnieje **raport** za ten miesiąc. Raport z **dowolnym** statusem (nawet wersja robocza) blokuje dokumenty. Poproś Administratora o odblokowanie raportu.

**P: Jak usunąć operację z dokumentu?**
O: Zaznacz checkbox przy operacji i kliknij "Usuń zaznaczone" lub użyj ikony kosza.

**P: Czy mogę edytować dokument z poprzedniego miesiąca?**
O: Tak, o ile nie istnieje raport za ten miesiąc. Jeśli raport istnieje — edycja jest zablokowana.

**P: Jak importować wyciąg bankowy?**
O: W oknie dokumentu kliknij "Import MT940", wybierz plik wyciągu, a następnie przypisz konta do zaimportowanych operacji.

**P: Polskie znaki wyświetlają się nieprawidłowo po imporcie CSV.**
O: Zapisz plik CSV w kodowaniu UTF-8 przed importem.

**P: Jak zmienić kolejność operacji?**
O: Przeciągnij operację za ikonę [≡] w nowe miejsce.

**P: Jak rozbić operację na kilka kont?**
O: Kliknij ikonę "Rozdziel" przy operacji, podaj kwotę do wydzielenia.

**P: Dlaczego numer dokumentu jest szary i nie mogę go zmienić?**
O: Numer dokumentu jest **generowany automatycznie** na podstawie skrótu placówki, roku, miesiąca i numeru sekwencyjnego. Jest to pole tylko do odczytu.

---

## 3. Waluty

**P: Jak korzystać z walut obcych? (EUR, USD, CAD, NOK, AUD)**
O: Przy tworzeniu dokumentu zmień walutę z PLN na inną. Wprowadź kurs wymiany ręcznie lub kliknij „Pobierz kurs NBP". Kwoty operacji wprowadzasz w wybranej walucie, a system przelicza je na PLN.

**P: Skąd system bierze kurs wymiany?**
O: Kursy NBP pobierane są z tabeli kursów średnich. Możesz też wpisać kurs ręcznie. Kurs jest zapisywany per dokument i per transakcja.

**P: Dlaczego nie widzę opcji walut obcych?**
O: Waluty obce muszą być włączone dla Twojej lokalizacji. Poproś Administratora o włączenie opcji „Obsługa walut obcych" w ustawieniach placówki.

**P: Jak przełączyć widok między walutą a PLN?**
O: W nagłówku dokumentu walutowego kliknij przycisk 🔄 PLN/waluta. W trybie PLN kwoty pokazują wartości przeliczone, ale pola są tylko do odczytu.

---

## 4. Raporty

**P: Nie mogę utworzyć raportu - system blokuje.**
O: Sprawdź czy nie ma niekompletnych dokumentów w wybranym miesiącu.

**P: Jak cofnąć złożony raport?**
O: Skontaktuj się z Prowincjałem lub Administratorem - tylko oni mogą cofnąć status raportu. Admin może użyć funkcji "Odblokuj raport".

**P: Kiedy jest termin składania raportu?**
O: Standardowo do 5. dnia następnego miesiąca. System przypomni Ci o terminie powiadomieniami.

**P: Jak wyeksportować raport do PDF?**
O: Otwórz raport i kliknij "Eksport PDF". Dostępny jest wariant kompaktowy (1 strona) i pełny (2 strony).

**P: Co oznacza status "Do poprawy"?**
O: Prowincjał zaznaczył, że raport wymaga drobnych korekt. Popraw wskazane elementy i złóż raport ponownie.

---

## 5. Budżet

**P: Jak utworzyć budżet na nowy rok?**
O: Budżet → Nowy budżet → Wybierz rok i metodę prognozowania → Wypełnij pozycje → Złóż do zatwierdzenia.

**P: Jak zaimportować budżet z pliku Excel?**
O: W formularzu nowego budżetu kliknij „Importuj z pliku". Pobierz szablon (5 kolumn: numer konta, nazwa, typ, kwota planowana, wykonanie poprzedniego roku), wypełnij go i wgraj. System pokaże podgląd przed importem.

**P: Co oznaczają kolory "baterii"?**
O: 🟢 Zielony (60-80%) - OK, 🟡 Pomarańczowy (81-99%) - uwaga, 🔴 Czerwony (≥100%) - przekroczenie, ⚪ Szary (<50%) - niedowykorzystanie.

**P: Czy mogę edytować zatwierdzony budżet?**
O: Nie, zatwierdzony budżet jest tylko do odczytu. W wyjątkowych przypadkach skontaktuj się z Administratorem.

---

## 6. Konta

**P: Nie widzę wszystkich kont. Dlaczego?**
O: System pokazuje tylko konta przypisane do Twojej lokalizacji.

**P: Jak stworzyć konto analityczne?**
O: Ustawienia → zakładka „Konta" → przy koncie syntetycznym (np. 401) kliknij „Dodaj podkonto". System automatycznie doda sufiks Twojej lokalizacji (np. 401-2-3).

**P: Jak zmienić nazwę konta analitycznego?**
O: Ustawienia → zakładka „Konta" → znajdź konto → kliknij ikonę edycji → zmień nazwę → zapisz. Możesz edytować tylko konta analityczne swojej lokalizacji.

**P: Co oznacza ikona 📊 przy koncie?**
O: Konto posiada **podkonta analityczne** (np. konto 401 ma podkonta 401-2-3, 401-3-15 itd.). Kliknij aby zobaczyć listę podkont.

**P: Co to jest sufiks konta (np. -2-3)?**
O: To identyfikator lokalizacji. Każda placówka ma własny zestaw kont z odpowiednim sufiksem (np. 2-3 = Dom w Krakowie).

---

## 7. Kalendarz i KPiR

**P: Jak korzystać z kalendarza?**
O: Przejdź do Bazy Wiedzy → zakładka „Kalendarz" lub bezpośrednio do strony Kalendarz. Kliknij na dzień aby zobaczyć wydarzenia, lub kliknij „Nowe wydarzenie" aby dodać wpis.

**P: Co to jest KPiR i jak go użyć?**
O: KPiR (Księga Przychodów i Rozchodów) to uproszczony rejestr operacji finansowych. Przejdź do menu „KPiR", aby tworzyć, importować i przeglądać wpisy. Dostępny jest też eksport do PDF.

**P: Jak zgłosić błąd w systemie?**
O: Kliknij ikonę 🐛 w prawym dolnym rogu ekranu. Wypełnij formularz z opisem błędu — możesz dołączyć zrzut ekranu.

---

## 8. Problemy techniczne

**P: Strona się nie ładuje / jest biała.**
O: Odśwież stronę (F5), wyczyść cache przeglądarki, lub spróbuj w trybie incognito.

**P: System jest wolny. Co robić?**
O: Sprawdź połączenie internetowe. Jeśli problem się powtarza, zgłoś błąd z opisem sytuacji.

**P: Zmiany nie zapisują się.**
O: Upewnij się, że klikasz przycisk "Zapisz". Sprawdź czy nie ma komunikatów o błędach.

**P: Czy moje dane są bezpieczne?**
O: Tak, system używa szyfrowania, weryfikacji dwuetapowej (2FA) i regularnych kopii zapasowych.

---

### Nie znalazłeś odpowiedzi?

Skontaktuj się z Administratorem systemu lub zgłoś problem przez formularz błędów (🐛).

---
*Ostatnia aktualizacja: Luty 2026*', updated_at = now()
WHERE id = '11f68cde-7c3b-43ea-9150-347e1f6916aa';

-- FAZA 2.7: UPDATE Słownik Pojęć
UPDATE admin_notes SET content = '## 📖 Słownik Pojęć Księgowych i Systemowych

### Spis treści
1. Pojęcia księgowe (A-K)
2. Pojęcia księgowe (L-Z)
3. Pojęcia systemowe
4. Skróty i akronimy

---

## 1. Pojęcia księgowe (A-K)

| Termin | Definicja |
|--------|-----------|
| **Aktywa** | Zasoby majątkowe kontrolowane przez jednostkę (budynki, maszyny, gotówka) |
| **Amortyzacja** | Rozłożenie kosztu środka trwałego na okres jego użytkowania |
| **Bilans** | Zestawienie aktywów i pasywów na określony dzień |
| **Debet (Winien, Wn)** | Lewa strona konta księgowego; wzrost aktywów lub kosztów |
| **Dokument księgowy** | Dowód operacji gospodarczej (faktura, rachunek, wyciąg) |
| **Ewidencja** | Systematyczne rejestrowanie operacji gospodarczych |
| **Faktura** | Dokument potwierdzający transakcję kupna-sprzedaży |
| **Kapitał** | Źródła finansowania majątku jednostki |
| **Konto analityczne (podkonto)** | Konto szczegółowe przypisane do konkretnej lokalizacji, np. 401-2-3 (Energia – Dom w Krakowie). Tworzone przez ekonoma dla swojej placówki. |
| **Konto księgowe** | Urządzenie ewidencyjne do rejestrowania operacji |
| **Konto syntetyczne** | Konto ogólne (3-cyfrowe), np. 401 (Energia). Stanowi „rodzica" dla kont analitycznych. |
| **Koszty** | Zmniejszenie korzyści ekonomicznych (zużycie zasobów) |
| **KPiR** | Księga Przychodów i Rozchodów — uproszczony rejestr operacji finansowych, łączący dane z dokumentów z klasyfikacją podatkową |
| **Kredyt (Ma)** | Prawa strona konta księgowego; wzrost pasywów lub przychodów |
| **Kurs wymiany** | Przelicznik waluty obcej na PLN, np. 1 EUR = 4,30 PLN. Zapisywany per transakcja. |

---

## 2. Pojęcia księgowe (L-Z)

| Termin | Definicja |
|--------|-----------|
| **Ma** | Prawa strona konta = kredyt |
| **Nota księgowa** | Dokument korygujący lub uzupełniający |
| **Obrót** | Suma operacji po jednej stronie konta (obrót Wn, obrót Ma) |
| **Pasywa** | Źródła finansowania aktywów (kapitały, zobowiązania) |
| **Plan kont** | Wykaz kont stosowanych w jednostce |
| **Podwójny zapis** | Zasada księgowania każdej operacji na min. 2 kontach |
| **Przychody** | Wpływy zwiększające kapitał (ofiary, dotacje, sprzedaż) |
| **Rozchody** | Wydatki zmniejszające środki pieniężne |
| **Rozrachunek** | Należność lub zobowiązanie wobec kontrahenta |
| **Różnice kursowe** | Różnica wynikająca ze zmiany kursu waluty między dniem operacji a dniem zapłaty/wyceny. Mogą być zrealizowane (przy zapłacie) lub niezrealizowane (przy wycenie bilansowej). |
| **RZiS** | Rachunek Zysków i Strat - zestawienie przychodów i kosztów |
| **Saldo** | Różnica między obrotem Wn a Ma |
| **Saldo początkowe** | Stan konta na początek okresu (miesiąca/roku). Równe saldu końcowemu poprzedniego okresu. |
| **Saldo końcowe** | Stan konta na koniec okresu = saldo początkowe + obroty Wn - obroty Ma |
| **Storno** | Zapis korygujący błędną operację |
| **Winien (Wn)** | Lewa strona konta = debet |
| **Zobowiązanie** | Dług jednostki wobec innych podmiotów |
| **ZOS** | Zestawienie Obrotów i Sald |

---

## 3. Pojęcia systemowe

| Termin | Definicja |
|--------|-----------|
| **2FA** | Weryfikacja dwuetapowa — po podaniu hasła system wysyła kod na email, który należy wpisać. Chroni przed nieautoryzowanym dostępem. |
| **Bateria realizacji** | Wizualizacja procentowego wykorzystania budżetu: 🟢 60-80% OK, 🟡 81-99% uwaga, 🔴 ≥100% przekroczenie |
| **Dashboard** | Panel główny z podsumowaniem: statystyki finansowe, status budżetu, powiadomienia, szybki dostęp |
| **Drag & Drop** | Przeciągnij i upuść - metoda zmiany kolejności operacji |
| **Ekonom** | Rola użytkownika odpowiedzialnego za dokumentację finansową |
| **Eksport** | Zapisanie danych z systemu do pliku (PDF, Excel) |
| **Identyfikator lokalizacji** | Unikalny kod placówki (np. 2-3), używany jako sufiks kont analitycznych. Nadawany przez administratora. |
| **Import** | Wczytanie danych z pliku do systemu (CSV, MT940, Excel) |
| **Lokalizacja** | Placówka/dom zakonny w systemie |
| **MT940** | Format pliku wyciągu bankowego (standard SWIFT) |
| **Prowincjał** | Rola użytkownika zatwierdzającego raporty i budżety |
| **Raport miesięczny** | Sprawozdanie finansowe za dany miesiąc |
| **RLS** | Row Level Security - zabezpieczenie dostępu do danych |
| **Status** | Stan dokumentu/raportu (wersja robocza, złożony, zatwierdzony, do poprawy) |
| **Zaufane urządzenie** | Urządzenie, na którym użytkownik zweryfikował się kodem 2FA — kolejne logowania pomijają 2FA |

---

## 4. Skróty i akronimy

| Skrót | Rozwinięcie |
|-------|-------------|
| **CAD** | Dolar kanadyjski (waluta) |
| **CSV** | Comma-Separated Values (wartości rozdzielone przecinkiem) |
| **EUR** | Euro (waluta) |
| **KPiR** | Księga Przychodów i Rozchodów |
| **NBP** | Narodowy Bank Polski (źródło kursów walut) |
| **NIP** | Numer Identyfikacji Podatkowej |
| **NOK** | Korona norweska (waluta) |
| **PDF** | Portable Document Format |
| **PLN** | Polski złoty (waluta bazowa systemu) |
| **REGON** | Rejestr Gospodarki Narodowej |
| **RZiS** | Rachunek Zysków i Strat |
| **USD** | Dolar amerykański (waluta) |
| **AUD** | Dolar australijski (waluta) |
| **UTF-8** | Unicode Transformation Format (kodowanie znaków) |
| **Wn** | Winien (strona debetowa) |
| **Ma** | (strona kredytowa) |
| **ZOS** | Zestawienie Obrotów i Sald |

---

### Nie znalazłeś terminu?

Jeśli brakuje jakiegoś pojęcia, zgłoś to administratorowi — słownik będzie aktualizowany.

---
*Ostatnia aktualizacja: Luty 2026*', updated_at = now()
WHERE id = 'bb071398-f20c-45f5-a120-aa45c6f5e1c4';

-- FAZA 2.8: UPDATE Role i Uprawnienia
UPDATE admin_notes SET content = '## 👥 Role i Uprawnienia w Systemie OMI

### Spis treści
1. Przegląd ról
2. Ekonom - szczegółowe uprawnienia
3. Proboszcz - szczegółowe uprawnienia
4. Prowincjał - szczegółowe uprawnienia
5. Administrator - szczegółowe uprawnienia
6. Wiele lokalizacji
7. Współpraca między rolami

---

### 1. Przegląd ról

System OMI wykorzystuje **4 role użytkowników**, każda z własnymi uprawnieniami:

| Rola | Symbol | Główna odpowiedzialność |
|------|--------|------------------------|
| Ekonom | 💼 | Bieżąca dokumentacja finansowa placówki |
| Proboszcz | ⛪ | Nadzór nad finansami placówki |
| Prowincjał | 🏛️ | Zatwierdzanie raportów i budżetów wszystkich placówek |
| Administrator | ⚙️ | Zarządzanie systemem i użytkownikami |

---

### 2. Ekonom 💼

**Główne zadania:**
- Tworzenie i edycja dokumentów finansowych
- Składanie miesięcznych raportów
- Przygotowywanie budżetu rocznego
- Prowadzenie KPiR

**Szczegółowe uprawnienia:**

| Moduł | Uprawnienia |
|-------|-------------|
| Dokumenty | ✅ Tworzenie, edycja, usuwanie, import (CSV/MT940/Excel) |
| Raporty | ✅ Tworzenie, składanie do zatwierdzenia |
| Raporty | ❌ Nie może zatwierdzać ani odblokowywać |
| Budżet | ✅ Tworzenie, edycja, import z Excel, składanie |
| Budżet | ❌ Nie może zatwierdzać |
| Konta | ✅ Wyszukiwanie, tworzenie kont analitycznych, edycja nazw |
| KPiR | ✅ Pełny dostęp do Księgi Przychodów i Rozchodów |
| Kalendarz | ✅ Tworzenie wydarzeń dla swojej lokalizacji |
| Administracja | ❌ Brak dostępu |

> 💡 **Wskazówka dla Ekonoma**: Regularnie sprawdzaj powiadomienia na Dashboard — system przypomni Ci o terminach składania raportów!

---

### 3. Proboszcz ⛪

**Główne zadania:**
- Nadzór nad finansami placówki
- Podgląd dokumentacji i raportów
- Współpraca z ekonomem

**Szczegółowe uprawnienia:**

| Moduł | Uprawnienia |
|-------|-------------|
| Dokumenty | 👁️ Podgląd dokumentów swojej placówki |
| Raporty | 👁️ Podgląd raportów swojej placówki |
| Budżet | 👁️ Podgląd budżetu swojej placówki |
| Konta | ✅ Wyszukiwanie kont swojej placówki |
| Administracja | ❌ Brak dostępu |

---

### 4. Prowincjał 🏛️

**Główne zadania:**
- Zatwierdzanie raportów i budżetów wszystkich placówek
- Analiza porównawcza placówek
- Kontrola terminowości

**Szczegółowe uprawnienia:**

| Moduł | Uprawnienia |
|-------|-------------|
| Dokumenty | 👁️ Podgląd dokumentów wszystkich placówek |
| Raporty | ✅ Przeglądanie, zatwierdzanie, odrzucanie, oznaczanie „Do poprawy" |
| Budżet | ✅ Przeglądanie, zatwierdzanie, odrzucanie |
| Wizualizacja | ✅ **Pełny dostęp** do porównań między placówkami i trendów wieloletnich |
| Konta | ✅ Wyszukiwanie kont wszystkich placówek |
| Kalendarz | ✅ Tworzenie wydarzeń globalnych i filtrowanie po lokalizacji |
| Administracja | ⚡ Częściowy dostęp (przypomnienia, zgłoszenia) |

---

### 5. Administrator ⚙️

**Główne zadania:**
- Zarządzanie użytkownikami i placówkami
- Konfiguracja systemu
- Obsługa zgłoszeń błędów

**Szczegółowe uprawnienia:**

| Moduł | Uprawnienia |
|-------|-------------|
| Wszystkie moduły | ✅ Pełny dostęp |
| Raporty | ✅ **Odblokuj raport** — cofnięcie statusu raportu, odblokowanie dokumentów |
| Administracja | ✅ Zarządzanie użytkownikami, placówkami, kontami, bezpieczeństwem |
| Baza danych | ✅ Eksport/import kopii zapasowej |

---

### 6. Wiele lokalizacji

Użytkownik (szczególnie ekonom) może być przypisany do **wielu lokalizacji** jednocześnie:

- W takim przypadku widzi dokumenty, raporty i budżety **wszystkich** przypisanych placówek
- Przy tworzeniu dokumentu/raportu wybiera lokalizację z listy
- Konta analityczne są wyświetlane dla wybranej lokalizacji

**Jak przypisać wiele lokalizacji:**
Administrator w panelu Administracja → Użytkownicy → edycja użytkownika → dodanie lokalizacji dodatkowych.

> 💡 **Wskazówka**: Ekonom obsługujący kilka placówek widzi przełącznik lokalizacji przy tworzeniu nowych dokumentów.

---

### 7. Współpraca między rolami

**Typowy workflow miesięczny:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   EKONOM    │ --> │  PROBOSZCZ  │ --> │ PROWINCJAŁ  │
│ Tworzy dok. │     │  Nadzoruje  │     │ Zatwierdza  │
│ Składa rap. │     │  Konsultuje │     │  raporty    │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

### Podsumowanie

| Rola | Dokumenty | Raporty | Budżet | Wizualizacja | Administracja |
|------|-----------|---------|--------|--------------|---------------|
| Ekonom | ✅ Pełny | ✅ Tworzenie | ✅ Tworzenie | ❌ | ❌ |
| Proboszcz | 👁️ Podgląd | 👁️ Podgląd | 👁️ Podgląd | ❌ | ❌ |
| Prowincjał | 👁️ Podgląd | ✅ Zatwierdzanie | ✅ Zatwierdzanie | ✅ Pełny | ⚡ Częściowy |
| Admin | ✅ Pełny | ✅ Pełny + Odblokuj | ✅ Pełny | ✅ Pełny | ✅ Pełny |

---
*Ostatnia aktualizacja: Luty 2026*', updated_at = now()
WHERE id = '8f037534-f789-4b5d-8561-a8b919ec31e0';

-- FAZA 3.1: INSERT Obsługa Walut Obcych
INSERT INTO admin_notes (title, category, content, pinned, visible_to) VALUES (
'💱 Obsługa Walut Obcych - Przewodnik',
'dokumenty',
'## 💱 Obsługa Walut Obcych - Przewodnik

### Spis treści
1. Obsługiwane waluty
2. Włączanie walut dla lokalizacji
3. Tworzenie dokumentu walutowego
4. Kurs wymiany
5. Przełączanie widoku walutowego
6. Wpływ na raporty
7. Podsumowanie walutowe w wyszukiwaniu kont
8. Najczęstsze pytania

---

### 1. Obsługiwane waluty

System obsługuje **6 walut**:

| Waluta | Kod | Symbol | Typowe zastosowanie |
|--------|-----|--------|---------------------|
| Polski złoty | PLN | zł | Waluta bazowa systemu |
| Euro | EUR | € | Domy europejskie, zakupy zagraniczne |
| Dolar amerykański | USD | $ | Domy w USA, płatności międzynarodowe |
| Dolar kanadyjski | CAD | C$ | Domy w Kanadzie |
| Korona norweska | NOK | kr | Domy w Norwegii |
| Dolar australijski | AUD | A$ | Domy w Australii |

> 💡 **PLN** jest zawsze walutą bazową — wszystkie raporty i podsumowania są przeliczane na PLN.

---

### 2. Włączanie walut dla lokalizacji

Waluty obce **nie są domyślnie włączone**. Administrator musi je aktywować:

1. Administracja → Placówki → wybierz lokalizację
2. Kliknij „Ustawienia" przy lokalizacji
3. Zaznacz opcję **„Obsługa walut obcych"**
4. Zapisz

Po włączeniu — ekonom tej placówki zobaczy pole wyboru waluty przy tworzeniu dokumentu.

---

### 3. Tworzenie dokumentu walutowego

**Krok 1:** Utwórz nowy dokument

**Krok 2:** Zmień walutę z PLN na wybraną (np. EUR)

**Krok 3:** Wprowadź kurs wymiany:
- **Ręcznie** — wpisz kurs (np. 4,30)
- **Automatycznie** — kliknij „Pobierz kurs NBP" → system pobierze średni kurs z dnia dokumentu

**Krok 4:** Dodaj operacje — kwoty wprowadzasz w **wybranej walucie** (np. 100 EUR)

**Krok 5:** System automatycznie przeliczy kwoty na PLN po podanym kursie

⚠️ **Uwaga**: Kurs wymiany jest **wspólny dla całego dokumentu**, ale zapisywany również **per transakcja** (na wypadek przyszłych zmian).

---

### 4. Kurs wymiany

**Skąd brać kurs?**
- **Kurs NBP** — tabela kursów średnich Narodowego Banku Polskiego. System pobiera je automatycznie.
- **Kurs ręczny** — możesz wpisać dowolny kurs (np. kurs z faktury).

**Gdzie sprawdzić historyczne kursy?**
- Administracja → Zarządzanie kursami walut
- Tabela pokazuje historię kursów z datami i źródłem

**Format kursu:**
- Wpisuj z przecinkiem lub kropką: `4,30` lub `4.30`
- System akceptuje oba formaty

---

### 5. Przełączanie widoku walutowego

W dokumencie walutowym dostępny jest przycisk **🔄 PLN / waluta**:

| Widok | Co pokazuje | Edycja |
|-------|-------------|--------|
| **Waluta oryginalna** | Kwoty w EUR/USD/etc. | ✅ Edytowalne |
| **PLN** | Kwoty przeliczone po kursie | 🔒 Tylko do odczytu |

> 💡 **Wskazówka**: Przełączaj widok, by sprawdzić jak kwoty wyglądają w PLN — przydatne przy weryfikacji przeliczenia.

---

### 6. Wpływ na raporty

**Wszystkie raporty finansowe są w PLN.** Kwoty z dokumentów walutowych są automatycznie przeliczane po kursie z dnia dokumentu.

| Element | Waluta w raporcie |
|---------|-------------------|
| Przychody (7xx) | PLN (przeliczone) |
| Rozchody (4xx) | PLN (przeliczone) |
| Bilans | PLN |
| Podsumowanie ZOS | PLN |

---

### 7. Podsumowanie walutowe w wyszukiwaniu kont

Moduł **Wyszukiwanie Kont** wyświetla dodatkowy pasek walutowy, gdy na koncie są operacje w walutach obcych:

**Główne podsumowanie (PLN):**
| Saldo początkowe | Obrót Wn | Obrót Ma | Saldo końcowe |

**Dodatkowy pasek walutowy (np. EUR):**
| Saldo początkowe | Obrót Wn | Obrót Ma | Saldo końcowe |

Pasek walutowy pojawia się **automatycznie** — nie trzeba go włączać. Pokazuje sumy w oryginalnej walucie.

---

### 8. Najczęstsze pytania

**P: Czy mogę mieć operacje w różnych walutach w jednym dokumencie?**
O: Nie — jeden dokument = jedna waluta. Dla różnych walut utwórz osobne dokumenty.

**P: Co jeśli kurs NBP nie jest dostępny na dany dzień?**
O: System pobiera ostatni dostępny kurs. Możesz też wpisać kurs ręcznie.

**P: Czy mogę zmienić kurs po zapisaniu dokumentu?**
O: Tak, edytuj dokument i zmień kurs. Kwoty PLN zostaną przeliczone ponownie.

---

### Podsumowanie

- ✅ 6 walut: PLN, EUR, USD, CAD, NOK, AUD
- ✅ Kurs ręczny lub automatyczny (NBP)
- ✅ Przełączanie widoku waluta/PLN
- ✅ Raporty zawsze w PLN
- ✅ Pasek walutowy w wyszukiwaniu kont
- ✅ Waluty wymagają włączenia per lokalizacja

---
*Ostatnia aktualizacja: Luty 2026*',
false,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin']
);

-- FAZA 3.2: INSERT KPiR
INSERT INTO admin_notes (title, category, content, pinned, visible_to) VALUES (
'📒 KPiR - Księga Przychodów i Rozchodów',
'dokumenty',
'## 📒 KPiR - Księga Przychodów i Rozchodów

### Spis treści
1. Co to jest KPiR
2. Dostęp i uprawnienia
3. Tworzenie nowej operacji
4. Import operacji z dokumentów
5. Edycja i usuwanie wpisów
6. Podsumowanie miesięczne
7. Powiązanie z dokumentami

---

### 1. Co to jest KPiR

**Księga Przychodów i Rozchodów (KPiR)** to uproszczony rejestr operacji finansowych, stanowiący alternatywny widok na dane wprowadzone w dokumentach.

**KPiR zawiera:**
- Numer porządkowy (Lp.)
- Datę operacji
- Numer dowodu (dokumentu)
- Opis zdarzenia
- Kwotę przychodu lub rozchodu
- Kategorię podatkową

> 💡 **Wskazówka**: KPiR czerpie dane z dokumentów — nie trzeba wprowadzać operacji dwa razy.

---

### 2. Dostęp i uprawnienia

| Rola | Dostęp do KPiR |
|------|-----------------|
| Ekonom | ✅ Pełny dostęp (tworzenie, edycja, import) |
| Proboszcz | 👁️ Podgląd |
| Prowincjał | 👁️ Podgląd wszystkich lokalizacji |
| Admin | ✅ Pełny dostęp |

---

### 3. Tworzenie nowej operacji

**Krok 1:** Przejdź do menu **KPiR**

**Krok 2:** Kliknij **"Nowa operacja"**

**Krok 3:** Wypełnij formularz:
| Pole | Opis |
|------|------|
| Data | Data operacji |
| Numer dowodu | Numer dokumentu źródłowego |
| Opis | Krótki opis operacji |
| Przychód / Rozchód | Kwota i klasyfikacja |

**Krok 4:** Zapisz operację

---

### 4. Import operacji z dokumentów

Zamiast ręcznego tworzenia, możesz zaimportować operacje bezpośrednio z dokumentów:

1. Kliknij **"Import z dokumentów"**
2. Wybierz miesiąc i rok
3. System pokaże listę operacji z dokumentów
4. Potwierdź import

> 💡 **Wskazówka**: Import automatycznie przypisuje numery dowodów i opisy z dokumentów źródłowych.

---

### 5. Edycja i usuwanie wpisów

- **Edycja**: Kliknij na wpis → zmień dane → zapisz
- **Usuwanie**: Zaznacz wpis → kliknij „Usuń"

⚠️ **Uwaga**: Usunięcie wpisu z KPiR **nie** usuwa dokumentu źródłowego — to tylko widok ewidencyjny.

---

### 6. Podsumowanie miesięczne

Na dole tabeli KPiR wyświetla się **podsumowanie za wybrany miesiąc**:

| Element | Wartość |
|---------|---------|
| Suma przychodów | np. 15.000,00 PLN |
| Suma rozchodów | np. 8.500,00 PLN |
| Bilans | np. 6.500,00 PLN |

---

### 7. Powiązanie z dokumentami

Każdy wpis KPiR może być powiązany z dokumentem:

- Kliknij numer dowodu → system otworzy dokument źródłowy
- Pozwala szybko przejść do szczegółów operacji
- Ułatwia weryfikację i kontrolę

---

### Podsumowanie

- ✅ KPiR = uproszczony widok na operacje finansowe
- ✅ Import z dokumentów — nie trzeba wpisywać dwa razy
- ✅ Podsumowania miesięczne automatyczne
- ✅ Powiązanie z dokumentami źródłowymi
- ✅ Dostępny głównie dla ekonomów

---
*Ostatnia aktualizacja: Luty 2026*',
false,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin']
);

-- FAZA 3.3: INSERT Kalendarz
INSERT INTO admin_notes (title, category, content, pinned, visible_to) VALUES (
'📅 Kalendarz - Planowanie Wydarzeń',
'wprowadzenie',
'## 📅 Kalendarz - Planowanie Wydarzeń

### Spis treści
1. Wprowadzenie
2. Widok kalendarza
3. Typy wydarzeń
4. Tworzenie wydarzenia
5. Wydarzenia globalne vs lokalne
6. Nadchodzące wydarzenia
7. Terminy raportów i budżetów

---

### 1. Wprowadzenie

**Kalendarz** to moduł planowania i śledzenia ważnych terminów. Łączy w jednym widoku:
- Ręcznie tworzone wydarzenia
- Automatyczne terminy raportów
- Terminy budżetów
- Przypomnienia systemowe (5. dzień miesiąca — termin raportu)

---

### 2. Widok kalendarza

Kalendarz wyświetla **widok miesięczny** z nawigacją:
- **◄ / ►** — przejście do poprzedniego/następnego miesiąca
- **Dziś** — powrót do bieżącego miesiąca
- Dni z wydarzeniami oznaczone kolorowymi kropkami
- Kliknij na dzień aby zobaczyć listę wydarzeń

---

### 3. Typy wydarzeń

| Typ | Ikona | Opis |
|-----|-------|------|
| Termin raportu | 📊 | Deadline składania raportu |
| Spotkanie | 👥 | Spotkania, narady |
| Wizytacja | 🏛️ | Wizytacja kanoniczna |
| Inne | 📌 | Inne wydarzenia |

**Priorytety:**
| Priorytet | Kolor | Kiedy używać |
|-----------|-------|-------------|
| Wysoki | 🔴 Czerwony | Pilne terminy, wizytacje |
| Średni | 🟡 Żółty | Standardowe spotkania |
| Niski | 🟢 Zielony | Informacyjne |

---

### 4. Tworzenie wydarzenia

**Krok 1:** Kliknij na dzień w kalendarzu lub przycisk **"Nowe wydarzenie"**

**Krok 2:** Wypełnij formularz:
| Pole | Opis | Wymagane |
|------|------|----------|
| Tytuł | Nazwa wydarzenia | ✅ Tak |
| Data | Dzień wydarzenia | ✅ Tak |
| Typ | Termin raportu / Spotkanie / Wizytacja / Inne | ✅ Tak |
| Priorytet | Wysoki / Średni / Niski | ✅ Tak |
| Opis | Dodatkowe informacje | Opcjonalne |
| Globalne | Widoczne dla wszystkich lokalizacji | Opcjonalne |

**Krok 3:** Zapisz wydarzenie

---

### 5. Wydarzenia globalne vs lokalne

| Typ | Kto widzi | Kto tworzy |
|-----|-----------|------------|
| **Globalne** | Wszyscy użytkownicy | Admin, Prowincjał |
| **Lokalne** | Użytkownicy danej lokalizacji | Ekonom (swojej lokalizacji), Admin |

**Przykłady:**
- 🌍 **Globalne**: „Wizytacja Prowincjała — wszystkie domy", „Deadline raportów rocznych"
- 📍 **Lokalne**: „Spotkanie z księgowym", „Przegląd instalacji"

---

### 6. Nadchodzące wydarzenia

Widget **„Nadchodzące wydarzenia"** wyświetla listę najbliższych terminów:
- Sortowane chronologicznie
- Kolorowe oznaczenia priorytetu
- Szybki podgląd bez otwierania kalendarza

> 💡 **Wskazówka**: Widget nadchodzących wydarzeń jest dostępny zarówno na stronie Kalendarza jak i w Bazie Wiedzy.

---

### 7. Terminy raportów i budżetów

Kalendarz **automatycznie** wyświetla:

- **Raporty**: Terminy złożenia/zatwierdzenia raportów (pobierane z tabeli raportów)
- **Budżety**: Terminy złożenia/zatwierdzenia budżetów
- **Przypomnienia**: 5. dzień każdego miesiąca — automatyczne przypomnienie o terminie raportu

> 💡 **Wskazówka**: Nie musisz ręcznie dodawać terminów raportów — system robi to automatycznie!

---

### Podsumowanie

- ✅ Widok miesięczny z kolorowymi oznaczeniami
- ✅ 4 typy wydarzeń + 3 poziomy priorytetów
- ✅ Wydarzenia globalne (wszyscy) i lokalne (placówka)
- ✅ Automatyczne terminy raportów i budżetów
- ✅ Widget nadchodzących wydarzeń

---
*Ostatnia aktualizacja: Luty 2026*',
false,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin']
);

-- FAZA 3.4: INSERT Wizualizacja Danych (rozszerzenie istniejącego krótkiego artykułu)
UPDATE admin_notes SET content = '## 📊 Wizualizacja Danych - Wykresy i Porównania

### Spis treści
1. Wprowadzenie
2. Porównanie między placówkami
3. Wykresy trendów miesięcznych
4. Tabela zbiorcza
5. Trendy wieloletnie
6. Filtrowanie i nawigacja
7. Eksport danych

---

### 1. Wprowadzenie

Moduł **Wizualizacja Danych** pozwala na graficzną analizę finansów placówek. Dostępny jest dla **Prowincjała** i **Administratora** — umożliwia porównanie wyników między placówkami i analizę trendów.

**Dostęp:** Menu → **Wizualizacja danych** (lub Dashboard → kafelek „Wizualizacja")

---

### 2. Porównanie między placówkami

**Wykres słupkowy** porównujący przychody i rozchody każdej placówki:

- Niebieskie słupki = Przychody
- Czerwone słupki = Rozchody
- Oś X = Placówki
- Oś Y = Kwoty w PLN

**Co pokazuje:**
- Które placówki mają najwyższe/najniższe przychody
- Bilans (przychody vs rozchody) każdej placówki
- Ogólny obraz finansów prowincji

---

### 3. Wykresy trendów miesięcznych

**Wykres liniowy** pokazujący zmiany przychodów i rozchodów w ciągu roku:

- Linia ciągła = Przychody
- Linia przerywana = Rozchody
- Oś X = Miesiące (sty-gru)
- Oś Y = Kwoty w PLN

**Zastosowanie:**
- Identyfikacja sezonowości (np. wyższe ofiary w grudniu)
- Wykrycie anomalii (nagły wzrost kosztów)
- Planowanie budżetu na podstawie trendów

---

### 4. Tabela zbiorcza

Tabela ze wskaźnikami finansowymi dla każdej placówki:

| Placówka | Przychody | Rozchody | Bilans | Trend |
|----------|-----------|----------|--------|-------|
| Dom A | 120.000 | 95.000 | +25.000 | ↑ |
| Dom B | 80.000 | 85.000 | -5.000 | ↓ |

**Wskaźniki:**
- **Bilans** = Przychody - Rozchody
- **Trend** = Porównanie z poprzednim rokiem (↑ wzrost, ↓ spadek)

---

### 5. Trendy wieloletnie

Moduł **Trendy wieloletnie** pozwala analizować zmiany rok do roku:

- Wybierz zakres lat (np. 2022-2026)
- Wykresy pokazują jak zmieniały się przychody/rozchody
- Tabela z danymi rok po roku

**Zastosowanie:**
- Czy placówka się „poprawia" finansowo?
- Jak rosną koszty energii rok do roku?
- Planowanie strategiczne na kolejne lata

---

### 6. Filtrowanie i nawigacja

| Filtr | Opcje |
|-------|-------|
| Rok | Wybór roku sprawozdawczego |
| Lokalizacja | Konkretna placówka lub wszystkie |
| Zakres lat | Od-do (dla trendów wieloletnich) |

> 💡 **Wskazówka**: Prowincjał widzi wszystkie placówki jednocześnie — idealny widok do porównań.

---

### 7. Eksport danych

Dane z wizualizacji można wyeksportować:
- **Tabele** → Eksport do Excel
- **Wykresy** → Widoczne w eksporcie PDF

---

### Podsumowanie

- ✅ Porównanie przychodów/rozchodów między placówkami
- ✅ Wykresy trendów miesięcznych
- ✅ Tabela zbiorcza ze wskaźnikami
- ✅ Trendy wieloletnie (analiza rok do roku)
- ✅ Filtrowanie po roku i lokalizacji
- ✅ Dostępne dla Prowincjała i Administratora

---
*Ostatnia aktualizacja: Luty 2026*', updated_at = now()
WHERE id = 'd82c17d4-d7ab-4963-9cda-1caf5367c185';

-- FAZA 3.5: INSERT Ustawienia Użytkownika
INSERT INTO admin_notes (title, category, content, pinned, visible_to) VALUES (
'⚙️ Ustawienia Użytkownika - Przewodnik',
'wprowadzenie',
'## ⚙️ Ustawienia Użytkownika - Przewodnik

### Spis treści
1. Dostęp do ustawień
2. Zakładka „Profil"
3. Zakładka „Wygląd"
4. Zakładka „Bezpieczeństwo"
5. Zakładka „Konta"

---

### 1. Dostęp do ustawień

Przejdź do **Ustawienia** (ikona ⚙️ w menu bocznym lub w nagłówku).

Strona ustawień zawiera **4 zakładki**:
- Profil
- Wygląd
- Bezpieczeństwo (Zaufane urządzenia)
- Konta

---

### 2. Zakładka „Profil"

Wyświetla informacje o Twoim koncie:

| Pole | Opis |
|------|------|
| Imię i nazwisko | Twoje dane |
| Email | Adres email konta |
| Rola | Twoja rola w systemie (ekonom/proboszcz/prowincjal/admin) |
| Przypisane lokalizacje | Lista placówek, do których masz dostęp |

> 💡 **Wskazówka**: Jeśli Twoje dane są niepoprawne, skontaktuj się z Administratorem — tylko on może zmienić rolę i przypisanie lokalizacji.

---

### 3. Zakładka „Wygląd"

**Tryb Windows 98** 🖥️

Dla fanów retro — możesz włączyć **tryb Windows 98**, który zmienia wygląd całego systemu na styl klasycznego Windows:
- Szare tło i ramki 3D
- Klasyczne przyciski i paski tytułowe
- Retro czcionki

**Jak włączyć:**
1. Ustawienia → Wygląd
2. Przełącz „Tryb Windows 98" na ✅
3. Strona odświeży się automatycznie

> 💡 **Wskazówka**: To wyłącznie zmiana wizualna — wszystkie funkcje działają identycznie.

---

### 4. Zakładka „Bezpieczeństwo"

**Zaufane urządzenia:**

Gdy logujesz się z nowego urządzenia, system wymaga weryfikacji kodem 2FA. Po pomyślnej weryfikacji urządzenie zostaje zapisane jako **zaufane**.

**Lista zaufanych urządzeń pokazuje:**
| Pole | Opis |
|------|------|
| Nazwa urządzenia | Rozpoznana na podstawie przeglądarki i systemu |
| Ostatnie użycie | Data ostatniego logowania |
| Adres IP | IP z ostatniego logowania |

**Usuwanie urządzenia:**
- Kliknij ikonę kosza przy urządzeniu
- Po usunięciu — następne logowanie z tego urządzenia będzie wymagało kodu 2FA

> ⚠️ **Wskazówka bezpieczeństwa**: Regularnie przeglądaj listę zaufanych urządzeń. Jeśli widzisz urządzenie, którego nie rozpoznajesz — usuń je natychmiast i zmień hasło!

---

### 5. Zakładka „Konta"

Przeglądaj konta księgowe przypisane do Twoich lokalizacji:

**Funkcje:**
- 🔍 **Wyszukiwanie** po numerze lub nazwie konta
- 📋 Lista wszystkich kont z podziałem na typy
- 📊 Ikona przy kontach posiadających podkonta analityczne

**Konta syntetyczne vs analityczne:**
- **Syntetyczne** (np. 401) — konta ogólne, widoczne dla wszystkich
- **Analityczne** (np. 401-2-3) — konta szczegółowe, przypisane do konkretnej lokalizacji

> 💡 **Wskazówka**: Z tej zakładki możesz szybko sprawdzić, jakie konta są dostępne dla Twojej placówki.

---

### Podsumowanie

- ✅ Profil: podgląd danych i przypisanych lokalizacji
- ✅ Wygląd: tryb Windows 98 (retro style)
- ✅ Bezpieczeństwo: zarządzanie zaufanymi urządzeniami
- ✅ Konta: przegląd kont księgowych lokalizacji

---
*Ostatnia aktualizacja: Luty 2026*',
false,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin']
);

-- Aktualizacja daty w pozostałych artykułach
UPDATE admin_notes SET 
  content = regexp_replace(content, '\\*Ostatnia aktualizacja: \\w+ \\d{4}\\*', '*Ostatnia aktualizacja: Luty 2026*'),
  updated_at = now()
WHERE id NOT IN (
  'ec15da5b-93da-482d-a600-0bc25e8a215f',
  'bbd23048-bc7f-4dbf-9744-06e68f0289d2',
  'a03c3df0-400f-4896-a4c0-1f7788ee1a4d',
  '5fd2e6f7-c1d5-423b-bed1-40ebbbf73e53',
  '6535dcef-5c98-4557-8d7d-2d5a69feef1d',
  '11f68cde-7c3b-43ea-9150-347e1f6916aa',
  'bb071398-f20c-45f5-a120-aa45c6f5e1c4',
  '8f037534-f789-4b5d-8561-a8b919ec31e0',
  'd82c17d4-d7ab-4963-9cda-1caf5367c185',
  '013e5822-e7fd-4b61-a6a2-bddf8c57723e'
)
AND content LIKE '%Ostatnia aktualizacja%';
