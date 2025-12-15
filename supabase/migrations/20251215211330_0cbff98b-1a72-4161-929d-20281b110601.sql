-- Add category column to admin_notes
ALTER TABLE public.admin_notes ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'inne';

-- Delete old demo notes
DELETE FROM public.admin_notes WHERE created_by = 'fbdffef6-646d-4237-aa54-62ae80792ba4';

-- Insert 20 comprehensive knowledge base articles

-- ARTICLE 1: Welcome to OMI System
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'🏠 Witaj w Systemie OMI - Kompletne Wprowadzenie',
'## 🏠 Witaj w Systemie Finansowym OMI

### Spis treści
1. O systemie
2. Pierwsze logowanie
3. Weryfikacja dwuetapowa (2FA)
4. Nawigacja po systemie
5. Personalizacja wyglądu

---

### 1. O systemie

**System Finansowy OMI** to kompleksowe narzędzie do zarządzania finansami placówek zakonnych Misjonarzy Oblatów Maryi Niepokalanej. System umożliwia:

- 📄 **Dokumentowanie operacji finansowych** - prowadzenie bieżącej dokumentacji księgowej
- 📊 **Tworzenie raportów miesięcznych** - automatyczne generowanie sprawozdań finansowych
- 💰 **Planowanie budżetu** - roczne planowanie przychodów i rozchodów
- 🔍 **Analizę kont księgowych** - szczegółowy wgląd w obroty i transakcje
- 📈 **Wizualizację danych** - wykresy i porównania między placówkami

> 💡 **Wskazówka**: System jest dostępny przez przeglądarkę internetową - nie wymaga instalacji żadnego oprogramowania.

---

### 2. Pierwsze logowanie

**Krok 1:** Otwórz przeglądarkę i przejdź pod adres systemu

**Krok 2:** Wprowadź dane logowania:
| Pole | Opis |
|------|------|
| Email | Twój służbowy adres email |
| Hasło | Hasło otrzymane od administratora |

**Krok 3:** Kliknij przycisk **"Zaloguj się"**

⚠️ **Uwaga**: Po 5 nieudanych próbach logowania konto zostanie tymczasowo zablokowane. Skontaktuj się z administratorem w celu odblokowania.

---

### 3. Weryfikacja dwuetapowa (2FA)

Dla zwiększenia bezpieczeństwa system wymaga weryfikacji dwuetapowej przy logowaniu z nowego urządzenia.

**Jak to działa:**
1. Po wprowadzeniu prawidłowych danych logowania, na Twój email zostanie wysłany **6-cyfrowy kod weryfikacyjny**
2. Wprowadź kod w ciągu **10 minut**
3. Opcjonalnie zaznacz **"Zapamiętaj to urządzenie"** - wtedy kod nie będzie wymagany przy kolejnych logowaniach z tego urządzenia

> 💡 **Wskazówka**: Sprawdź folder SPAM jeśli nie widzisz maila z kodem weryfikacyjnym.

---

### 4. Nawigacja po systemie

Po zalogowaniu zobaczysz **Dashboard** - główny panel systemu. Menu nawigacyjne znajduje się po lewej stronie:

| Ikona | Moduł | Opis |
|-------|-------|------|
| 🏠 | Dashboard | Panel główny z podsumowaniem |
| 📄 | Dokumenty | Tworzenie i edycja dokumentów finansowych |
| 📊 | Raporty | Miesięczne sprawozdania finansowe |
| 💰 | Budżet | Planowanie i kontrola budżetu |
| 🔍 | Wyszukiwanie kont | Analiza obrotów i transakcji |
| 📚 | Baza wiedzy | Instrukcje i dokumentacja (tu jesteś!) |
| ⚙️ | Ustawienia | Profil użytkownika i preferencje |

---

### 5. Personalizacja wyglądu

System oferuje specjalny tryb wizualny **Windows 98** dla miłośników klasycznego interfejsu!

**Jak włączyć:**
1. Przejdź do **Ustawienia**
2. Znajdź opcję **"Tryb Windows 98"**
3. Włącz przełącznik

> 💡 **Wskazówka**: Tryb Windows 98 to nie tylko nostalgia - niektórzy użytkownicy uważają go za bardziej czytelny!

---

### Podsumowanie

- ✅ Zaloguj się używając służbowego emaila
- ✅ Wprowadź kod 2FA z emaila
- ✅ Zapoznaj się z menu nawigacyjnym
- ✅ Dostosuj wygląd do swoich preferencji

*W razie problemów skontaktuj się z administratorem systemu.*

---
*Ostatnia aktualizacja: Grudzień 2024*',
'wprowadzenie',
true,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 2: Roles and Permissions
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'👥 Role i Uprawnienia - Kompletny Przewodnik',
'## 👥 Role i Uprawnienia w Systemie OMI

### Spis treści
1. Przegląd ról
2. Ekonom - szczegółowe uprawnienia
3. Proboszcz - szczegółowe uprawnienia
4. Prowincjał - szczegółowe uprawnienia
5. Administrator - szczegółowe uprawnienia
6. Współpraca między rolami

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

**Szczegółowe uprawnienia:**

| Moduł | Uprawnienia |
|-------|-------------|
| Dokumenty | ✅ Tworzenie, edycja, usuwanie własnych dokumentów |
| Raporty | ✅ Tworzenie, składanie do zatwierdzenia |
| Raporty | ❌ Nie może zatwierdzać |
| Budżet | ✅ Tworzenie, edycja, składanie do zatwierdzenia |
| Budżet | ❌ Nie może zatwierdzać |
| Konta | ✅ Wyszukiwanie kont swojej placówki |
| Administracja | ❌ Brak dostępu |

> 💡 **Wskazówka dla Ekonoma**: Regularnie sprawdzaj powiadomienia na Dashboard - system przypomni Ci o terminach składania raportów!

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

⚠️ **Uwaga**: Proboszcz nie tworzy dokumentów bezpośrednio - to zadanie ekonoma. Proboszcz nadzoruje i konsultuje.

---

### 4. Prowincjał 🏛️

**Główne zadania:**
- Zatwierdzanie raportów wszystkich placówek
- Zatwierdzanie budżetów
- Analiza porównawcza placówek
- Kontrola terminowości

**Szczegółowe uprawnienia:**

| Moduł | Uprawnienia |
|-------|-------------|
| Dokumenty | 👁️ Podgląd dokumentów wszystkich placówek |
| Raporty | ✅ Przeglądanie, zatwierdzanie, odrzucanie |
| Budżet | ✅ Przeglądanie, zatwierdzanie, odrzucanie |
| Wizualizacja | ✅ Pełny dostęp do porównań i analiz |
| Konta | ✅ Wyszukiwanie kont wszystkich placówek |
| Administracja | ⚡ Częściowy dostęp (przypomnienia, zgłoszenia) |

> 💡 **Wskazówka dla Prowincjała**: Używaj filtrów w module Budżet i Raporty aby szybko znaleźć dokumenty wymagające Twojej uwagi.

---

### 5. Administrator ⚙️

**Główne zadania:**
- Zarządzanie użytkownikami i placówkami
- Konfiguracja systemu
- Obsługa zgłoszeń błędów
- Wsparcie techniczne

**Szczegółowe uprawnienia:**

| Moduł | Uprawnienia |
|-------|-------------|
| Wszystkie moduły | ✅ Pełny dostęp |
| Administracja | ✅ Zarządzanie użytkownikami |
| Administracja | ✅ Zarządzanie placówkami |
| Administracja | ✅ Konfiguracja kont księgowych |
| Administracja | ✅ Obsługa zgłoszeń błędów |
| Administracja | ✅ Wysyłanie przypomnień |

⚠️ **Uwaga dla Administratora**: Zmiany w strukturze kont księgowych mogą wpłynąć na działanie całego systemu. Zawsze konsultuj zmiany!

---

### 6. Współpraca między rolami

**Typowy workflow miesięczny:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   EKONOM    │ --> │  PROBOSZCZ  │ --> │ PROWINCJAŁ  │
│ Tworzy dok. │     │  Nadzoruje  │     │ Zatwierdza  │
│ Składa rap. │     │  Konsultuje │     │  raporty    │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Workflow budżetowy (roczny):**

1. **Ekonom** przygotowuje projekt budżetu
2. **Proboszcz** konsultuje i zgłasza uwagi
3. **Ekonom** wprowadza poprawki i składa do zatwierdzenia
4. **Prowincjał** analizuje i zatwierdza lub odrzuca z komentarzem
5. Po zatwierdzeniu budżet staje się **tylko do odczytu**

---

### Podsumowanie

| Rola | Dokumenty | Raporty | Budżet | Administracja |
|------|-----------|---------|--------|---------------|
| Ekonom | ✅ Pełny | ✅ Tworzenie | ✅ Tworzenie | ❌ |
| Proboszcz | 👁️ Podgląd | 👁️ Podgląd | 👁️ Podgląd | ❌ |
| Prowincjał | 👁️ Podgląd | ✅ Zatwierdzanie | ✅ Zatwierdzanie | ⚡ Częściowy |
| Admin | ✅ Pełny | ✅ Pełny | ✅ Pełny | ✅ Pełny |

---
*Ostatnia aktualizacja: Grudzień 2024*',
'wprowadzenie',
true,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 3: Dashboard
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'🎯 Dashboard - Centrum Dowodzenia',
'## 🎯 Dashboard - Centrum Dowodzenia

### Spis treści
1. Przegląd Dashboard
2. Karty statystyk
3. Powiadomienia
4. Szybki dostęp
5. Personalizacja

---

### 1. Przegląd Dashboard

**Dashboard** to główny panel systemu, który widzisz zaraz po zalogowaniu. Prezentuje najważniejsze informacje w przejrzysty sposób.

> 💡 **Wskazówka**: Kliknij na logo systemu w dowolnym miejscu aby szybko wrócić do Dashboard.

---

