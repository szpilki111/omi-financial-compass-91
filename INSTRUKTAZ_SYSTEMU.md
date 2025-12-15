# System Finansowy OMI - Pełny Instruktaż

## Spis treści

1. [Wprowadzenie](#1-wprowadzenie)
2. [Role użytkowników](#2-role-użytkowników)
3. [Dashboard - Panel główny](#3-dashboard---panel-główny)
4. [Moduł Dokumenty](#4-moduł-dokumenty)
5. [Moduł Raporty](#5-moduł-raporty)
6. [Moduł Budżet](#6-moduł-budżet)
7. [Wyszukiwanie kont](#7-wyszukiwanie-kont)
8. [Baza Wiedzy](#8-baza-wiedzy)
9. [Administracja](#9-administracja)
10. [Ustawienia](#10-ustawienia)
11. [FAQ - Często zadawane pytania](#11-faq---często-zadawane-pytania)
12. [Słownik pojęć](#12-słownik-pojęć)

---

## 1. Wprowadzenie

### 1.1 O systemie

System Finansowy OMI to kompleksowe narzędzie do zarządzania finansami placówek zakonnych Misjonarzy Oblatów Maryi Niepokalanej. System umożliwia:

- Prowadzenie dokumentacji finansowej
- Generowanie raportów miesięcznych i rocznych
- Planowanie i kontrolę budżetu
- Zarządzanie kontami księgowymi
- Współpracę między placówkami a zarządem prowincji

### 1.2 Wymagania techniczne

- **Przeglądarka**: Chrome, Firefox, Edge, Safari (najnowsze wersje)
- **Połączenie internetowe**: Wymagane stałe połączenie
- **Rozdzielczość ekranu**: Minimum 1280x720 px (zalecane 1920x1080)

### 1.3 Logowanie do systemu

1. Otwórz przeglądarkę i przejdź na adres systemu
2. Wprowadź swój **adres e-mail**
3. Wprowadź **hasło**
4. Kliknij przycisk **"Zaloguj się"**

> ⚠️ **Uwaga**: Po 3 nieudanych próbach logowania konto może zostać tymczasowo zablokowane.

### 1.4 Weryfikacja dwuskładnikowa (2FA)

Przy pierwszym logowaniu z nowego urządzenia:
1. System wyśle kod weryfikacyjny na Twój e-mail
2. Wprowadź otrzymany 6-cyfrowy kod
3. Opcjonalnie zaznacz "Zapamiętaj to urządzenie"

### 1.5 Resetowanie hasła

1. Na stronie logowania kliknij **"Zapomniałem hasła"**
2. Wprowadź swój adres e-mail
3. Sprawdź skrzynkę pocztową i kliknij link resetujący
4. Ustaw nowe hasło (minimum 8 znaków)

---

## 2. Role użytkowników

System rozróżnia 4 główne role z różnymi uprawnieniami:

### 2.1 Ekonom

**Główna rola**: Prowadzenie dokumentacji finansowej placówki

| Uprawnienie | Opis |
|-------------|------|
| ✅ Tworzenie dokumentów | Dodawanie nowych dokumentów księgowych |
| ✅ Edycja dokumentów | Modyfikacja własnych dokumentów |
| ✅ Tworzenie raportów | Generowanie raportów miesięcznych |
| ✅ Składanie raportów | Przesyłanie raportów do zatwierdzenia |
| ✅ Tworzenie budżetu | Planowanie budżetu rocznego |
| ✅ Przeglądanie kont | Dostęp do kont swojej placówki |
| ❌ Zatwierdzanie raportów | Brak uprawnień |
| ❌ Zarządzanie użytkownikami | Brak uprawnień |

### 2.2 Proboszcz

**Główna rola**: Nadzór nad finansami placówki

| Uprawnienie | Opis |
|-------------|------|
| ✅ Przeglądanie dokumentów | Dostęp do dokumentów placówki |
| ✅ Przeglądanie raportów | Wgląd w raporty finansowe |
| ✅ Przeglądanie budżetu | Kontrola realizacji budżetu |
| ❌ Tworzenie dokumentów | Brak uprawnień |
| ❌ Zatwierdzanie raportów | Brak uprawnień |

### 2.3 Prowincjał

**Główna rola**: Zarządzanie finansami całej prowincji

| Uprawnienie | Opis |
|-------------|------|
| ✅ Przeglądanie wszystkich placówek | Dostęp do danych wszystkich lokalizacji |
| ✅ Zatwierdzanie raportów | Akceptacja lub odrzucenie raportów |
| ✅ Zatwierdzanie budżetów | Akceptacja planów budżetowych |
| ✅ Przeglądanie statystyk | Dostęp do zestawień zbiorczych |
| ❌ Edycja dokumentów | Brak uprawnień |

### 2.4 Administrator

**Główna rola**: Zarządzanie systemem i użytkownikami

| Uprawnienie | Opis |
|-------------|------|
| ✅ Wszystkie uprawnienia prowincjała | Pełny dostęp do danych |
| ✅ Zarządzanie użytkownikami | Tworzenie, edycja, blokowanie kont |
| ✅ Zarządzanie placówkami | Dodawanie nowych lokalizacji |
| ✅ Konfiguracja systemu | Ustawienia globalne |
| ✅ Zarządzanie kontami księgowymi | Dodawanie kont do placówek |

---

## 3. Dashboard - Panel główny

Dashboard to pierwsza strona widoczna po zalogowaniu. Prezentuje najważniejsze informacje w formie kart i statystyk.

### 3.1 Elementy Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  LOGO                    [Powiadomienia] [Ustawienia] [Wyloguj]
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dokumenty   │  │   Raporty    │  │   Budżet     │      │
│  │     12       │  │   Złożony    │  │    85%       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              POWIADOMIENIA                          │   │
│  │  • Raport za listopad wymaga zatwierdzenia         │   │
│  │  • Budżet na 2025 został zatwierdzony              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SZYBKI DOSTĘP                          │   │
│  │  [Nowy dokument]  [Nowy raport]  [Wyszukaj konto]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Karty statystyk

- **Dokumenty**: Liczba dokumentów w bieżącym miesiącu
- **Status raportu**: Aktualny status raportu miesięcznego
- **Realizacja budżetu**: Procentowe wykorzystanie budżetu

### 3.3 Powiadomienia

System automatycznie generuje powiadomienia o:
- Zbliżających się terminach raportów
- Zmianach statusu raportów/budżetów
- Nowych odpowiedziach na zgłoszenia błędów
- Przekroczeniach budżetu

### 3.4 Nawigacja

- Kliknij **logo** lub **nazwę systemu** aby wrócić do Dashboard
- Menu boczne zawiera linki do wszystkich modułów
- Ikona dzwonka pokazuje nieprzeczytane powiadomienia

---

## 4. Moduł Dokumenty

Moduł Dokumenty służy do prowadzenia bieżącej dokumentacji finansowej placówki.

### 4.1 Lista dokumentów

Po wejściu w moduł widzisz listę dokumentów z kolumnami:
- **Numer** - automatycznie generowany numer dokumentu
- **Data** - data wystawienia dokumentu
- **Nazwa** - opis dokumentu
- **Status** - kompletny/niekompletny
- **Akcje** - przyciski edycji i usuwania

### 4.2 Tworzenie nowego dokumentu

**Krok po kroku:**

1. Kliknij przycisk **"Nowy dokument"** (prawy górny róg)
2. Wypełnij nagłówek:
   - **Nazwa dokumentu** (np. "Zakup artykułów biurowych")
   - **Data dokumentu** (domyślnie dzisiejsza)
   - **Waluta** (domyślnie PLN)
3. Dodaj operacje księgowe:
   - Kliknij **"Dodaj operację"**
   - Wprowadź **opis** operacji
   - Wprowadź **kwotę Winien** i wybierz **konto Winien**
   - Wprowadź **kwotę Ma** i wybierz **konto Ma**
4. Sprawdź czy suma Winien = suma Ma (bilans)
5. Kliknij **"Zapisz"**

> 💡 **Wskazówka**: Możesz wyszukiwać konta po numerze LUB nazwie w polu wyboru konta.

### 4.3 Struktura operacji księgowej

```
┌────────────────────────────────────────────────────────────────┐
│ [≡] [1] [☐] │ Opis operacji │ Kwota Wn │ Konto Wn │ Kwota Ma │ Konto Ma │ [⚙]
└────────────────────────────────────────────────────────────────┘
  │    │   │
  │    │   └── Checkbox do zaznaczenia
  │    └────── Numer porządkowy (Lp.)
  └─────────── Uchwyt do przeciągania (drag & drop)
```

### 4.4 Zmiana kolejności operacji

Możesz zmieniać kolejność operacji metodą "przeciągnij i upuść":
1. Chwyć ikonę **≡** po lewej stronie operacji
2. Przeciągnij na nową pozycję
3. Upuść - kolejność zostanie automatycznie zapisana

### 4.5 Rozbijanie operacji

Gdy jedna operacja dotyczy wielu kont:

1. Kliknij ikonę **⚙** przy operacji
2. Wybierz **"Rozbij operację"**
3. Wprowadź kwotę do oddzielenia
4. Nowa operacja pojawi się bezpośrednio pod rozbijaną

**Przykład rozbicia:**
- Operacja: 1000 zł na koncie 401 (koszty)
- Rozbicie: 600 zł na 401-01, 400 zł na 401-02

### 4.6 Import danych

System obsługuje import z plików:

**Import CSV:**
1. Kliknij **"Import CSV"**
2. Wybierz plik CSV z operacjami
3. Zmapuj kolumny do pól systemu
4. Potwierdź import

**Import MT940 (wyciągi bankowe):**
1. Kliknij **"Import MT940"**
2. Wybierz plik MT940 z banku
3. System automatycznie rozpozna operacje
4. Przypisz konta księgowe do operacji
5. Potwierdź import

> ⚠️ **Uwaga**: System automatycznie konwertuje kodowanie plików (UTF-8, Windows-1250, ISO-8859-2).

### 4.7 Walidacja dokumentu

System sprawdza poprawność dokumentu:
- ✅ Bilans (suma Winien = suma Ma)
- ✅ Wypełnienie wszystkich wymaganych pól
- ✅ Poprawność numerów kont

Dokumenty z błędami są oznaczone jako **"Niekompletne"** i blokują tworzenie raportów.

### 4.8 Usuwanie dokumentu

1. Znajdź dokument na liście
2. Kliknij ikonę **🗑** (kosz)
3. Potwierdź usunięcie w oknie dialogowym

> ⚠️ **Uwaga**: Usunięte dokumenty nie mogą być przywrócone!

---

## 5. Moduł Raporty

Moduł Raporty służy do generowania i składania miesięcznych sprawozdań finansowych.

### 5.1 Workflow raportów

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Szkic   │ ──> │ Złożony  │ ──> │Zatwierdzony│   │ Odrzucony │
│ (draft)  │     │(submitted)│    │ (approved) │   │(rejected) │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                                  │
     └── Ekonom ──────┘                                  │
                      └──── Prowincjał/Admin ────────────┘
```

### 5.2 Tworzenie raportu

**Krok po kroku:**

1. Przejdź do modułu **Raporty**
2. Kliknij **"Nowy raport"**
3. Wybierz:
   - **Rok** i **Miesiąc**
   - **Placówkę** (jeśli masz dostęp do wielu)
   - **Typ raportu** (standardowy, ZOS, bilans itp.)
4. System automatycznie pobierze dane z dokumentów
5. Sprawdź podsumowanie (przychody, rozchody, bilans)
6. Kliknij **"Zapisz jako szkic"** lub **"Złóż do zatwierdzenia"**

### 5.3 Blokada przy niekompletnych dokumentach

System nie pozwoli utworzyć raportu jeśli:
- Istnieją dokumenty z błędami walidacji
- Brakuje wymaganych pól w operacjach

**Rozwiązanie:**
1. System wyświetli listę niekompletnych dokumentów
2. Kliknij na dokument aby go edytować
3. Uzupełnij brakujące dane
4. Wróć do tworzenia raportu

### 5.4 Składanie raportu

1. Otwórz raport w statusie **"Szkic"**
2. Kliknij **"Złóż do zatwierdzenia"**
3. Opcjonalnie dodaj komentarz dla prowincjała
4. Potwierdź złożenie

Po złożeniu:
- Raport zmienia status na **"Złożony"**
- Prowincjał otrzymuje powiadomienie e-mail
- Ekonom nie może już edytować raportu

### 5.5 Zatwierdzanie raportów (Prowincjał/Admin)

1. Przejdź do modułu **Raporty**
2. Użyj filtrów aby znaleźć raporty do zatwierdzenia
3. Kliknij na raport aby zobaczyć szczegóły
4. Sprawdź dane finansowe i komentarze
5. Kliknij **"Zatwierdź"** lub **"Odrzuć"**
6. Przy odrzuceniu podaj powód

### 5.6 Eksport raportów

**Eksport do PDF:**
1. Otwórz szczegóły raportu
2. Kliknij **"Eksportuj do PDF"**
3. Plik zostanie pobrany automatycznie

**Eksport do Excel:**
1. Otwórz szczegóły raportu
2. Kliknij **"Eksportuj do Excel"**
3. Plik XLSX zostanie pobrany

### 5.7 Typy raportów

| Typ | Opis |
|-----|------|
| Standardowy | Podstawowy raport miesięczny |
| ZOS | Zestawienie obrotów i sald |
| Bilans | Bilans aktywów i pasywów |
| RZiS | Rachunek zysków i strat |
| Analiza | Analiza porównawcza |

---

## 6. Moduł Budżet

Moduł Budżet służy do planowania i kontroli finansów placówki.

### 6.1 Workflow budżetu

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Szkic   │ ──> │ Złożony  │ ──> │Zatwierdzony│   │ Odrzucony │
│ (draft)  │     │(submitted)│    │ (approved) │   │(rejected) │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

### 6.2 Tworzenie budżetu

**Krok po kroku:**

1. Przejdź do modułu **Budżet**
2. Kliknij **"Nowy budżet"**
3. Wybierz:
   - **Rok** budżetowy
   - **Placówkę**
   - **Metodę prognozowania**:
     - *Ostatni rok* - kopiuje wartości z poprzedniego roku
     - *Średnia 3 lat* - oblicza średnią z 3 lat
     - *Ręcznie* - puste pola do wypełnienia
4. System wygeneruje tabelę pozycji budżetowych
5. Wprowadź planowane kwoty dla każdego konta
6. Opcjonalnie dodaj:
   - **Prognozowane inne wydatki** z opisem
   - **Planowana redukcja kosztów** z opisem
7. Dodaj komentarze i załączniki
8. Kliknij **"Zapisz"**

### 6.3 Tabela pozycji budżetowych

```
┌─────────────────────────────────────────────────────────────────┐
│           PRZYCHODY (7xx)        │       ROZCHODY (4xx)         │
├─────────────────────────────────────────────────────────────────┤
│ Konto   │ Nazwa     │ Plan 2025 │ Konto   │ Nazwa    │ Plan 2025│
├─────────────────────────────────────────────────────────────────┤
│ 701     │ Ofiary    │ 50,000    │ 401     │ Żywność  │ 30,000   │
│ 702     │ Darowizny │ 20,000    │ 402     │ Media    │ 15,000   │
│ ...     │ ...       │ ...       │ ...     │ ...      │ ...      │
├─────────────────────────────────────────────────────────────────┤
│ SUMA PRZYCHODÓW: 70,000         │ SUMA ROZCHODÓW: 45,000        │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 Bateria realizacji budżetu

Po zatwierdzeniu budżetu, system pokazuje realizację miesięczną w formie "baterii":

```
     Sty  Lut  Mar  Kwi  Maj  Cze  Lip  Sie  Wrz  Paź  Lis  Gru
     ─────────────────────────────────────────────────────────
Przychody: [███] [███] [░░░] [   ] [   ] [   ] [   ] [   ] [   ] [   ] [   ] [   ]
            95%   87%   45%
            
Rozchody:  [███] [███] [███] [   ] [   ] [   ] [   ] [   ] [   ] [   ] [   ] [   ]
            78%   92%  105%
```

**Kolory baterii:**
- 🟢 **Zielony** (60-80%): Realizacja w normie
- 🟡 **Pomarańczowy** (81-99%): Zbliżenie do limitu
- 🔴 **Czerwony** (>100%): Przekroczenie budżetu
- ⬜ **Szary** (<50%): Niska realizacja

### 6.5 Składanie budżetu do zatwierdzenia

1. Otwórz budżet w statusie **"Szkic"**
2. Sprawdź wszystkie pozycje
3. Kliknij **"Złóż do zatwierdzenia"**
4. Prowincjał otrzyma powiadomienie e-mail

### 6.6 Zatwierdzanie budżetu (Prowincjał/Admin)

1. Przejdź do listy budżetów
2. Użyj filtrów: rok, placówka, status
3. Kliknij na budżet do zatwierdzenia
4. Przejrzyj pozycje i komentarze
5. Kliknij **"Zatwierdź"** lub **"Odrzuć"**

### 6.7 Kopiowanie budżetu z poprzedniego roku

1. Przy tworzeniu nowego budżetu wybierz metodę **"Ostatni rok"**
2. System skopiuje wszystkie pozycje z poprzedniego roku
3. Zmodyfikuj kwoty według potrzeb

### 6.8 Porównanie wieloletnie

1. Otwórz zatwierdzony budżet
2. Kliknij **"Porównanie wieloletnie"**
3. Wybierz lata do porównania
4. System wyświetli tabelę porównawczą
5. Kliknij **"Eksportuj do Excel"** aby pobrać

### 6.9 Raport odchyleń

1. Otwórz zatwierdzony budżet
2. Kliknij **"Raport odchyleń"**
3. System pokaże różnice między planem a realizacją
4. Eksportuj do CSV lub PDF

### 6.10 Powiadomienia budżetowe

System automatycznie wysyła powiadomienia:
- 📧 Do prowincjała gdy ekonom złoży budżet
- 📧 Do ekonoma gdy budżet zostanie zatwierdzony/odrzucony
- 🚨 Alert gdy realizacja przekroczy 100% budżetu

---

## 7. Wyszukiwanie kont

Moduł umożliwia przegląd obrotów i transakcji na kontach księgowych.

### 7.1 Wyszukiwanie konta

1. Przejdź do **"Wyszukiwanie kont"**
2. Wprowadź **numer konta** lub **nazwę** w polu wyszukiwania
3. Wybierz konto z listy podpowiedzi
4. System wyświetli obroty miesięczne

> 💡 **Wskazówka**: Widzisz tylko konta przypisane do Twojej placówki.

### 7.2 Obroty miesięczne

```
┌─────────────────────────────────────────────────────────────┐
│ Konto: 401-2-3 - Koszty żywności                            │
├──────────┬──────────────┬──────────────┬──────────────────┤
│ Miesiąc  │ Obrót Winien │ Obrót Ma     │ Saldo            │
├──────────┼──────────────┼──────────────┼──────────────────┤
│ Styczeń  │   5,000.00   │     500.00   │   4,500.00 Wn    │
│ Luty     │   4,500.00   │     200.00   │   4,300.00 Wn    │
│ ...      │     ...      │     ...      │      ...         │
└──────────┴──────────────┴──────────────┴──────────────────┘
```

### 7.3 Lista transakcji

Kliknij na miesiąc aby zobaczyć szczegółowe transakcje:

```
┌────────┬────────────────────┬──────────┬──────────┬─────────────┐
│ Data   │ Opis               │ Winien   │ Ma       │ Nr dokumentu│
├────────┼────────────────────┼──────────┼──────────┼─────────────┤
│ 05.01  │ Zakup żywności     │ 1,500.00 │    -     │ DOC/2025/01 │
│ 12.01  │ Zwrot nadpłaty     │    -     │  200.00  │ DOC/2025/02 │
└────────┴────────────────────┴──────────┴──────────┴─────────────┘
```

### 7.4 Eksport danych

1. Wybierz zakres dat
2. Kliknij **"Eksportuj"**
3. Wybierz format (CSV lub Excel)

---

## 8. Baza Wiedzy

Centralne repozytorium dokumentów i instrukcji dla użytkowników systemu.

### 8.1 Zakładka Dokumenty

**Przeglądanie:**
1. Przejdź do **"Baza wiedzy"**
2. Domyślnie otwarta jest zakładka **"Dokumenty"**
3. Użyj wyszukiwarki lub filtrów kategorii
4. Kliknij na dokument aby pobrać

**Kategorie dokumentów:**
- 📋 **Procedury** - instrukcje i regulaminy
- 📝 **Szablony** - wzory dokumentów
- 📚 **Poradniki** - materiały szkoleniowe
- 📁 **Inne** - pozostałe dokumenty

**Dodawanie dokumentu (Admin/Prowincjał):**
1. Kliknij **"Dodaj dokument"**
2. Wybierz plik (PDF, DOC, DOCX, XLS, XLSX, TXT)
3. Wprowadź tytuł i opis
4. Wybierz kategorię
5. Kliknij **"Prześlij"**

### 8.2 Zakładka Notatki

Notatki administracyjne widoczne dla wybranych użytkowników.

**Przeglądanie:**
1. Przejdź do zakładki **"Notatki"**
2. Notatki przypięte są na górze listy
3. Kliknij na notatkę aby rozwinąć treść

**Tworzenie notatki (Admin/Prowincjał):**
1. Kliknij **"Nowa notatka"**
2. Wprowadź tytuł i treść
3. Wybierz widoczność:
   - *Wszystkie placówki*
   - *Konkretna placówka*
4. Opcjonalnie **"Przypnij"** aby notatka była zawsze na górze
5. Kliknij **"Zapisz"**

---

## 9. Administracja

Moduł dostępny tylko dla Administratorów i Prowincjałów.

### 9.1 Zarządzanie użytkownikami

**Lista użytkowników:**
- Przeglądanie wszystkich kont w systemie
- Filtrowanie po placówce i roli
- Wyszukiwanie po nazwisku/e-mail

**Tworzenie użytkownika:**
1. Kliknij **"Nowy użytkownik"**
2. Wypełnij dane:
   - Imię i nazwisko
   - Adres e-mail
   - Rola (ekonom, proboszcz, prowincjał, admin)
   - Placówka/placówki
3. Kliknij **"Utwórz"**
4. Użytkownik otrzyma e-mail z hasłem tymczasowym

**Blokowanie użytkownika:**
1. Znajdź użytkownika na liście
2. Kliknij **"Zablokuj"**
3. Zablokowany użytkownik nie może się zalogować

### 9.2 Zarządzanie placówkami

**Dodawanie placówki:**
1. Przejdź do zakładki **"Placówki"**
2. Kliknij **"Nowa placówka"**
3. Wypełnij dane:
   - Nazwa
   - Adres
   - NIP, REGON
   - Identyfikator (np. "2-3")
4. Kliknij **"Zapisz"**

**Ustawienia placówki:**
- Skrót nazwy (do numeracji dokumentów)
- Dozwolone waluty obce

### 9.3 Zarządzanie kontami księgowymi

**Przypisywanie kont do placówki:**
1. Przejdź do zakładki **"Konta placówek"**
2. Wybierz placówkę
3. Zaznacz konta do przypisania
4. Kliknij **"Zapisz"**

### 9.4 Przypomnienia

**Konfiguracja przypomnień:**
- System automatycznie wysyła przypomnienia o terminach raportów
- 5 dni przed terminem
- 1 dzień przed terminem
- Po terminie (raport zaległy)

**Ręczne wysłanie przypomnień:**
1. Przejdź do zakładki **"Przypomnienia"**
2. Kliknij **"Wyślij przypomnienia"** dla konkretnej placówki
3. Lub **"Wyślij wszystkie"** dla wszystkich placówek

### 9.5 Zgłoszenia błędów

Przeglądanie i obsługa zgłoszeń błędów od użytkowników:

1. Przejdź do zakładki **"Zgłoszenia błędów"**
2. Filtruj po statusie (Nowe, W trakcie, Rozwiązane)
3. Kliknij na zgłoszenie aby zobaczyć szczegóły
4. Dodaj odpowiedź lub zmień status
5. Użytkownik otrzyma powiadomienie e-mail

### 9.6 Historia logowań

Przeglądanie logów bezpieczeństwa:
- Data i godzina logowania
- Adres e-mail
- Adres IP
- Status (sukces/błąd)

---

## 10. Ustawienia

### 10.1 Profil użytkownika

1. Kliknij ikonę użytkownika (prawy górny róg)
2. Wybierz **"Ustawienia"**
3. Możesz zmienić:
   - Imię i nazwisko
   - Numer telefonu
   - Hasło

### 10.2 Zaufane urządzenia

Przeglądaj i zarządzaj urządzeniami z zapisaną sesją:
1. Przejdź do zakładki **"Zaufane urządzenia"**
2. Zobacz listę urządzeń
3. Kliknij **"Usuń"** aby wylogować urządzenie

### 10.3 Konta księgowe (dla lokalizacji)

Ekonomowie mogą przeglądać konta przypisane do swojej placówki:
1. Przejdź do zakładki **"Konta"**
2. Wyszukuj konta po numerze lub nazwie
3. Lista pokazuje tylko konta Twojej placówki

---

## 11. FAQ - Często zadawane pytania

### Dokumenty

**P: Nie mogę zapisać dokumentu - co robić?**
O: Sprawdź czy:
- Suma "Winien" równa się sumie "Ma"
- Wszystkie pola są wypełnione
- Wybrane konta istnieją dla Twojej placówki

**P: Jak zmienić kolejność operacji?**
O: Użyj ikony ≡ po lewej stronie i przeciągnij operację na nową pozycję.

**P: Import CSV pokazuje błędne polskie znaki?**
O: System automatycznie konwertuje kodowanie. Jeśli problem występuje, zapisz plik w kodowaniu UTF-8.

### Raporty

**P: Nie mogę utworzyć raportu - system mówi o niekompletnych dokumentach**
O: Musisz najpierw uzupełnić brakujące pola we wszystkich dokumentach z danego miesiąca. System wyświetli listę dokumentów do poprawy.

**P: Jak cofnąć złożony raport?**
O: Złożonego raportu nie można cofnąć. Skontaktuj się z prowincjałem, który może odrzucić raport z odpowiednim komentarzem.

**P: Kiedy jest termin składania raportu?**
O: Standardowo do 10. dnia następnego miesiąca. System wyśle przypomnienie 5 dni przed terminem.

### Budżet

**P: Jak skopiować budżet z poprzedniego roku?**
O: Przy tworzeniu nowego budżetu wybierz metodę prognozowania "Ostatni rok".

**P: Co oznaczają kolory w baterii realizacji?**
O: 
- Zielony: 60-80% realizacji (norma)
- Pomarańczowy: 81-99% (uwaga)
- Czerwony: >100% (przekroczenie)
- Szary: <50% (niska realizacja)

**P: Prowincjał odrzucił mój budżet - co teraz?**
O: Budżet wraca do statusu "Szkic". Sprawdź komentarz z powodem odrzucenia, wprowadź poprawki i złóż ponownie.

### Konta

**P: Nie widzę wszystkich kont w wyszukiwarce**
O: System pokazuje tylko konta przypisane do Twojej placówki. Skontaktuj się z administratorem aby dodać brakujące konta.

**P: Jak wyszukać konto po nazwie?**
O: W polu wyszukiwania możesz wpisać zarówno numer konta jak i fragment nazwy.

### Techniczne

**P: Zapomniałem hasła**
O: Na stronie logowania kliknij "Zapomniałem hasła" i postępuj zgodnie z instrukcjami.

**P: System wylogował mnie automatycznie**
O: Sesja wygasa po dłuższym okresie nieaktywności. Zaloguj się ponownie.

**P: Widzę błąd "Brak uprawnień"**
O: Twoja rola nie pozwala na wykonanie tej akcji. Skontaktuj się z administratorem.

---

## 12. Słownik pojęć

### Pojęcia księgowe

| Termin | Definicja |
|--------|-----------|
| **Winien (Wn)** | Lewa strona konta księgowego. Zwiększenie aktywów lub kosztów, zmniejszenie pasywów lub przychodów. |
| **Ma** | Prawa strona konta księgowego. Zwiększenie pasywów lub przychodów, zmniejszenie aktywów lub kosztów. |
| **Bilans** | Zestawienie aktywów i pasywów na określony dzień. Suma aktywów musi równać się sumie pasywów. |
| **Saldo** | Różnica między sumą zapisów po stronie Winien i Ma na koncie. |
| **Obrót** | Suma wszystkich zapisów po jednej stronie konta w danym okresie. |
| **Konto syntetyczne** | Konto główne (np. 401 - Koszty żywności). |
| **Konto analityczne** | Konto szczegółowe, podrzędne do syntetycznego (np. 401-01 - Żywność dla wspólnoty). |
| **Przychody** | Wpływy finansowe - konta grupy 7xx i niektóre 2xx po stronie Ma. |
| **Rozchody/Koszty** | Wydatki - konta grupy 4xx i niektóre 2xx po stronie Winien. |
| **ZOS** | Zestawienie Obrotów i Sald - raport pokazujący obroty i salda wszystkich kont. |
| **RZiS** | Rachunek Zysków i Strat - raport pokazujący wynik finansowy. |

### Pojęcia systemowe

| Termin | Definicja |
|--------|-----------|
| **Placówka/Lokalizacja** | Jednostka organizacyjna (np. dom zakonny) prowadząca własną księgowość. |
| **Prowincja** | Nadrzędna jednostka grupująca placówki. |
| **Ekonom** | Osoba odpowiedzialna za prowadzenie ksiąg w placówce. |
| **Prowincjał** | Przełożony prowincji, zatwierdzający raporty i budżety. |
| **Szkic (draft)** | Dokument/raport/budżet w trakcie przygotowania, można go edytować. |
| **Złożony (submitted)** | Dokument przekazany do zatwierdzenia, nie można go edytować. |
| **Zatwierdzony (approved)** | Dokument zaakceptowany przez prowincjała. |
| **Odrzucony (rejected)** | Dokument zwrócony do poprawy z komentarzem. |

### Skróty

| Skrót | Znaczenie |
|-------|-----------|
| **PLN** | Polski złoty (waluta) |
| **EUR** | Euro (waluta) |
| **USD** | Dolar amerykański (waluta) |
| **CSV** | Comma-Separated Values - format pliku tekstowego |
| **MT940** | Format wyciągów bankowych SWIFT |
| **PDF** | Portable Document Format |
| **2FA** | Dwuskładnikowa weryfikacja (Two-Factor Authentication) |

---

## Załączniki

### A. Struktura numeracji kont

```
XXX-Y-Z
 │   │ │
 │   │ └── Numer lokalizacji (np. 3 dla Gorzowa)
 │   └──── Kategoria prowincji (np. 2)
 └──────── Numer konta syntetycznego (np. 401)

Przykład: 401-2-3 = Koszty żywności, Prowincja 2, Lokalizacja Gorzów
```

### B. Grupy kont

| Grupa | Nazwa | Przykłady |
|-------|-------|-----------|
| 0xx | Aktywa trwałe | 010 Budynki, 020 Maszyny |
| 1xx | Środki pieniężne | 100 Kasa, 130 Bank |
| 2xx | Rozrachunki | 200 Odbiorcy, 210 Dostawcy |
| 3xx | Materiały | 310 Materiały biurowe |
| 4xx | Koszty | 401 Żywność, 402 Media |
| 5xx | Koszty rozliczane | 500 Koszty produkcji |
| 6xx | Produkty | 600 Wyroby gotowe |
| 7xx | Przychody | 701 Ofiary, 702 Darowizny |
| 8xx | Wynik finansowy | 800 Wynik |

### C. Terminy raportów

| Raport | Termin składania |
|--------|------------------|
| Miesięczny | Do 10. dnia następnego miesiąca |
| Roczny | Do 31 stycznia następnego roku |
| Budżet | Do 30 listopada roku poprzedzającego |

### D. Kontakt z pomocą techniczną

W przypadku problemów technicznych:
1. Użyj przycisku **"Zgłoś błąd"** w prawym dolnym rogu ekranu
2. Opisz problem i załącz screenshot
3. Administrator odpowie na zgłoszenie (otrzymasz powiadomienie e-mail)

---

*Wersja dokumentu: 1.0*
*Data aktualizacji: Grudzień 2024*
*System Finansowy OMI © 2024*