### 2. Karty statystyk

Na górze Dashboard znajdują się **karty ze statystykami**:

| Karta | Co pokazuje | Dla kogo |
|-------|-------------|----------|
| 📄 Dokumenty | Liczba dokumentów w bieżącym miesiącu | Ekonom |
| 📊 Raporty | Status raportów (złożone/oczekujące) | Wszyscy |
| 💰 Budżet | Realizacja budżetu rocznego | Wszyscy |
| 🔔 Powiadomienia | Liczba nieprzeczytanych powiadomień | Wszyscy |

**Kliknięcie na kartę** przenosi do odpowiedniego modułu.

---

### 3. Powiadomienia

System automatycznie generuje powiadomienia o:

- ⏰ **Terminach** - przypomnienia o raportach i budżetach
- ✅ **Zatwierdzeniach** - gdy raport/budżet został zatwierdzony
- ❌ **Odrzuceniach** - gdy raport/budżet wymaga poprawek
- ⚠️ **Alertach** - przekroczenia budżetu, problemy z dokumentami

**Priorytety powiadomień:**
| Priorytet | Kolor | Znaczenie |
|-----------|-------|-----------|
| Wysoki | 🔴 Czerwony | Wymaga natychmiastowej akcji |
| Średni | 🟡 Żółty | Ważne, ale nie pilne |
| Niski | 🔵 Niebieski | Informacyjne |

> 💡 **Wskazówka**: Regularnie sprawdzaj powiadomienia - pomagają nie przegapić ważnych terminów!

---

### 4. Szybki dostęp

Na Dashboard znajdują się przyciski **szybkiego dostępu**:

- **Nowy dokument** - szybkie utworzenie dokumentu finansowego
- **Nowy raport** - rozpoczęcie tworzenia raportu miesięcznego
- **Wyszukaj konto** - szybkie przejście do wyszukiwarki kont

---

### 5. Personalizacja

Dashboard automatycznie dostosowuje wyświetlane elementy do Twojej roli:

| Element | Ekonom | Proboszcz | Prowincjał | Admin |
|---------|--------|-----------|------------|-------|
| Moje dokumenty | ✅ | ❌ | ❌ | ✅ |
| Oczekujące raporty | ❌ | ❌ | ✅ | ✅ |
| Status budżetów | ✅ | ✅ | ✅ | ✅ |
| Zgłoszenia błędów | ❌ | ❌ | ⚡ | ✅ |

---

### Podsumowanie

- ✅ Dashboard to Twój punkt startowy
- ✅ Sprawdzaj powiadomienia codziennie
- ✅ Używaj przycisków szybkiego dostępu
- ✅ Kliknij na kartę aby przejść do modułu

---
*Ostatnia aktualizacja: Grudzień 2024*',
'wprowadzenie',
false,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 4: Documents Complete Guide
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'📄 Dokumenty - Kompletny Podręcznik',
'## 📄 Dokumenty Finansowe - Kompletny Podręcznik

### Spis treści
1. Wprowadzenie do dokumentów
2. Tworzenie nowego dokumentu
3. Struktura operacji księgowej
4. Dodawanie operacji
5. Walidacja i bilans
6. Zapisywanie i edycja
7. Dobre praktyki

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
| Numer dokumentu | Auto-generowany | 🔄 Auto | "DOK/2024/12/001" |
| Waluta | Domyślnie PLN | ✅ Tak | PLN |

⚠️ **Uwaga**: Data dokumentu wpływa na to, do którego miesiąca raportowego zostanie przypisany!

---

### 3. Struktura operacji księgowej

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

### 4. Dodawanie operacji

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

### 5. Walidacja i bilans

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

### 6. Zapisywanie i edycja

**Zapisywanie:**
1. Sprawdź czy dokument jest zbilansowany
2. Kliknij przycisk **"Zapisz"**
3. System potwierdzi zapisanie dokumentu

**Edycja istniejącego dokumentu:**
1. Znajdź dokument na liście
2. Kliknij na wiersz dokumentu
3. Wprowadź zmiany
4. Zapisz dokument

⚠️ **Uwaga**: Dokumenty z miesięcy, dla których złożono raport, mogą być zablokowane do edycji!

---

### 7. Dobre praktyki

**DO (Rób tak):**
- ✅ Twórz dokumenty na bieżąco, nie czekaj do końca miesiąca
- ✅ Używaj opisowych nazw operacji
- ✅ Sprawdzaj bilans przed zapisem
- ✅ Grupuj powiązane operacje w jednym dokumencie

**DON''T (Nie rób tak):**
- ❌ Nie zostawiaj niekompletnych dokumentów
- ❌ Nie używaj skrótów w opisach
- ❌ Nie zapisuj niezrównoważonych dokumentów
- ❌ Nie edytuj zamkniętych okresów

---

### Podsumowanie

- ✅ Dokument = nagłówek + operacje księgowe
- ✅ Każda operacja ma stronę Winien i Ma
- ✅ Σ Winien musi = Σ Ma (bilans)
- ✅ Wyszukuj konta po numerze lub nazwie
- ✅ Zapisuj dokumenty regularnie

---
*Ostatnia aktualizacja: Grudzień 2024*',
'dokumenty',
true,
ARRAY['ekonom', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 5: Drag & Drop and Split
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'🔀 Reorganizacja Operacji - Drag & Drop i Rozbijanie',
'## 🔀 Reorganizacja Operacji - Drag & Drop i Rozbijanie

### Spis treści
1. Zmiana kolejności operacji
2. Rozbijanie transakcji
3. Przypadki użycia
4. Rozwiązywanie problemów

---

### 1. Zmiana kolejności operacji (Drag & Drop)

System pozwala na **zmianę kolejności operacji** poprzez przeciąganie.

**Jak to zrobić:**
1. Znajdź ikonę **[≡]** (trzy poziome kreski) po lewej stronie operacji
2. Kliknij i przytrzymaj ikonę
3. Przeciągnij operację w nowe miejsce
4. Puść przycisk myszy

> 💡 **Wskazówka**: Kolejność operacji jest zapisywana automatycznie i zachowywana po ponownym otwarciu dokumentu.

**Zastosowania:**
- Uporządkowanie operacji chronologicznie
- Grupowanie podobnych operacji
- Przygotowanie do wydruku/eksportu

---

### 2. Rozbijanie transakcji

**Rozbijanie** pozwala podzielić jedną operację na kilka mniejszych - np. gdy faktura dotyczy kilku kategorii kosztów.

**Jak rozbić operację:**

**Krok 1:** Kliknij ikonę **rozdzielenia** (⋮ lub przycisk "Rozdziel") przy operacji

**Krok 2:** Pojawi się dialog rozbijania:
- Podaj kwotę do wydzielenia
- System automatycznie obliczy pozostałą kwotę

**Krok 3:** Potwierdź rozbicie

**Krok 4:** Nowe operacje pojawią się **bezpośrednio pod** rozbijaną operacją

**Przykład:**

**Przed rozbiciem:**
| Opis | Kwota Wn | Konto Wn |
|------|----------|----------|
| Faktura mieszana | 1000,00 | 401-2-3 |

**Po rozbiciu na 2 części (600 + 400):**
| Opis | Kwota Wn | Konto Wn |
|------|----------|----------|
| Faktura mieszana | 600,00 | 401-2-3 |
| Faktura mieszana | 400,00 | 402-2-3 |

> 💡 **Wskazówka**: Po rozbiciu możesz edytować opisy i konta każdej części osobno.

---

### 3. Przypadki użycia

**Przypadek 1: Faktura za media (prąd + gaz + woda)**

Otrzymujesz jedną fakturę na 1500 PLN:
- Prąd: 800 PLN → konto 401 (energia)
- Gaz: 500 PLN → konto 402 (gaz)
- Woda: 200 PLN → konto 403 (woda)

**Rozwiązanie:** Utwórz operację 1500 PLN, następnie rozbij ją na 3 części.

---

**Przypadek 2: Wyciąg bankowy z wieloma pozycjami**

Wyciąg zawiera 10 różnych przelewów. Możesz:
1. Utworzyć każdy przelew jako osobną operację
2. LUB: Utworzyć jedną operację i rozbić ją

---

**Przypadek 3: Korekta błędnego księgowania**

Zauważyłeś, że 200 PLN z faktury powinno iść na inne konto:
1. Rozbij operację na dwie części
2. Zmień konto w wydzielonej części
3. Zachowaj oryginalne konto w pozostałej części

---

### 4. Rozwiązywanie problemów

| Problem | Przyczyna | Rozwiązanie |
|---------|-----------|-------------|
| Nie mogę przeciągnąć | Kliknięcie poza ikoną [≡] | Kliknij dokładnie na ikonę |
| Rozbicie nie działa | Kwota przekracza oryginał | Wprowadź mniejszą kwotę |
| Operacje się "gubią" | Błąd zapisu | Odśwież stronę i spróbuj ponownie |

⚠️ **Uwaga**: Rozbite operacje zachowują oryginalne powiązanie - system wie, że pochodzą z jednego źródła.

---

### Podsumowanie

- ✅ Przeciągaj operacje za ikonę [≡]
- ✅ Rozbijaj faktury mieszane na osobne konta
- ✅ Nowe części pojawiają się pod oryginalną operacją
- ✅ Kolejność jest zapisywana automatycznie

---
*Ostatnia aktualizacja: Grudzień 2024*',
'dokumenty',
false,
ARRAY['ekonom', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 6: Import CSV and MT940
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'📥 Import Danych - CSV i MT940',
'## 📥 Import Danych - Przewodnik po CSV i MT940

### Spis treści
1. Wprowadzenie do importu
2. Import plików CSV
3. Import wyciągów MT940
4. Obsługa kodowania znaków
5. Rozwiązywanie problemów

---

### 1. Wprowadzenie do importu

System obsługuje **automatyczny import** danych z plików zewnętrznych, co znacznie przyspiesza wprowadzanie dużej liczby operacji.

**Obsługiwane formaty:**
| Format | Opis | Typowe źródło |
|--------|------|---------------|
| CSV | Wartości rozdzielone przecinkiem/średnikiem | Excel, systemy księgowe |
| MT940 | Standard bankowy SWIFT | Wyciągi bankowe |

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

**MT940** to międzynarodowy standard wyciągów bankowych. Większość banków w Polsce obsługuje eksport w tym formacie.

**Krok 1:** Pobierz wyciąg MT940 z bankowości elektronicznej

**Krok 2:** W oknie dokumentu kliknij **"Import MT940"**

**Krok 3:** Wybierz plik MT940 (.sta, .mt940, .txt)

**Krok 4:** System automatycznie rozpozna:
- Numer rachunku
- Daty operacji
- Kwoty i opisy
- Salda początkowe i końcowe

**Krok 5:** Przypisz konta księgowe do zaimportowanych operacji

⚠️ **Uwaga**: Po imporcie MT940 musisz ręcznie przypisać konta księgowe (system nie wie, które konto odpowiada któremu kontrahentowi).

---

### 4. Obsługa kodowania znaków

System automatycznie wykrywa i konwertuje kodowanie plików:

| Kodowanie | Opis | Obsługa |
|-----------|------|---------|
| UTF-8 | Standard międzynarodowy | ✅ Automatyczna detekcja |
| UTF-8 BOM | UTF-8 z nagłówkiem | ✅ Automatyczna detekcja |
| Windows-1250 | Polski Windows | ✅ Automatyczna konwersja |
| ISO-8859-2 | Standard środkowoeuropejski | ✅ Automatyczna konwersja |

> 💡 **Wskazówka**: Jeśli polskie znaki (ą, ę, ó, ś, etc.) wyświetlają się nieprawidłowo, spróbuj zapisać plik w UTF-8 przed importem.

---

### 5. Rozwiązywanie problemów

| Problem | Przyczyna | Rozwiązanie |
|---------|-----------|-------------|
| Polskie znaki jako "krzaczki" | Złe kodowanie pliku | Zapisz plik jako UTF-8 |
| Puste kolumny | Zły separator | Użyj średnika zamiast przecinka |
| Błędne kwoty | Przecinek w liczbach | Zamień "1,000.00" na "1000.00" |
| Plik nie wczytuje się | Nieobsługiwany format | Sprawdź rozszerzenie pliku |
| Brak niektórych operacji | Błędy w strukturze pliku | Sprawdź czy każdy wiersz jest kompletny |

**Jak sprawdzić kodowanie pliku:**
1. Otwórz plik w Notepad++
2. Menu: Kodowanie → sprawdź aktualnie zaznaczone
3. Jeśli nie UTF-8: Kodowanie → Konwertuj na UTF-8

---

### Przykładowy plik CSV

```csv
Data;Opis;Kwota_Wn;Konto_Wn;Kwota_Ma;Konto_Ma
2024-12-01;Wpłata od parafianina;0;0;500.00;700-2-3
2024-12-02;Opłata za gaz;350.00;402-2-3;0;0
2024-12-03;Zakup materiałów biurowych;120.50;409-2-3;0;0
```

---

### Podsumowanie

- ✅ CSV dla danych z Excela i innych systemów
- ✅ MT940 dla wyciągów bankowych
- ✅ System automatycznie konwertuje kodowanie
- ✅ Po imporcie MT940 przypisz konta ręcznie
- ✅ Używaj UTF-8 dla najlepszej kompatybilności

---
*Ostatnia aktualizacja: Grudzień 2024*',
'dokumenty',
false,
ARRAY['ekonom', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 7: Document Validation
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'✅ Walidacja i Jakość Dokumentów',
'## ✅ Walidacja i Jakość Dokumentów

### Spis treści
1. Zasady walidacji
2. Typowe błędy
3. Blokada raportów
4. Checklist jakości

---

### 1. Zasady walidacji

System waliduje każdy dokument przed zapisem według następujących reguł:

**Reguły obowiązkowe:**
| Reguła | Opis |
|--------|------|
| Bilans | Suma Wn = Suma Ma |
| Kompletność | Każda operacja ma opis, kwotę i konto |
| Unikalność | Numer dokumentu jest unikalny w miesiącu |
| Data | Data mieści się w dozwolonym okresie |

**Wizualizacja bilansu:**
```
Suma Winien:  1.500,00 PLN
Suma Ma:      1.500,00 PLN
─────────────────────────
Różnica:          0,00 PLN  ✅ OK
```

⚠️ **Uwaga**: Dokument z różnicą ≠ 0 nie może być zapisany!

---

### 2. Typowe błędy

| Błąd | Komunikat | Rozwiązanie |
|------|-----------|-------------|
| Brakujące konto | "Wybierz konto dla operacji X" | Kliknij pole konta i wybierz z listy |
| Brakująca kwota | "Wprowadź kwotę dla operacji X" | Wpisz kwotę w polu Wn lub Ma |
| Brak bilansu | "Dokument nie jest zbilansowany" | Sprawdź czy Σ Wn = Σ Ma |
| Pusty opis | "Operacja wymaga opisu" | Dodaj opis operacji |
| Zły format daty | "Nieprawidłowy format daty" | Użyj formatu DD.MM.RRRR |

> 💡 **Wskazówka**: Błędy są podświetlane na czerwono bezpośrednio w tabeli operacji.

---

### 3. Blokada raportów

System **blokuje tworzenie raportu** jeśli istnieją niekompletne dokumenty w danym miesiącu.

**Co to oznacza:**
- Nie możesz złożyć raportu za grudzień jeśli masz niezapisane/niekompletne dokumenty z grudnia
- System wyświetli listę problematycznych dokumentów
- Musisz najpierw poprawić lub usunąć te dokumenty

**Jak sprawdzić problematyczne dokumenty:**
1. Przejdź do modułu Raporty
2. Spróbuj utworzyć nowy raport
3. System wyświetli listę dokumentów wymagających poprawy

---

### 4. Checklist jakości

Przed zapisaniem dokumentu sprawdź:

- [ ] **Nagłówek dokumentu**
  - [ ] Nazwa jest opisowa i jednoznaczna
  - [ ] Data jest prawidłowa
  - [ ] Waluta jest poprawna

- [ ] **Operacje**
  - [ ] Każda operacja ma opis
  - [ ] Kwoty są prawidłowe (bez literówek)
  - [ ] Konta są przypisane do właściwych stron

- [ ] **Bilans**
  - [ ] Suma Wn = Suma Ma
  - [ ] Różnica wynosi 0,00

- [ ] **Kompletność**
  - [ ] Wszystkie operacje z dokumentu źródłowego są wprowadzone
  - [ ] Numery kont odpowiadają charakterowi operacji

---

### Podsumowanie

- ✅ System waliduje bilans automatycznie
- ✅ Dokumenty z błędami nie mogą być zapisane
- ✅ Niekompletne dokumenty blokują tworzenie raportów
- ✅ Używaj checklisty przed zapisem

---
*Ostatnia aktualizacja: Grudzień 2024*',
'dokumenty',
false,
ARRAY['ekonom', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 8: Reports Complete Guide
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'📊 Raporty - Od Tworzenia do Zatwierdzenia',
'## 📊 Raporty Miesięczne - Kompletny Workflow

### Spis treści
1. Co to jest raport miesięczny
2. Tworzenie raportu
3. Składanie do zatwierdzenia
4. Proces zatwierdzania
5. Eksport i drukowanie
6. Statusy raportów

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
| Rok | Rok sprawozdawczy (np. 2024) |
| Lokalizacja | Twoja placówka (auto-wybrana) |

**Krok 3:** Kliknij **"Utwórz raport"**

**Krok 4:** System automatycznie:
- Pobierze wszystkie dokumenty z wybranego miesiąca
- Obliczy obroty na kontach
- Wygeneruje podsumowanie finansowe

⚠️ **Uwaga**: Jeśli w wybranym miesiącu są niekompletne dokumenty, system wyświetli ostrzeżenie i zablokuje tworzenie raportu.

---

### 3. Składanie do zatwierdzenia

Po utworzeniu raportu należy go **złożyć do zatwierdzenia** przez Prowincjała.

**Krok 1:** Otwórz utworzony raport

**Krok 2:** Sprawdź dane:
- Przejrzyj podsumowanie finansowe
- Sprawdź czy wszystkie operacje są uwzględnione
- Dodaj komentarz (opcjonalnie)

**Krok 3:** Kliknij **"Złóż do zatwierdzenia"**

**Krok 4:** Potwierdź składanie

> 💡 **Wskazówka**: Po złożeniu raportu nie można edytować dokumentów z tego miesiąca bez cofnięcia raportu.

---

### 4. Proces zatwierdzania

**Dla Prowincjała/Admina:**

**Krok 1:** Przejdź do **Raporty** → filtruj po statusie "Oczekujące"

**Krok 2:** Otwórz raport do przeglądu

**Krok 3:** Sprawdź:
- Kompletność danych
- Zgodność z poprzednimi miesiącami
- Realizację budżetu

**Krok 4:** Podejmij decyzję:

| Akcja | Kiedy | Efekt |
|-------|-------|-------|
| ✅ **Zatwierdź** | Raport jest poprawny | Status → "Zatwierdzony" |
| ❌ **Odrzuć** | Wymaga poprawek | Status → "Odrzucony" + komentarz |

⚠️ **Uwaga przy odrzuceniu**: Zawsze dodaj komentarz wyjaśniający co wymaga poprawy!

---

### 5. Eksport i drukowanie

**Eksport do PDF:**
1. Otwórz raport
2. Kliknij **"Eksport PDF"**
3. Pobierz wygenerowany plik

**Eksport do Excel:**
1. Otwórz raport
2. Kliknij **"Eksport Excel"**
3. Pobierz plik .xlsx

**Wydruk:**
1. Wygeneruj PDF
2. Otwórz w przeglądarce PDF
3. Użyj opcji drukowania (Ctrl+P)

---

### 6. Statusy raportów

| Status | Ikona | Opis | Kto może zmienić |
|--------|-------|------|------------------|
| Wersja robocza | 📝 | Raport w przygotowaniu | Ekonom |
| Złożony | 📤 | Oczekuje na zatwierdzenie | Prowincjał |
| Zatwierdzony | ✅ | Zaakceptowany | (niemożliwa zmiana) |
| Odrzucony | ❌ | Wymaga poprawek | Ekonom (ponowne złożenie) |

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
    ┌────┴────┐
    ▼         ▼
✅ Zatwierdzony  ❌ Odrzucony
                    │
                    ▼
               [Ekonom poprawia]
                    │
                    ▼
              📝 Wersja robocza
```

---

### Podsumowanie

- ✅ Raport agreguje dokumenty z miesiąca
- ✅ Sprawdź dane przed złożeniem
- ✅ Prowincjał zatwierdza lub odrzuca z komentarzem
- ✅ Zatwierdzone raporty blokują edycję dokumentów
- ✅ Eksportuj do PDF/Excel do archiwizacji

---
*Ostatnia aktualizacja: Grudzień 2024*',
'raporty',
true,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 9: Report Approval for Provincial
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'🔄 Zatwierdzanie Raportów - Przewodnik dla Prowincjała',
'## 🔄 Zatwierdzanie Raportów - Przewodnik dla Prowincjała

### Spis treści
1. Twoja rola w procesie
2. Znajdowanie raportów do zatwierdzenia
3. Analiza raportu
4. Zatwierdzanie i odrzucanie
5. Dobre praktyki

---

### 1. Twoja rola w procesie

Jako **Prowincjał** jesteś odpowiedzialny za:
- Weryfikację poprawności raportów finansowych
- Zatwierdzanie lub odrzucanie złożonych raportów
- Kontrolę zgodności z budżetem
- Monitorowanie terminowości placówek

> 💡 **Wskazówka**: Regularnie sprawdzaj powiadomienia - system informuje o nowych raportach oczekujących na zatwierdzenie.

---

### 2. Znajdowanie raportów do zatwierdzenia

**Metoda 1: Dashboard**
- Na Dashboard zobaczysz kartę "Oczekujące raporty"
- Kliknij aby przejść bezpośrednio do listy

**Metoda 2: Moduł Raporty**
1. Przejdź do **Raporty**
2. Ustaw filtr statusu na **"Złożone"**
3. Opcjonalnie filtruj po:
   - Lokalizacji
   - Miesiącu/roku
   - Nazwie placówki

---

### 3. Analiza raportu

Przed podjęciem decyzji sprawdź:

**3.1 Kompletność danych**
- [ ] Wszystkie konta mają wpisy
- [ ] Obroty są zbilansowane
- [ ] Brak brakujących dokumentów

**3.2 Zgodność z poprzednimi miesiącami**
- [ ] Saldo początkowe = saldo końcowe poprzedniego miesiąca
- [ ] Brak nietypowych skoków wartości
- [ ] Ciągłość numeracji dokumentów

**3.3 Realizacja budżetu**
- [ ] Przychody vs plan
- [ ] Rozchody vs plan
- [ ] Znaczące odchylenia wyjaśnione

**3.4 Poprawność księgowań**
- [ ] Konta przychodowe (7xx) tylko po stronie Ma
- [ ] Konta kosztowe (4xx) tylko po stronie Wn
- [ ] Rozrachunki (2xx) po właściwych stronach

---

### 4. Zatwierdzanie i odrzucanie

**Zatwierdzanie raportu:**
1. Po pozytywnej weryfikacji kliknij **"Zatwierdź"**
2. Opcjonalnie dodaj komentarz
3. Potwierdź decyzję

**Odrzucanie raportu:**
1. Kliknij **"Odrzuć"**
2. **OBOWIĄZKOWO** dodaj komentarz z:
   - Konkretnymi problemami
   - Instrukcjami co poprawić
   - Terminem ponownego złożenia (opcjonalnie)
3. Potwierdź decyzję

**Przykłady komentarzy przy odrzuceniu:**

✅ **Dobry komentarz:**
> "Brak dokumentacji dla konta 401 (energia) - proszę uzupełnić fakturę za grudzień. Saldo konta 131 nie zgadza się z wyciągiem bankowym - różnica 150 PLN do wyjaśnienia."

❌ **Zły komentarz:**
> "Do poprawy"

---

### 5. Dobre praktyki

**DO (Rób tak):**
- ✅ Sprawdzaj raporty regularnie (nie czekaj do końca kwartału)
- ✅ Zawsze dodawaj konstruktywne komentarze przy odrzuceniu
- ✅ Porównuj z poprzednimi miesiącami
- ✅ Kontaktuj się z ekonomem w razie wątpliwości

**DON''T (Nie rób tak):**
- ❌ Nie zatwierdzaj raportów bez weryfikacji
- ❌ Nie odrzucaj bez wyjaśnienia przyczyny
- ❌ Nie ignoruj powiadomień o nowych raportach
- ❌ Nie zmieniaj statusu wielokrotnie bez powodu

---

### Podsumowanie

- ✅ Regularnie sprawdzaj oczekujące raporty
- ✅ Weryfikuj kompletność i zgodność danych
- ✅ Porównuj z budżetem i poprzednimi okresami
- ✅ Dodawaj szczegółowe komentarze przy odrzuceniu
- ✅ Utrzymuj kontakt z ekonomami

---
*Ostatnia aktualizacja: Grudzień 2024*',
'raporty',
true,
ARRAY['prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 10: Data Visualization
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'📈 Wizualizacja Danych i Analityka',
'## 📈 Wizualizacja Danych i Analityka

### Spis treści
1. Dostępne wizualizacje
2. Wykresy finansowe
3. Porównania między placówkami
4. Filtry i okresy
5. Eksport danych

---

### 1. Dostępne wizualizacje

Moduł **Wizualizacja Danych** oferuje graficzne przedstawienie finansów:

| Typ wykresu | Zastosowanie |
|-------------|-------------|
| Słupkowy | Porównanie wartości między kategoriami |
| Liniowy | Trendy w czasie |
| Kołowy | Struktura procentowa |
| Tabelaryczny | Szczegółowe zestawienia |

---

### 2. Wykresy finansowe

**Wykres przychodów i rozchodów:**
- Oś X: Miesiące
- Oś Y: Wartości w PLN
- Linie: Przychody (zielone), Rozchody (czerwone)

**Wykres struktury kosztów:**
- Podział kosztów na kategorie (energia, wynagrodzenia, materiały, etc.)
- Widok procentowy lub wartościowy

**Wykres realizacji budżetu:**
- Plan vs wykonanie
- Kolorowanie: zielony (w normie), żółty (zbliża się do limitu), czerwony (przekroczenie)

---

### 3. Porównania między placówkami

**Dla Prowincjała i Administratora:**

Możesz porównać wyniki finansowe różnych placówek:
1. Wybierz **"Porównanie placówek"**
2. Zaznacz placówki do porównania (max 5)
3. Wybierz metrykę (przychody, rozchody, bilans)
4. Wybierz okres

**Dostępne metryki:**
- Przychody ogółem
- Rozchody ogółem
- Bilans (przychody - rozchody)
- Realizacja budżetu (%)
- Średni koszt na miesiąc

---

### 4. Filtry i okresy

**Filtrowanie danych:**
| Filtr | Opcje |
|-------|-------|
| Okres | Miesiąc / Kwartał / Rok / Zakres dat |
| Placówka | Wszystkie / Wybrane |
| Kategoria | Przychody / Rozchody / Wszystko |
| Konta | Wybrane grupy kont |

**Predefiniowane okresy:**
- Bieżący miesiąc
- Poprzedni miesiąc
- Bieżący kwartał
- Bieżący rok
- Rok poprzedni
- Własny zakres

---

### 5. Eksport danych

**Eksport wykresów:**
1. Wygeneruj wykres
2. Kliknij ikonę **pobierania**
3. Wybierz format: PNG / PDF

**Eksport danych źródłowych:**
1. Kliknij **"Eksport do Excel"**
2. Otrzymasz plik .xlsx z:
   - Danymi źródłowymi
   - Podsumowaniami
   - Wykresami (jeśli obsługiwane)

---

### Podsumowanie

- ✅ Wizualizacje pomagają zrozumieć trendy
- ✅ Porównuj placówki (Prowincjał/Admin)
- ✅ Używaj filtrów do precyzyjnej analizy
- ✅ Eksportuj wykresy i dane do prezentacji

---
*Ostatnia aktualizacja: Grudzień 2024*',
'raporty',
false,
ARRAY['prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 11: Budget Planning Complete Guide
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'💰 Planowanie Budżetu - Kompletny Przewodnik',
'## 💰 Planowanie Budżetu Rocznego - Kompletny Przewodnik

### Spis treści
1. Co to jest budżet
2. Tworzenie budżetu
3. Metody prognozowania
4. Modyfikatory budżetowe
5. Załączniki i notatki
6. Składanie do zatwierdzenia
7. Kopiowanie z poprzedniego roku

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
| Rok | Rok budżetowy (np. 2025) |
| Lokalizacja | Twoja placówka |
| Metoda prognozowania | Sposób wyliczenia prognoz |

**Krok 3:** Wypełnij pozycje budżetowe

**Struktura tabeli budżetu:**

```
┌────────────────────────────────────────────────────────────────┐
│         PRZYCHODY (7xx)          │         ROZCHODY (4xx)      │
├────────────────────────────────────────────────────────────────┤
│ Konto │ Nazwa │ Plan │ Prognoza │ Konto │ Nazwa │ Plan │ Progn. │
│ 701   │ Ofiary│ 5000 │   4800   │ 401   │Energia│ 800  │  750   │
│ 702   │ Dotac.│ 2000 │   1500   │ 402   │ Gaz   │ 400  │  380   │
└────────────────────────────────────────────────────────────────┘
```

---

### 3. Metody prognozowania

System oferuje **3 metody** automatycznego wyliczania prognoz:

| Metoda | Opis | Kiedy używać |
|--------|------|-------------|
| **Ostatni rok** | Kwoty z poprzedniego roku | Stabilne finanse, brak zmian |
| **Średnia 3 lat** | Średnia z ostatnich 3 lat | Uśrednienie wahań |
| **Ręcznie** | Wprowadzasz wartości sam | Znaczące zmiany planowane |

**Jak zmienić metodę:**
1. Wybierz metodę z listy rozwijanej
2. Kliknij **"Generuj prognozę"**
3. System automatycznie wypełni kolumnę "Prognoza"

> 💡 **Wskazówka**: Prognoza to punkt wyjścia - zawsze możesz edytować wartości ręcznie.

---

### 4. Modyfikatory budżetowe

**Modyfikatory** pozwalają dodać specjalne korekty do budżetu:

| Modyfikator | Opis | Przykład |
|-------------|------|----------|
| **Prognozowane inne wydatki** | Dodatkowe koszty nieprzewidziane w kontach | Remont dachu: 50.000 PLN |
| **Planowana redukcja kosztów** | Oczekiwane oszczędności | Wymiana okien = -20% na ogrzewaniu |

**Jak dodać modyfikator:**
1. Znajdź sekcję "Modyfikatory" w formularzu
2. Wprowadź kwotę (może być ujemna dla redukcji)
3. Dodaj opis wyjaśniający

---

### 5. Załączniki i notatki

**Załączniki:**
- Możesz dołączyć pliki (PDF, obrazy, dokumenty)
- Np. kosztorysy remontów, oferty wykonawców

**Komentarze:**
- Pole tekstowe na dodatkowe wyjaśnienia
- Ważne konteksty dla Prowincjała

---

### 6. Składanie do zatwierdzenia

**Workflow budżetu:**

```
  📝 Wersja robocza
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

**Krok 1:** Sprawdź kompletność budżetu
**Krok 2:** Kliknij **"Złóż do zatwierdzenia"**
**Krok 3:** Poczekaj na decyzję Prowincjała

⚠️ **Uwaga**: Po zatwierdzeniu budżet staje się **tylko do odczytu** - nie można go edytować!

---

### 7. Kopiowanie z poprzedniego roku

Aby przyspieszyć tworzenie budżetu:

1. W formularzu nowego budżetu kliknij **"Kopiuj z poprzedniego roku"**
2. System skopiuje:
   - Pozycje budżetowe
   - Kwoty planowane
   - Modyfikatory (opcjonalnie)
3. Dostosuj wartości do nowego roku

> 💡 **Wskazówka**: Kopiowanie oszczędza czas, ale zawsze przejrzyj skopiowane wartości!

---

### Podsumowanie

- ✅ Budżet to roczny plan finansowy
- ✅ Wybierz metodę prognozowania odpowiednią dla placówki
- ✅ Używaj modyfikatorów dla specjalnych korekt
- ✅ Dołącz załączniki i komentarze
- ✅ Po zatwierdzeniu budżet jest read-only

---
*Ostatnia aktualizacja: Grudzień 2024*',
'budzet',
true,
ARRAY['ekonom', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 12: Budget Battery
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'🔋 Bateria Realizacji - Kontrola Budżetu',
'## 🔋 Bateria Realizacji - Wizualna Kontrola Budżetu

### Spis treści
1. Co to jest "bateria"
2. Znaczenie kolorów
3. Interpretacja wyników
4. Alerty o przekroczeniach
5. Działania naprawcze

---

### 1. Co to jest "bateria"

**Bateria realizacji** to wizualizacja pokazująca jaki procent budżetu został wykorzystany w danym miesiącu.

```
Styczeń   [████████░░] 78%   ← zielony
Luty      [██████████] 95%   ← pomarańczowy  
Marzec    [██████████▓] 112% ← czerwony
Kwiecień  [████░░░░░░] 45%   ← szary
```

**Formuła:**
```
Realizacja = (Wykonanie / (Budżet roczny / 12)) × 100%
```

---

### 2. Znaczenie kolorów

| Kolor | Zakres | Znaczenie | Działanie |
|-------|--------|-----------|-----------|
| 🟢 **Zielony** | 60-80% | Optymalny | Kontynuuj obecne działania |
| 🟡 **Pomarańczowy** | 81-99% | Zbliża się do limitu | Monitoruj uważnie |
| 🔴 **Czerwony** | ≥100% | Przekroczenie! | Wymagana interwencja |
| ⚪ **Szary** | <50% | Niedowykorzystanie | Sprawdź czy nie brakuje dokumentów |

> 💡 **Wskazówka**: Idealny poziom to 70-85% - oznacza, że budżet jest dobrze dopasowany do rzeczywistości.

---

### 3. Interpretacja wyników

**Przykład 1: Zielona bateria (75%)**
- Wydatki w normie
- Budżet dobrze zaplanowany
- Brak działań wymaganych

**Przykład 2: Pomarańczowa bateria (92%)**
- Zbliżasz się do limitu miesięcznego
- Sprawdź czy nie ma nieoczekiwanych kosztów
- Rozważ ograniczenie wydatków

**Przykład 3: Czerwona bateria (115%)**
- Przekroczono budżet miesięczny
- Wymagana analiza przyczyn
- Powiadom Prowincjała

**Przykład 4: Szara bateria (35%)**
- Bardzo niskie wykorzystanie
- Możliwe przyczyny:
  - Brak wprowadzonych dokumentów
  - Sezonowość wydatków (np. ogrzewanie latem)
  - Błędnie zaplanowany budżet

---

### 4. Alerty o przekroczeniach

System automatycznie generuje alerty:

| Alert | Próg | Działanie systemu |
|-------|------|-------------------|
| Ostrzeżenie | 90% | Powiadomienie dla Ekonoma |
| Przekroczenie | 100% | Powiadomienie dla Ekonoma i Prowincjała |
| Krytyczne | 120% | Email do Prowincjała |

---

### 5. Działania naprawcze

**Gdy bateria jest czerwona:**

1. **Zidentyfikuj przyczynę**
   - Które konta przekroczyły limit?
   - Czy to jednorazowy wydatek czy trend?

2. **Dokumentuj**
   - Dodaj komentarz w systemie
   - Przygotuj wyjaśnienie dla Prowincjała

3. **Planuj**
   - Czy można zredukować wydatki w kolejnych miesiącach?
   - Czy potrzebna jest korekta budżetu?

**Gdy bateria jest szara:**

1. **Sprawdź dokumentację**
   - Czy wszystkie dokumenty są wprowadzone?
   - Czy nie ma opóźnień w księgowaniu?

2. **Zweryfikuj budżet**
   - Czy plan był realistyczny?
   - Czy uwzględniono sezonowość?

---

### Podsumowanie

- ✅ Bateria to szybki wskaźnik zdrowia finansowego
- ✅ Zielony = OK, Czerwony = problem
- ✅ System automatycznie wysyła alerty
- ✅ Analizuj przyczyny odchyleń
- ✅ Dokumentuj i komunikuj problemy

---
*Ostatnia aktualizacja: Grudzień 2024*',
'budzet',
false,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 13: Multi-year Comparison
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'📊 Porównania Wieloletnie i Raporty Odchyleń',
'## 📊 Porównania Wieloletnie i Raporty Odchyleń

### Spis treści
1. Porównanie wieloletnie
2. Raport odchyleń
3. Eksport do Excel
4. Interpretacja danych

---

### 1. Porównanie wieloletnie

**Porównanie wieloletnie** pozwala zestawić budżety i wykonania z różnych lat.

**Jak wygenerować:**
1. Przejdź do **Budżet**
2. Kliknij **"Porównanie wieloletnie"**
3. Wybierz lata do porównania (np. 2022, 2023, 2024)
4. Wybierz lokalizację

**Generowana tabela:**

| Konto | 2022 Plan | 2022 Wyk. | 2023 Plan | 2023 Wyk. | 2024 Plan | 2024 Wyk. |
|-------|-----------|-----------|-----------|-----------|-----------|-----------|
| 401 Energia | 8.000 | 7.500 | 9.000 | 8.800 | 10.000 | 9.200 |
| 402 Gaz | 4.000 | 4.200 | 4.500 | 4.100 | 5.000 | ? |

> 💡 **Wskazówka**: Porównanie pomaga identyfikować trendy i planować przyszłe budżety.

---

### 2. Raport odchyleń

**Raport odchyleń** pokazuje różnicę między planem a wykonaniem.

**Struktura raportu:**

| Konto | Plan | Wykonanie | Odchylenie | Odchylenie % |
|-------|------|-----------|------------|--------------|
| 401 Energia | 10.000 | 9.200 | -800 | -8% |
| 402 Gaz | 5.000 | 5.500 | +500 | +10% |

**Interpretacja odchyleń:**
- **Ujemne (-)** = Zaoszczędzono względem planu
- **Dodatnie (+)** = Przekroczono plan

---

### 3. Eksport do Excel

**Eksport porównania:**
1. Wygeneruj porównanie wieloletnie
2. Kliknij **"Eksport do Excel"**
3. Plik .xlsx zawiera:
   - Wszystkie dane tabelaryczne
   - Formatowanie (kolory, obramowania)
   - Automatyczne formuły sum

**Użycie w prezentacjach:**
- Importuj do PowerPoint
- Twórz własne wykresy
- Przygotuj materiały na spotkania

---

### 4. Interpretacja danych

**Analiza trendów:**
| Trend | Znaczenie | Działanie |
|-------|-----------|-----------|
| Rosnące koszty energii | Wzrost cen lub zużycia | Rozważ inwestycje w efektywność |
| Spadające przychody | Mniejsze wpływy | Szukaj nowych źródeł |
| Stabilne odchylenia | Dobrze zaplanowany budżet | Kontynuuj metodę planowania |

**Pytania do analizy:**
- Czy odchylenia są systematyczne czy losowe?
- Które kategorie wymagają lepszego planowania?
- Jakie czynniki zewnętrzne wpływają na wyniki?

---

### Podsumowanie

- ✅ Porównuj budżety z różnych lat
- ✅ Analizuj odchylenia plan vs wykonanie
- ✅ Eksportuj dane do dalszej analizy
- ✅ Identyfikuj trendy i wzorce

---
*Ostatnia aktualizacja: Grudzień 2024*',
'budzet',
false,
ARRAY['prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 14: Account Search Master Guide
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'🔍 Wyszukiwanie Kont - Mistrzowski Przewodnik',
'## 🔍 Wyszukiwanie Kont - Mistrzowski Przewodnik

### Spis treści
1. Wprowadzenie
2. Wyszukiwanie konta
3. Obroty miesięczne
4. Lista transakcji
5. Edycja z poziomu wyszukiwarki
6. Eksport danych

---

### 1. Wprowadzenie

Moduł **Wyszukiwanie Kont** pozwala na szczegółową analizę obrotów i transakcji na wybranym koncie księgowym.

**Co możesz sprawdzić:**
- Obroty miesięczne (Wn/Ma)
- Saldo konta
- Listę wszystkich transakcji
- Dokumenty powiązane z transakcjami

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
| Miesiąc | Konkretny miesiąc (np. grudzień 2024) |
| Zakres | Od-do (np. styczeń - grudzień 2024) |
| Cały rok | Wszystkie miesiące wybranego roku |

> 💡 **Wskazówka**: System pokazuje tylko konta przypisane do Twojej lokalizacji.

---

### 3. Obroty miesięczne

Po wybraniu konta zobaczysz **tabelę obrotów miesięcznych**:

| Miesiąc | Obrót Wn | Obrót Ma | Saldo |
|---------|----------|----------|-------|
| Styczeń | 1.500,00 | 200,00 | 1.300,00 Wn |
| Luty | 800,00 | 100,00 | 700,00 Wn |
| ... | ... | ... | ... |
| **RAZEM** | **12.000,00** | **1.500,00** | **10.500,00 Wn** |

**Objaśnienia:**
- **Obrót Wn** = Suma kwot po stronie Winien
- **Obrót Ma** = Suma kwot po stronie Ma
- **Saldo** = Obrót Wn - Obrót Ma (lub odwrotnie, zależnie od typu konta)

---

### 4. Lista transakcji

Kliknij na miesiąc aby zobaczyć **szczegółową listę transakcji**:

| Data | Dokument | Opis | Kwota Wn | Kwota Ma |
|------|----------|------|----------|----------|
| 05.12 | DOK/2024/12/001 | Faktura za prąd | 500,00 | - |
| 12.12 | DOK/2024/12/003 | Korekta | - | 50,00 |
| 20.12 | DOK/2024/12/007 | Faktura za prąd | 450,00 | - |

**Informacje o transakcji:**
- Data operacji
- Numer dokumentu źródłowego
- Opis operacji
- Kwota (po właściwej stronie)
- Konto przeciwstawne

---

### 5. Edycja z poziomu wyszukiwarki

Możesz **przejść do edycji dokumentu** bezpośrednio z listy transakcji:

1. Znajdź transakcję na liście
2. Kliknij numer dokumentu (link)
3. Otworzy się dokument do edycji

> 💡 **Wskazówka**: To najszybszy sposób na znalezienie i poprawienie konkretnej operacji!

---

### 6. Eksport danych

**Eksport obrotów:**
1. Wygeneruj zestawienie obrotów
2. Kliknij **"Eksport"**
3. Wybierz format: Excel / CSV / PDF

**Eksport transakcji:**
1. Wyświetl listę transakcji
2. Kliknij **"Eksport transakcji"**
3. Pobierz plik z pełną listą

---

### Podsumowanie

- ✅ Wyszukuj po numerze lub nazwie konta
- ✅ Analizuj obroty miesięczne i salda
- ✅ Przeglądaj szczegółowe transakcje
- ✅ Edytuj dokumenty bezpośrednio z wyszukiwarki
- ✅ Eksportuj dane do dalszej analizy

---
*Ostatnia aktualizacja: Grudzień 2024*',
'konta',
true,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 15: Chart of Accounts Structure
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'📚 Plan Kont - Struktura i Numeracja',
'## 📚 Plan Kont - Struktura i Numeracja

### Spis treści
1. Struktura numeru konta
2. Grupy kont (0xx - 8xx)
3. Konta przychodowe vs kosztowe
4. Identyfikacja placówki w koncie
5. Konta analityczne

---

### 1. Struktura numeru konta

Każde konto ma strukturę: **XXX-Y-Z**

```
 401 - 2 - 3
  │    │   │
  │    │   └── Identyfikator lokalizacji (3 = Gorzów)
  │    └────── Kategoria (2 = ogólna)
  └─────────── Numer syntetyczny (401 = energia)
```

---

### 2. Grupy kont (0xx - 8xx)

| Grupa | Zakres | Nazwa | Przykłady |
|-------|--------|-------|-----------|
| **0** | 010-099 | Aktywa trwałe | Budynki, maszyny |
| **1** | 100-199 | Środki pieniężne | Kasa, bank |
| **2** | 200-299 | Rozrachunki | Należności, zobowiązania |
| **3** | 300-399 | Materiały i towary | Zapasy |
| **4** | 400-499 | **Koszty** | Energia, wynagrodzenia |
| **5** | 500-599 | Koszty działalności | Koszty wydziałowe |
| **6** | 600-699 | Produkty | Produkcja w toku |
| **7** | 700-799 | **Przychody** | Ofiary, dotacje |
| **8** | 800-899 | Kapitały | Wynik finansowy |

> 💡 **Wskazówka**: Najważniejsze dla ekonoma to grupy **4xx** (koszty) i **7xx** (przychody).

---

### 3. Konta przychodowe vs kosztowe

**Konta przychodowe (7xx):**
| Konto | Nazwa | Strona |
|-------|-------|--------|
| 700 | Przychody ogólne | Ma |
| 701 | Ofiary | Ma |
| 702 | Dotacje | Ma |
| 703 | Darowizny | Ma |

**Konta kosztowe (4xx):**
| Konto | Nazwa | Strona |
|-------|-------|--------|
| 400 | Amortyzacja | Wn |
| 401 | Zużycie energii | Wn |
| 402 | Zużycie gazu | Wn |
| 403 | Woda i ścieki | Wn |
| 404 | Wynagrodzenia | Wn |
| 409 | Pozostałe koszty | Wn |

**Zasada:**
- Przychody księgujemy po stronie **Ma**
- Koszty księgujemy po stronie **Wn**

---

### 4. Identyfikacja placówki w koncie

Sufiks konta identyfikuje placówkę:

| Sufiks | Placówka |
|--------|----------|
| 2-2 | Gdańsk |
| 2-3 | Gorzów |
| 3-15 | Warszawa |
| ... | ... |

**Przykład:**
- 401-**2-3** = Energia dla **Gorzowa**
- 401-**2-2** = Energia dla **Gdańska**

> 💡 **Wskazówka**: System automatycznie filtruje konta do Twojej lokalizacji - nie zobaczysz kont innych placówek.

---

### 5. Konta analityczne

**Konto syntetyczne** to konto główne (np. 401 - Energia).

**Konto analityczne** to szczegółowe rozwinięcie (np. 401-01 - Energia elektryczna, 401-02 - Energia cieplna).

Niektóre konta wymagają rozwinięcia analitycznego:
- Rozrachunki (2xx) - szczegóły kontrahentów
- Koszty specjalne - podział na podkategorie

---

### Podsumowanie

- ✅ Konto = XXX-Y-Z (syntetyka-kategoria-lokalizacja)
- ✅ 4xx = koszty (strona Wn)
- ✅ 7xx = przychody (strona Ma)
- ✅ Sufiks identyfikuje placówkę
- ✅ System filtruje konta do Twojej lokalizacji

---
*Ostatnia aktualizacja: Grudzień 2024*',
'konta',
false,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 16: User Management
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'👤 Zarządzanie Użytkownikami',
'## 👤 Zarządzanie Użytkownikami - Przewodnik Administratora

### Spis treści
1. Panel użytkowników
2. Tworzenie nowego użytkownika
3. Edycja użytkownika
4. Blokowanie i odblokowywanie
5. Historia logowań
6. Przypisywanie lokalizacji

---

### 1. Panel użytkowników

**Dostęp:** Administracja → Użytkownicy

**Widok listy:**
| Kolumna | Opis |
|---------|------|
| Imię i nazwisko | Pełna nazwa użytkownika |
| Email | Adres email (login) |
| Rola | ekonom / proboszcz / prowincjał / admin |
| Lokalizacja | Przypisana placówka |
| Status | Aktywny / Zablokowany |
| Ostatnie logowanie | Data i godzina |

---

### 2. Tworzenie nowego użytkownika

**Krok 1:** Kliknij **"Dodaj użytkownika"**

**Krok 2:** Wypełnij formularz:
| Pole | Wymagane | Opis |
|------|----------|------|
| Email | ✅ | Będzie służył jako login |
| Imię | ✅ | Imię użytkownika |
| Nazwisko | ✅ | Nazwisko użytkownika |
| Rola | ✅ | Wybierz z listy |
| Lokalizacja | ⚡ | Wymagane dla ekonoma/proboszcza |
| Hasło | ✅ | Minimum 8 znaków |

**Krok 3:** Kliknij **"Zapisz"**

**Krok 4:** System wyśle email powitalny z danymi logowania

> 💡 **Wskazówka**: Poinstruuj nowego użytkownika aby zmienił hasło przy pierwszym logowaniu.

---

### 3. Edycja użytkownika

**Krok 1:** Znajdź użytkownika na liście

**Krok 2:** Kliknij ikonę edycji (✏️)

**Co można zmienić:**
- ✅ Imię i nazwisko
- ✅ Rola
- ✅ Przypisana lokalizacja
- ✅ Telefon, stanowisko
- ⚠️ Email - wymaga ostrożności (to login!)
- 🔒 Hasło - przez osobną opcję

---

### 4. Blokowanie i odblokowywanie

**Kiedy blokować użytkownika:**
- Odejście z placówki
- Naruszenie zasad bezpieczeństwa
- Tymczasowe zawieszenie dostępu

**Jak zablokować:**
1. Znajdź użytkownika
2. Kliknij przycisk **"Zablokuj"**
3. Potwierdź akcję

**Skutki zablokowania:**
- Użytkownik nie może się zalogować
- Istniejąca sesja zostaje zakończona
- Dane użytkownika pozostają w systemie

**Odblokowywanie:**
1. Znajdź zablokowanego użytkownika (status: Zablokowany)
2. Kliknij **"Odblokuj"**
3. Użytkownik może ponownie się logować

---

### 5. Historia logowań

**Dostęp:** Administracja → Historia logowań

**Monitorowane zdarzenia:**
| Zdarzenie | Opis |
|-----------|------|
| Logowanie udane | Użytkownik zalogował się pomyślnie |
| Logowanie nieudane | Błędne hasło lub email |
| Wylogowanie | Użytkownik się wylogował |
| Blokada konta | Konto zablokowane po 5 nieudanych próbach |

**Informacje o zdarzeniu:**
- Data i godzina
- Adres IP
- Przeglądarka / urządzenie
- Status (sukces/błąd)

> 💡 **Wskazówka**: Regularnie przeglądaj nieudane logowania - mogą wskazywać na próby włamania.

---

### 6. Przypisywanie lokalizacji

Użytkownik może mieć przypisaną **jedną lub więcej** lokalizacji.

**Jedna lokalizacja (typowe):**
- Ekonom widzi tylko dokumenty swojej placówki
- Proboszcz nadzoruje swoją placówkę

**Wiele lokalizacji (specjalne przypadki):**
- Ekonom obsługujący kilka małych placówek
- Prowincjał nadzorujący wszystkie

**Jak przypisać dodatkową lokalizację:**
1. Edytuj użytkownika
2. W sekcji "Lokalizacje" kliknij "Dodaj"
3. Wybierz dodatkową lokalizację
4. Zapisz

---

### Podsumowanie

- ✅ Twórz użytkowników z odpowiednimi rolami
- ✅ Przypisuj lokalizacje zgodnie z obowiązkami
- ✅ Blokuj nieaktywne konta
- ✅ Monitoruj historię logowań
- ✅ Informuj użytkowników o zasadach bezpieczeństwa

---
*Ostatnia aktualizacja: Grudzień 2024*',
'administracja',
true,
ARRAY['admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 17: Location and Account Management
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'🏢 Zarządzanie Placówkami i Kontami',
'## 🏢 Zarządzanie Placówkami i Kontami - Przewodnik Administratora

### Spis treści
1. Panel placówek
2. Dodawanie nowej placówki
3. Ustawienia placówki
4. Przypisywanie kont księgowych
5. Ograniczenia kategorii kont
6. Konfiguracja walut

---

### 1. Panel placówek

**Dostęp:** Administracja → Placówki

**Lista placówek zawiera:**
| Kolumna | Opis |
|---------|------|
| Nazwa | Pełna nazwa placówki |
| Identyfikator | Kod lokalizacji (np. 2-3) |
| Adres | Adres fizyczny |
| NIP | Numer identyfikacji podatkowej |
| REGON | Numer REGON |

---

### 2. Dodawanie nowej placówki

**Krok 1:** Kliknij **"Dodaj placówkę"**

**Krok 2:** Wypełnij dane:
| Pole | Wymagane | Przykład |
|------|----------|----------|
| Nazwa | ✅ | "Dom Zakonny w Poznaniu" |
| Identyfikator | ✅ | "2-5" |
| Adres | ❌ | ul. Przykładowa 10, 61-001 Poznań |
| NIP | ❌ | 123-456-78-90 |
| REGON | ❌ | 123456789 |

**Krok 3:** Zapisz placówkę

**Krok 4:** Przypisz konta księgowe (następny krok)

> 💡 **Wskazówka**: Identyfikator musi być unikalny i odpowiadać strukturze kont (sufiks -X-Y).

---

### 3. Ustawienia placówki

Każda placówka ma indywidualne ustawienia:

| Ustawienie | Opis |
|------------|------|
| Skrót placówki | Krótka nazwa do dokumentów |
| Obsługa walut obcych | Czy placówka może używać EUR, USD, etc. |
| Konta przypisane | Lista dostępnych kont |

**Jak edytować ustawienia:**
1. Znajdź placówkę na liście
2. Kliknij ikonę ustawień (⚙️)
3. Zmień parametry
4. Zapisz

---

### 4. Przypisywanie kont księgowych

Każda placówka musi mieć przypisane **konta księgowe** z sufiksem odpowiadającym jej identyfikatorowi.

**Automatyczne przypisanie:**
- System tworzy konta z właściwym sufiksem
- np. dla placówki 2-3: 401-2-3, 701-2-3, etc.

**Ręczne przypisanie dodatkowych kont:**
1. Przejdź do ustawień placówki
2. Sekcja "Konta"
3. Kliknij "Dodaj konto"
4. Wybierz konto z listy globalnej

**Usuwanie przypisania:**
1. Znajdź konto na liście przypisań
2. Kliknij "Usuń"
3. Konto pozostaje w systemie, ale placówka go nie widzi

---

### 5. Ograniczenia kategorii kont

Można ograniczyć, które kategorie kont są dostępne dla placówki.

**Przykład:**
- Mała placówka nie potrzebuje kont magazynowych (3xx)
- Placówka bez działalności gospodarczej nie potrzebuje kont produkcji (6xx)

**Jak ustawić ograniczenie:**
1. Administracja → Ograniczenia kont
2. Wybierz placówkę
3. Zaznacz kategorie do zablokowania
4. Zapisz

---

### 6. Konfiguracja walut

Domyślna waluta to **PLN**. Niektóre placówki mogą potrzebować obsługi walut obcych.

**Włączenie walut obcych:**
1. Ustawienia placówki
2. Zaznacz "Obsługa walut obcych"
3. Zapisz

**Dostępne waluty:**
- PLN (zawsze dostępna)
- EUR
- USD
- GBP
- (inne na życzenie)

⚠️ **Uwaga**: Dokumenty w walutach obcych wymagają podania kursu wymiany!

---

### Podsumowanie

- ✅ Twórz placówki z unikalnymi identyfikatorami
- ✅ Przypisuj odpowiednie konta księgowe
- ✅ Ograniczaj zbędne kategorie kont
- ✅ Włącz waluty obce gdy potrzebne
- ✅ Uzupełniaj dane adresowe i podatkowe

---
*Ostatnia aktualizacja: Grudzień 2024*',
'administracja',
false,
ARRAY['admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 18: Reminders and Error Reports
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'🔔 Przypomnienia i Zgłoszenia Błędów',
'## 🔔 Przypomnienia i Zgłoszenia Błędów

### Spis treści
1. System przypomnień
2. Konfiguracja przypomnień
3. Ręczne wysyłanie
4. Zgłoszenia błędów
5. Obsługa zgłoszeń

---

### 1. System przypomnień

System automatycznie wysyła **przypomnienia email** o terminach:

| Typ przypomnienia | Kiedy | Do kogo |
|-------------------|-------|---------|
| Raport - 5 dni przed | 5 dni przed terminem | Ekonom |
| Raport - 1 dzień przed | 1 dzień przed terminem | Ekonom |
| Raport - po terminie | Codziennie po terminie | Ekonom + Prowincjał |
| Budżet - termin | Według konfiguracji | Ekonom |

---

### 2. Konfiguracja przypomnień

**Dostęp:** Administracja → Przypomnienia

**Parametry:**
| Parametr | Opis | Domyślna wartość |
|----------|------|------------------|
| Termin raportu | Dzień miesiąca | 10. dzień następnego miesiąca |
| Przypomnienie 1 | Ile dni przed | 5 dni |
| Przypomnienie 2 | Ile dni przed | 1 dzień |
| Po terminie | Częstotliwość | Codziennie |

---

### 3. Ręczne wysyłanie

Administrator może wysłać przypomnienia **ręcznie**:

**Dla pojedynczej placówki:**
1. Administracja → Przypomnienia
2. Znajdź placówkę
3. Kliknij **"Wyślij przypomnienie"**

**Dla wszystkich placówek:**
1. Administracja → Przypomnienia
2. Kliknij **"Wyślij do wszystkich"**
3. Potwierdź akcję

> 💡 **Wskazówka**: Używaj ręcznego wysyłania w sytuacjach awaryjnych lub gdy automatyka nie zadziałała.

---

### 4. Zgłoszenia błędów

Użytkownicy mogą zgłaszać problemy przez **formularz błędów**.

**Jak zgłosić błąd (dla użytkownika):**
1. Kliknij ikonę błędu (🐛) w prawym dolnym rogu
2. Wypełnij formularz:
   - Tytuł problemu
   - Opis szczegółowy
   - Zrzut ekranu (opcjonalnie)
3. Wyślij zgłoszenie

**Co zawiera zgłoszenie:**
- Dane użytkownika
- URL strony z błędem
- Informacje o przeglądarce
- Zrzut ekranu
- Opis problemu

---

### 5. Obsługa zgłoszeń

**Dostęp:** Administracja → Zgłoszenia błędów

**Statusy zgłoszeń:**
| Status | Ikona | Znaczenie |
|--------|-------|-----------|
| Nowe | 🆕 | Oczekuje na obsługę |
| W trakcie | 🔄 | Administrator pracuje nad problemem |
| Wymaga info | ❓ | Potrzebne dodatkowe informacje |
| Rozwiązane | ✅ | Problem naprawiony |
| Zamknięte | 🔒 | Sprawa zakończona |

**Priorytety:**
| Priorytet | Kolor | Czas reakcji |
|-----------|-------|--------------|
| Krytyczny | 🔴 | Natychmiast |
| Wysoki | 🟠 | 24h |
| Średni | 🟡 | 3 dni |
| Niski | 🟢 | Tydzień |

**Obsługa zgłoszenia:**
1. Otwórz zgłoszenie
2. Przeanalizuj problem
3. Dodaj odpowiedź/komentarz
4. Zmień status
5. System powiadomi użytkownika o zmianach

---

### Podsumowanie

- ✅ System automatycznie wysyła przypomnienia
- ✅ Konfiguruj terminy i częstotliwość
- ✅ Używaj ręcznego wysyłania gdy potrzeba
- ✅ Monitoruj i obsługuj zgłoszenia błędów
- ✅ Komunikuj się z użytkownikami przez system

---
*Ostatnia aktualizacja: Grudzień 2024*',
'administracja',
false,
ARRAY['admin', 'prowincjal'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 19: FAQ
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'❓ FAQ - 50 Najczęściej Zadawanych Pytań',
'## ❓ FAQ - Najczęściej Zadawane Pytania

### Spis treści
1. Logowanie i dostęp
2. Dokumenty
3. Raporty
4. Budżet
5. Konta
6. Problemy techniczne

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

**P: Jak usunąć operację z dokumentu?**
O: Zaznacz checkbox przy operacji i kliknij "Usuń zaznaczone" lub użyj ikony kosza.

**P: Czy mogę edytować dokument z poprzedniego miesiąca?**
O: Zależy od statusu raportu. Jeśli raport został złożony lub zatwierdzony, edycja jest zablokowana.

**P: Jak importować wyciąg bankowy?**
O: W oknie dokumentu kliknij "Import MT940", wybierz plik wyciągu, a następnie przypisz konta do zaimportowanych operacji.

**P: Polskie znaki wyświetlają się nieprawidłowo po imporcie CSV.**
O: Zapisz plik CSV w kodowaniu UTF-8 przed importem. System obsługuje też Windows-1250, ale UTF-8 jest bezpieczniejszy.

**P: Jak zmienić kolejność operacji?**
O: Przeciągnij operację za ikonę [≡] w nowe miejsce.

**P: Jak rozbić operację na kilka kont?**
O: Kliknij ikonę "Rozdziel" przy operacji, podaj kwotę do wydzielenia.

---

## 3. Raporty

**P: Nie mogę utworzyć raportu - system blokuje.**
O: Sprawdź czy nie ma niekompletnych dokumentów w wybranym miesiącu. System wyświetli listę problematycznych dokumentów.

**P: Jak cofnąć złożony raport?**
O: Skontaktuj się z Prowincjałem lub Administratorem - tylko oni mogą cofnąć status raportu.

**P: Kiedy jest termin składania raportu?**
O: Standardowo do 10. dnia następnego miesiąca. Sprawdź powiadomienia - system przypomni Ci o terminie.

**P: Jak wyeksportować raport do PDF?**
O: Otwórz raport i kliknij "Eksport PDF".

**P: Dlaczego mój raport został odrzucony?**
O: Sprawdź komentarz od Prowincjała - zawiera informację co wymaga poprawy.

---

## 4. Budżet

**P: Jak utworzyć budżet na nowy rok?**
O: Budżet → Nowy budżet → Wybierz rok i metodę prognozowania → Wypełnij pozycje → Złóż do zatwierdzenia.

**P: Co oznaczają kolory "baterii"?**
O: 🟢 Zielony (60-80%) - OK, 🟡 Pomarańczowy (81-99%) - uwaga, 🔴 Czerwony (≥100%) - przekroczenie, ⚪ Szary (<50%) - niedowykorzystanie.

**P: Czy mogę edytować zatwierdzony budżet?**
O: Nie, zatwierdzony budżet jest tylko do odczytu. W wyjątkowych przypadkach skontaktuj się z Administratorem.

**P: Jak skopiować budżet z poprzedniego roku?**
O: W formularzu nowego budżetu kliknij "Kopiuj z poprzedniego roku".

**P: Co to jest "metoda prognozowania"?**
O: Sposób wyliczania prognoz: "Ostatni rok" (dane z poprzedniego roku), "Średnia 3 lat" (uśrednione), "Ręcznie" (wprowadzasz sam).

---

## 5. Konta

**P: Nie widzę wszystkich kont. Dlaczego?**
O: System pokazuje tylko konta przypisane do Twojej lokalizacji. Jeśli brakuje konkretnego konta, skontaktuj się z Administratorem.

**P: Jak wyszukać konto po nazwie?**
O: W polu wyszukiwania wpisz fragment nazwy (np. "energia") zamiast numeru.

**P: Co oznacza sufiks konta (np. -2-3)?**
O: To identyfikator lokalizacji. Każda placówka ma własny zestaw kont z odpowiednim sufiksem.

**P: Jak sprawdzić obroty na koncie?**
O: Wyszukiwanie kont → Wpisz numer lub nazwę → Wybierz konto → Wybierz okres.

---

## 6. Problemy techniczne

**P: Strona się nie ładuje / jest biała.**
O: Odśwież stronę (F5), wyczyść cache przeglądarki, lub spróbuj w trybie incognito.

**P: Gdzie zgłosić błąd w systemie?**
O: Kliknij ikonę błędu (🐛) w prawym dolnym rogu ekranu.

**P: System jest wolny. Co robić?**
O: Sprawdź połączenie internetowe. Jeśli problem się powtarza, zgłoś błąd z opisem sytuacji.

**P: Zmiany nie zapisują się.**
O: Upewnij się, że klikasz przycisk "Zapisz". Sprawdź czy nie ma komunikatów o błędach na ekranie.

**P: Jak zmienić język systemu?**
O: System jest dostępny tylko w języku polskim.

**P: Czy moje dane są bezpieczne?**
O: Tak, system używa szyfrowania, weryfikacji dwuetapowej i regularnych kopii zapasowych.

---

### Nie znalazłeś odpowiedzi?

Skontaktuj się z Administratorem systemu lub zgłoś problem przez formularz błędów.

---
*Ostatnia aktualizacja: Grudzień 2024*',
'faq',
true,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);

-- ARTICLE 20: Glossary
INSERT INTO public.admin_notes (title, content, category, pinned, visible_to, created_by) VALUES (
'📖 Słownik Pojęć Księgowych i Systemowych',
'## 📖 Słownik Pojęć Księgowych i Systemowych

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
| **Konto księgowe** | Urządzenie ewidencyjne do rejestrowania operacji |
| **Koszty** | Zmniejszenie korzyści ekonomicznych (zużycie zasobów) |
| **Kredyt (Ma)** | Prawa strona konta księgowego; wzrost pasywów lub przychodów |

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
| **RZiS** | Rachunek Zysków i Strat - zestawienie przychodów i kosztów |
| **Saldo** | Różnica między obrotem Wn a Ma |
| **Storno** | Zapis korygujący błędną operację |
| **Winien (Wn)** | Lewa strona konta = debet |
| **Zobowiązanie** | Dług jednostki wobec innych podmiotów |
| **ZOS** | Zestawienie Obrotów i Sald |

---

## 3. Pojęcia systemowe

| Termin | Definicja |
|--------|-----------|
| **2FA** | Weryfikacja dwuetapowa - dodatkowe zabezpieczenie logowania |
| **Bateria realizacji** | Wizualizacja procentowego wykorzystania budżetu |
| **Dashboard** | Panel główny z podsumowaniem najważniejszych informacji |
| **Drag & Drop** | Przeciągnij i upuść - metoda zmiany kolejności |
| **Ekonom** | Rola użytkownika odpowiedzialnego za dokumentację |
| **Eksport** | Zapisanie danych z systemu do pliku (PDF, Excel) |
| **Import** | Wczytanie danych z pliku do systemu |
| **Lokalizacja** | Placówka/dom zakonny w systemie |
| **MT940** | Format pliku wyciągu bankowego (standard SWIFT) |
| **Prowincjał** | Rola użytkownika zatwierdzającego raporty i budżety |
| **Raport miesięczny** | Sprawozdanie finansowe za dany miesiąc |
| **RLS** | Row Level Security - zabezpieczenie dostępu do danych |
| **Status** | Stan dokumentu/raportu (wersja robocza, złożony, zatwierdzony) |
| **Toast** | Powiadomienie wyświetlane na ekranie |
| **Workflow** | Przepływ pracy / proces biznesowy |

---

## 4. Skróty i akronimy

| Skrót | Rozwinięcie |
|-------|-------------|
| **CSV** | Comma-Separated Values (wartości rozdzielone przecinkiem) |
| **NIP** | Numer Identyfikacji Podatkowej |
| **PDF** | Portable Document Format |
| **PLN** | Polski złoty (waluta) |
| **REGON** | Rejestr Gospodarki Narodowej |
| **RZiS** | Rachunek Zysków i Strat |
| **UTF-8** | Unicode Transformation Format (kodowanie znaków) |
| **Wn** | Winien (strona debetowa) |
| **Ma** | (strona kredytowa) |
| **ZOS** | Zestawienie Obrotów i Sald |

---

### Nie znalazłeś terminu?

Jeśli brakuje jakiegoś pojęcia, zgłoś to administratorowi - słownik będzie aktualizowany.

---
*Ostatnia aktualizacja: Grudzień 2024*',
'faq',
false,
ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'],
'fbdffef6-646d-4237-aa54-62ae80792ba4'
);