# Plan Prezentacji Modułu "Planowanie Budżetowe"

## Przygotowanie środowiska demonstracyjnego

### Krok 0: Uruchomienie funkcji generującej dane testowe
1. Przejdź do Supabase Dashboard → Functions
2. Uruchom funkcję `setup-demo-data`
3. Zweryfikuj, że dane zostały utworzone (sprawdź tabele: `budget_plans`, `budget_items`, `transactions`)

### Dane testowe wygenerowane przez system:
- **4 lata budżetowe** (2023-2027):
  - 2023: Zatwierdzony budżet z pełną realizacją (100%)
  - 2024: Zatwierdzony budżet z pełną realizacją (100%)
  - 2025: Zatwierdzony budżet z częściową realizacją (do listopada)
  - 2026: Budżet w statusie "draft" (do edycji)
  - 2027: Budżet w statusie "submitted" (czeka na zatwierdzenie)
  
- **Różne poziomy realizacji budżetu w 2025**:
  - Q1 (Styczeń-Marzec): ~65% realizacji → Zielony status
  - Q2 (Kwiecień-Czerwiec): ~82% realizacji → Pomarańczowy status
  - Q3 (Lipiec-Wrzesień): ~105% realizacji → Czerwony status (przekroczenie!)
  - Q4 (Październik-Listopad): ~45% realizacji → Szary status
  
- **Różnorodne typy budżetów**:
  - Z modyfikatorami (dodatkowe wydatki, planowane redukcje)
  - Z komentarzami i opisami
  - Z różnymi metodami prognozowania (ostatni rok, średnia z 3 lat)

---

## Część 1: Wprowadzenie do modułu (5 minut)

### 1.1 Dostęp do modułu
**Cel:** Pokazać, jak użytkownicy znajdą funkcjonalność budżetu

**Kroki:**
1. Zaloguj się jako **ekonom** (np. `ekonom.bodzanow@omi.pl`, hasło: `password123`)
2. W górnym menu znajdź i kliknij kafelek **"Budżet"**
3. Zwróć uwagę na:
   - Intuicyjną ikonę (kalkulator lub wykres)
   - Widoczność dla różnych ról (ekonom, admin, prowincjał)

**Punkty do podkreślenia:**
- Moduł jest dostępny dla trzech ról: ekonom (własna lokalizacja), prowincjał (wszystkie lokalizacje), admin (wszystkie lokalizacje)
- Prosty dostęp z głównego menu

---

### 1.2 Dashboard - Status budżetu
**Cel:** Pokazać monitoring realizacji budżetu na stronie głównej

**Kroki:**
1. Wróć do strony głównej (Dashboard)
2. Znajdź kartę **"Status budżetu"** wśród innych kafelków
3. Przeanalizuj informacje:
   - Aktualny miesiąc i rok
   - Procent realizacji budżetu tego miesiąca
   - Kolor statusu (zielony/pomarańczowy/czerwony/szary)
   - Link "Zobacz szczegóły"

**Punkty do podkreślenia:**
- Ekonom widzi status budżetu od razu po zalogowaniu
- Kolory wizualnie komunikują stan realizacji:
  - 🟢 Zielony (0-80%): realizacja w normie
  - 🟠 Pomarańczowy (81-100%): zbliżamy się do limitu
  - 🔴 Czerwony (>100%): budżet przekroczony!
  - ⚫ Szary (<50%): niska realizacja

---

## Część 2: Lista budżetów (5 minut)

### 2.1 Przeglądanie istniejących budżetów
**Cel:** Pokazać, jak użytkownik widzi wszystkie budżety

**Kroki:**
1. W module "Budżet" zobaczysz listę budżetów (2023-2027)
2. Dla każdego budżetu widoczne są:
   - Rok budżetu
   - Lokalizacja
   - Status (draft / submitted / approved / rejected)
   - Data utworzenia
   - Data złożenia (jeśli applicable)
   - Data zatwierdzenia (jeśli applicable)
3. Przyciski akcji:
   - **"Zobacz"** - dla wszystkich budżetów
   - **"Edytuj"** - tylko dla budżetów w statusie "draft"
   - **"Usuń"** - tylko dla budżetów "draft" (ekonom) lub wszystkich (admin/prowincjał)

**Punkty do podkreślenia:**
- Budżety w statusie "approved" są **read-only** - nie można ich edytować
- Kolorowe oznaczenia statusów (badges) ułatwiają identyfikację
- Możliwość szybkiego przejrzenia historii budżetów

---

### 2.2 Statusy budżetów - Workflow
**Cel:** Wyjaśnić cykl życia budżetu

**Diagram workflow:**
```
DRAFT → SUBMITTED → APPROVED
          ↓
       REJECTED → (poprawki) → SUBMITTED
```

**Kroki:**
1. Pokaż budżet ze statusem **"draft"** (2026)
   - Ekonom może edytować wszystkie pola
   - Przycisk "Złóż do zatwierdzenia"

2. Pokaż budżet ze statusem **"submitted"** (2027)
   - Ekonom nie może już edytować
   - Prowincjał/Admin widzi przyciski: "Zatwierdź" / "Odrzuć"

3. Pokaż budżet ze statusem **"approved"** (2023, 2024, 2025)
   - Budżet jest read-only
   - Widoczna wizualizacja realizacji

**Punkty do podkreślenia:**
- Ekonom przygotowuje budżet → status "draft"
- Ekonom składa do zatwierdzenia → status "submitted"
- Prowincjał/Admin zatwierdza → status "approved"
- Prowincjał/Admin może odrzucić z komentarzem → status "rejected"

---

## Część 3: Tworzenie nowego budżetu (10 minut)

### 3.1 Formularz tworzenia budżetu
**Cel:** Pokazać proces tworzenia budżetu od zera

**Kroki:**
1. Kliknij przycisk **"Nowy budżet"**
2. Wypełnij sekcję **"Podstawowe informacje"**:
   - Rok budżetu: 2028
   - Lokalizacja: (auto-wybrana dla ekonoma)
   - Metoda prognozowania:
     - **"Ostatni rok"** - prognoza na podstawie 2027
     - **"Średnia z 3 lat"** - prognoza na podstawie 2025-2027
     - **"Ręcznie"** - puste pola do wypełnienia

**Punkty do podkreślenia:**
- Prostota interfejsu - tylko niezbędne pola
- Automatyczne prognozowanie na podstawie historii
- Elastyczność (można wybrać metodę prognozowania)

---

### 3.2 Modyfikatory budżetu
**Cel:** Pokazać, jak dostosować prognozę

**Kroki:**
1. W sekcji **"Modyfikatory budżetu"** (opcjonalne) wypełnij:
   - **Prognozowane inne wydatki**: +20 000 zł
     - Opis: "Planowana wymiana systemu grzewczego"
   - **Planowana redukcja kosztów**: -7 000 zł
     - Opis: "Przejście na energooszczędne oświetlenie LED"

2. Kliknij **"Generuj prognozę"**

**Punkty do podkreślenia:**
- Modyfikatory pozwalają uwzględnić nadzwyczajne wydarzenia
- System automatycznie rozłoży dodatkowe koszty proporcjonalnie na wszystkie konta rozchodowe
- Pola opisowe pomagają uzasadnić modyfikatory dla prowincjała

---

### 3.3 Edycja pozycji budżetowych
**Cel:** Pokazać tabelę pozycji budżetowych i możliwość edycji

**Kroki:**
1. Po wygenerowaniu prognozy, przewiń do sekcji **"Pozycje budżetowe"**
2. Zobaczysz **dwukolumnową tabelę**:
   - Lewa kolumna: **PRZYCHODY (7xx)**
   - Prawa kolumna: **ROZCHODY (4xx)**
3. Dla każdego konta widoczne są:
   - Nazwa konta (np. "701-2-2 Intencje odprawione")
   - **Prognoza** (auto-wyliczona, nieaktywna)
   - **Budżet** (edytowalne pole - domyślnie = prognoza)
   - **Realizacja z poprzedniego roku** (dla porównania)

4. Edytuj kilka pozycji:
   - Zwiększ budżet dla "701-2-2 Intencje odprawione" o 10 000 zł
   - Zmniejsz budżet dla "412-2-2 Utrzymanie samochodu" o 5 000 zł

5. Na dole tabeli widoczne są **SUMY**:
   - Suma przychodów
   - Suma rozchodów
   - **Bilans** (przychody - rozchody)

**Punkty do podkreślenia:**
- Prognoza jest punktem wyjścia, ale ekonom może ją swobodnie edytować
- Realizacja z poprzedniego roku pomaga w ocenie realności prognozy
- Bilans na dole pokazuje, czy budżet jest zrównoważony

---

### 3.4 Notatki i załączniki
**Cel:** Pokazać możliwość dokumentowania budżetu

**Kroki:**
1. Przewiń do sekcji **"Notatki"**
2. Wpisz komentarz:
   ```
   Budżet uwzględnia planowaną wymianę systemu grzewczego. 
   Oferty od wykonawców dołączone w załącznikach.
   ```

3. W sekcji **"Załączniki"** kliknij **"Dodaj załącznik"**
4. Prześlij plik (np. fakturę proforma, ofertę, kalkulację)
5. Załączniki są widoczne jako lista z możliwością pobrania

**Punkty do podkreślenia:**
- Ekonom może uzasadnić założenia budżetu
- Załączniki pomagają prowincjałowi w ocenie budżetu
- Pliki są bezpiecznie przechowywane w Supabase Storage

---

### 3.5 Zapisywanie i składanie budżetu
**Cel:** Pokazać opcje zapisu

**Kroki:**
1. Kliknij **"Zapisz jako draft"**
   - Budżet zostanie zapisany ze statusem "draft"
   - Ekonom może wrócić do edycji w dowolnym momencie

2. Alternatywnie, kliknij **"Złóż do zatwierdzenia"**
   - Budżet zostanie zapisany ze statusem "submitted"
   - Prowincjał/Admin otrzyma powiadomienie email
   - Ekonom nie będzie mógł już edytować budżetu

**Punkty do podkreślenia:**
- Elastyczność - można zapisać i wrócić później
- Po złożeniu budżet jest "zamrożony" do czasu decyzji prowincjała

---

## Część 4: Kopiowanie budżetu z poprzedniego roku (3 minuty)

### 4.1 Szybkie tworzenie budżetu na podstawie poprzedniego roku
**Cel:** Pokazać funkcję oszczędzającą czas

**Kroki:**
1. Kliknij **"Nowy budżet"**
2. Wybierz rok: 2029
3. Kliknij przycisk **"Skopiuj z 2028"**
4. System automatycznie:
   - Przenosi wszystkie pozycje budżetowe
   - Kopiuje kwoty z 2028
   - Wypełnia pola modyfikatorów (jeśli były)

5. Ekonom może teraz:
   - Dostosować kwoty
   - Zmienić modyfikatory
   - Zapisać jako nowy budżet

**Punkty do podkreślenia:**
- Znaczna oszczędność czasu przy tworzeniu budżetów rok do roku
- Budżet z poprzedniego roku jako solidny punkt wyjścia
- Możliwość dostosowania do nowych okoliczności

---

## Część 5: Wizualizacja realizacji budżetu (10 minut)

### 5.1 Widok szczegółów zatwierdzonego budżetu (2025)
**Cel:** Pokazać monitoring realizacji w czasie rzeczywistym

**Kroki:**
1. Wróć do listy budżetów
2. Wybierz budżet **2025** (zatwierdzony)
3. Kliknij **"Zobacz"**

**Sekcje widoku:**
- **Nagłówek**: Rok, lokalizacja, status, daty
- **Informacje ogólne**: Metoda prognozowania, modyfikatory, komentarze
- **Załączniki**: Lista załączników do pobrania
- **Miesięczna realizacja**: "Bateria" dla każdego miesiąca
- **Tabela pozycji budżetowych**: Szczegółowe dane per konto

---

### 5.2 Miesięczna "bateria" realizacji
**Cel:** Pokazać wizualizację postępu

**Kroki:**
1. Przewiń do sekcji **"Realizacja budżetu"**
2. Zobaczysz 12 pasków (jeden dla każdego miesiąca)
3. Przeanalizuj kilka przykładów:

**STYCZEŃ 2025** (zielony):
```
████████████████░░░░░░░░ 65%
Plan: 68 542 zł | Realizacja: 44 552 zł | Pozostało: 23 990 zł
```

**MAJ 2025** (pomarańczowy):
```
████████████████████░░░░ 82%
Plan: 68 542 zł | Realizacja: 56 204 zł | Pozostało: 12 338 zł
```

**SIERPIEŃ 2025** (czerwony):
```
█████████████████████░░░ 105%
Plan: 68 542 zł | Realizacja: 71 969 zł | Przekroczenie: 3 427 zł
```

**PAŹDZIERNIK 2025** (szary):
```
██████░░░░░░░░░░░░░░░░░░ 45%
Plan: 68 542 zł | Realizacja: 30 844 zł | Pozostało: 37 698 zł
```

**Punkty do podkreślenia:**
- 🟢 **Zielony (0-80%)**: Realizacja w normie - doskonały wynik
- 🟠 **Pomarańczowy (81-100%)**: Zbliżamy się do limitu - trzeba uważać
- 🔴 **Czerwony (>100%)**: Budżet przekroczony! - wymaga działań
- ⚫ **Szary (<50%)**: Niska realizacja - może być problem z planowaniem lub realizacją

---

### 5.3 Szczegółowy widok per konto
**Cel:** Pokazać analizę na poziomie poszczególnych kont

**Kroki:**
1. Przewiń do sekcji **"Szczegóły pozycji budżetowych"**
2. Zobaczysz tabelę z kolumnami:
   - **Konto** (nazwa)
   - **Budżet roczny** (zaplanowana kwota)
   - **Budżet miesięczny** (roczny / 12)
   - **Realizacja do dnia dzisiejszego**
   - **% realizacji**
   - **Odchylenie** (+/- od planu)

**Przykładowe dane:**
```
┌──────────────────────────────────────────────────────────────────┐
│ Konto                    │ Roczny  │ Miesięczny │ Realizacja │ %  │
├──────────────────────────────────────────────────────────────────┤
│ 701-2-2 Intencje         │ 150 000 │ 12 500     │ 165 415    │110%│ (czerwony)
│ 412-2-2 Samochody        │  28 000 │  2 333     │  15 400    │ 66%│ (zielony)
│ 444-2-2 Media            │  38 500 │  3 208     │  42 150    │110%│ (czerwony)
└──────────────────────────────────────────────────────────────────┘
```

**Punkty do podkreślenia:**
- Możliwość identyfikacji kont, które przekraczają budżet
- Identyfikacja kont z niską realizacją (potencjalne oszczędności)
- Pomoc w podejmowaniu decyzji o korektach w trakcie roku

---

## Część 6: Raporty i analizy (10 minut)

### 6.1 Raport odchyleń budżetowych
**Cel:** Pokazać narzędzie do analizy odchyleń

**Kroki:**
1. W widoku budżetu 2025 kliknij **"Pokaż raport odchyleń"**
   (lub przejdź do tego widoku z menu głównego)
2. Zobaczysz tabelę odchyleń:

**Przykład raportu:**
```
┌────────────────────────────────────────────────────────────────┐
│ Konto           │ Budżet  │ Realizacja │ Odchylenie │ %      │
├────────────────────────────────────────────────────────────────┤
│ 701 Intencje    │ 150 000 │ 165 415    │ +15 415    │ +10.3% │ (zielony - więcej przychodu)
│ 702 Duszp. OMI  │  50 000 │  83 421    │ +33 421    │ +66.8% │ (czerwony - duże przekroczenie)
│ 412 Samochody   │  28 000 │  15 400    │ -12 600    │ -45.0% │ (zielony - oszczędność)
│ 444 Media       │  38 500 │  42 150    │  +3 650    │  +9.5% │ (pomarańczowy - lekkie przekroczenie)
└────────────────────────────────────────────────────────────────┘
```

3. Filtrowanie:
   - Rok
   - Miesiąc (opcjonalnie - domyślnie cały rok)
   - Typ konta (przychody / rozchody / wszystkie)

4. Kliknij **"Eksportuj do CSV"** - pobierz raport jako plik Excel

**Punkty do podkreślenia:**
- Łatwa identyfikacja obszarów wymagających uwagi
- Kolory pomagają w szybkiej ocenie sytuacji
- Eksport do CSV umożliwia dalszą analizę w Excelu

---

### 6.2 Porównanie wieloletnie
**Cel:** Pokazać trendy w zarządzaniu budżetem

**Kroki:**
1. W module "Budżet" kliknij **"Porównanie wieloletnie"**
2. Wybierz lata do porównania: 2023, 2024, 2025
3. Zobaczysz tabelę porównawczą:

**Przykład tabeli:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ Konto        │ Budżet 2023 │ Real. 2023 │ Budżet 2024 │ Real. 2024 │ Budżet 2025 │ Real. 2025 │
├────────────────────────────────────────────────────────────────────────────┤
│ 701 Intencje │ 145 000     │ 149 306    │ 150 000     │ 155 842    │ 155 000     │ 165 415    │
│ 412 Samochód │  25 000     │  27 145    │  27 000     │  29 384    │  28 000     │  15 400    │
│ 444 Media    │  35 000     │  36 200    │  37 000     │  38 450    │  38 500     │  42 150    │
└────────────────────────────────────────────────────────────────────────────┘
```

4. Kliknij **"Eksportuj do CSV"** - pobierz porównanie do Excela

**Punkty do podkreślenia:**
- Widoczne trendy wzrostowe/spadkowe
- Porównanie budżetu vs. realizacja dla wielu lat
- Pomoc w prognozowaniu przyszłych budżetów
- Przydatne dla prowincjała przy analizie efektywności lokalizacji

---

## Część 7: Workflow zatwierdzania (Prowincjał) (7 minut)

### 7.1 Perspektywa prowincjała - lista budżetów oczekujących
**Cel:** Pokazać proces zatwierdzania budżetów

**Kroki:**
1. Zaloguj się jako **prowincjał** (`prowincjal@omi.pl`, hasło: `password123`)
2. Przejdź do modułu **"Budżet"**
3. W liście budżetów zwróć uwagę na filtry:
   - **"Wszystkie lokalizacje"** - prowincjał widzi budżety ze wszystkich domów zakonnych
   - **"Status: Submitted"** - filtr pokazujący tylko budżety oczekujące na zatwierdzenie

4. Kliknij na budżet ze statusem **"submitted"** (2027)

---

### 7.2 Zatwierdzanie budżetu
**Cel:** Pokazać akcje dostępne dla prowincjała

**Kroki:**
1. W widoku budżetu 2027 zobaczysz na górze:
   - Przycisk **"Zatwierdź budżet"** (zielony)
   - Przycisk **"Odrzuć budżet"** (czerwony)

2. Przejrzyj:
   - Modyfikatory (czy są uzasadnione?)
   - Komentarze ekonoma
   - Załączniki (oferty, kalkulacje)
   - Pozycje budżetowe (czy kwoty są realistyczne?)

3. **Scenariusz A: Zatwierdzenie**
   - Kliknij **"Zatwierdź budżet"**
   - Pojawi się potwierdzenie: "Czy na pewno chcesz zatwierdzić ten budżet?"
   - Potwierdź
   - Status zmienia się na "approved"
   - Ekonom otrzymuje powiadomienie email: "Budżet na rok 2027 został zatwierdzony"

4. **Scenariusz B: Odrzucenie**
   - Kliknij **"Odrzuć budżet"**
   - Pojawi się dialog z polem tekstowym: "Powód odrzucenia"
   - Wpisz np.: "Proszę zmniejszyć budżet na samochody o 20%. Planowana kwota jest zawyżona względem poprzednich lat."
   - Potwierdź
   - Status zmienia się na "rejected"
   - Ekonom otrzymuje powiadomienie email z powodem odrzucenia
   - Ekonom może teraz poprawić budżet i złożyć ponownie

**Punkty do podkreślenia:**
- Prowincjał ma pełną kontrolę nad zatwierdzaniem budżetów
- System powiadomień email zapewnia komunikację
- Powód odrzucenia pomaga ekonomowi w poprawieniu budżetu

---

### 7.3 Przegląd wszystkich lokalizacji
**Cel:** Pokazać zarządzanie budżetami na poziomie prowincji

**Kroki:**
1. Wróć do listy budżetów
2. Kliknij **"Porównanie wieloletnie"**
3. Zaznacz opcję **"Wszystkie lokalizacje"**
4. Zobaczysz zagregowaną tabelę porównawczą dla całej prowincji:

**Przykład:**
```
┌───────────────────────────────────────────────────────────────────┐
│ Lokalizacja  │ Budżet 2023 │ Real. 2023 │ Budżet 2024 │ Real. 2024 │
├───────────────────────────────────────────────────────────────────┤
│ Bodzanów     │ 822 500     │ 845 230    │ 863 625     │ 887 652    │
│ Obrzycko     │ 654 000     │ 631 450    │ 686 700     │ 698 220    │
│ Poznań       │ 987 400     │ 1 012 345  │ 1 036 770   │ 1 058 943  │
├───────────────────────────────────────────────────────────────────┤
│ SUMA         │ 2 463 900   │ 2 489 025  │ 2 587 095   │ 2 644 815  │
└───────────────────────────────────────────────────────────────────┘
```

5. Kliknij **"Eksportuj do CSV"** - raport dla całej prowincji

**Punkty do podkreślenia:**
- Prowincjał ma wgląd w budżety wszystkich lokalizacji
- Możliwość porównania efektywności różnych domów zakonnych
- Agregacja danych na poziomie prowincji
- Raport do prezentacji na kapitule

---

## Część 8: Powiadomienia email (5 minut)

### 8.1 System powiadomień
**Cel:** Pokazać automatyczne powiadomienia

**Scenariusze powiadomień:**

1. **Ekonom składa budżet do zatwierdzenia**
   - Email do prowincjała:
     ```
     Temat: Nowy budżet oczekuje na zatwierdzenie
     Treść: Ekonom z lokalizacji [Bodzanów] złożył budżet na rok 2027 
            do zatwierdzenia. Proszę o weryfikację i podjęcie decyzji.
     Link: [Zobacz budżet]
     ```

2. **Prowincjał zatwierdza budżet**
   - Email do ekonoma:
     ```
     Temat: Budżet został zatwierdzony
     Treść: Budżet na rok 2027 dla lokalizacji [Bodzanów] został 
            zatwierdzony przez prowincjała.
     Link: [Zobacz budżet]
     ```

3. **Prowincjał odrzuca budżet**
   - Email do ekonoma:
     ```
     Temat: Budżet wymaga poprawek
     Treść: Budżet na rok 2027 dla lokalizacji [Bodzanów] został 
            odrzucony. Powód: [Proszę zmniejszyć budżet na samochody...]
     Link: [Edytuj budżet]
     ```

4. **Przekroczenie budżetu miesięcznego**
   - Email do ekonoma i prowincjała:
     ```
     Temat: UWAGA: Przekroczenie budżetu
     Treść: Budżet na sierpień 2025 został przekroczony o 3 427 zł (105%).
            Proszę przeanalizować wydatki i podjąć działania korygujące.
     Link: [Zobacz realizację]
     ```

**Punkty do podkreślenia:**
- Automatyczne powiadomienia zapewniają płynność komunikacji
- Ekonom i prowincjał są zawsze na bieżąco
- Linki w emailach prowadzą bezpośrednio do właściwego budżetu

---

## Część 9: Zaawansowane funkcje (5 minut)

### 9.1 Prognozowanie na podstawie średniej z 3 lat
**Cel:** Pokazać dokładniejszą metodę prognozowania

**Kroki:**
1. Utwórz nowy budżet na rok 2030
2. Wybierz metodę: **"Średnia z 3 lat"**
3. System obliczy średnią z lat 2027, 2028, 2029 dla każdego konta
4. Prognoza będzie bardziej wyrównana (mniej wrażliwa na jednorazowe skoki)

**Punkty do podkreślenia:**
- Metoda "średnia z 3 lat" jest bardziej stabilna
- Eliminuje wpływ jednorazowych, nadzwyczajnych zdarzeń
- Przydatna dla lokalizacji z dużą zmiennością wydatków

---

### 9.2 Załączniki do budżetu
**Cel:** Pokazać dokumentację uzupełniającą

**Kroki:**
1. W formularzu edycji budżetu dodaj załączniki:
   - Oferta na remont dachu (PDF)
   - Kalkulacja oszczędności na mediach (Excel)
   - Zdjęcia stanu technicznego (JPG)

2. Załączniki są:
   - Bezpiecznie przechowywane w Supabase Storage
   - Widoczne w widoku budżetu (do pobrania)
   - Dostępne dla prowincjała przy ocenie budżetu

**Punkty do podkreślenia:**
- Załączniki uzasadniają modyfikatory budżetu
- Prowincjał ma pełen kontekst przy podejmowaniu decyzji
- Wszystkie dokumenty w jednym miejscu

---

### 9.3 Eksport danych
**Cel:** Pokazać możliwości eksportu

**Dostępne eksporty:**
1. **Raport odchyleń** → CSV (Excel)
2. **Porównanie wieloletnie** → CSV (Excel)
3. **Lista pozycji budżetowych** → (możliwe do zaimplementowania w przyszłości)

**Punkty do podkreślenia:**
- Dane można dalej analizować w Excelu
- Możliwość tworzenia własnych raportów i wykresów
- Integracja z innymi systemami (np. księgowość)

---

## Część 10: Podsumowanie i Q&A (5 minut)

### 10.1 Kluczowe korzyści modułu
**Cel:** Podsumować wartość dodaną

**Korzyści dla ekonoma:**
- ✅ Automatyczne prognozowanie na podstawie historii
- ✅ Prosty interfejs - szybkie tworzenie budżetu
- ✅ Wizualizacja realizacji w czasie rzeczywistym
- ✅ Alerty o przekroczeniach budżetu
- ✅ Możliwość kopiowania budżetu z poprzedniego roku

**Korzyści dla prowincjała:**
- ✅ Centralny dostęp do budżetów wszystkich lokalizacji
- ✅ Przejrzysty proces zatwierdzania
- ✅ Możliwość odrzucenia z komentarzem
- ✅ Porównanie wieloletnie i raporty analityczne
- ✅ Automatyczne powiadomienia email

**Korzyści dla całej organizacji:**
- ✅ Standaryzacja procesu budżetowego
- ✅ Lepsza kontrola kosztów
- ✅ Transparentność finansowa
- ✅ Dane historyczne do analiz
- ✅ Zgodność z polskimi standardami rachunkowości

---

### 10.2 Najczęstsze pytania (FAQ)

**Q: Czy mogę edytować budżet po zatwierdzeniu?**
A: Nie, zatwierdzone budżety są read-only. Jeśli potrzebna jest zmiana, należy:
   - Stworzyć nowy budżet jako korektę
   - Lub poprosić prowincjała o odrzucenie, poprawić i złożyć ponownie

**Q: Jak często są aktualizowane dane realizacji?**
A: Dane realizacji są aktualizowane w czasie rzeczywistym, na podstawie transakcji wprowadzanych do systemu.

**Q: Czy mogę mieć wiele budżetów na ten sam rok?**
A: Nie, system wymusza unikalność: jedna lokalizacja = jeden budżet per rok. Można jednak tworzyć wersje robocze przed złożeniem.

**Q: Kto otrzymuje powiadomienia o przekroczeniu budżetu?**
A: Powiadomienia o przekroczeniu (>100%) są wysyłane do:
   - Ekonoma danej lokalizacji
   - Prowincjała (jeśli przekroczenie >10%)

**Q: Czy mogę eksportować dane do mojego systemu księgowego?**
A: Tak, wszystkie raporty można eksportować do formatu CSV, który jest kompatybilny z większością systemów księgowych.

---

### 10.3 Następne kroki

**Dla ekonomów:**
1. Zaloguj się do systemu
2. Przejrzyj budżet na bieżący rok
3. Rozpocznij przygotowanie budżetu na następny rok
4. Skorzystaj z funkcji "Skopiuj z poprzedniego roku"

**Dla prowincjała:**
1. Przejrzyj budżety oczekujące na zatwierdzenie
2. Zatwierdź lub odrzuć z komentarzem
3. Sprawdź raporty porównawcze dla całej prowincji
4. Monitoruj realizację budżetów w czasie rzeczywistym

**Dla administratora:**
1. Upewnij się, że wszyscy użytkownicy mają dostęp do modułu
2. Skonfiguruj powiadomienia email (SMTP)
3. Zweryfikuj ustawienia kategorii budżetowych
4. Przygotuj szkolenie dla nowych użytkowników

---

## Dodatkowe zasoby

### Linki do dokumentacji
- **Instrukcja obsługi modułu Budżet**: [Link]
- **FAQ**: [Link]
- **Kontakt do wsparcia technicznego**: support@omi.pl

### Materiały szkoleniowe
- **Wideo tutorial**: Tworzenie budżetu (10 min)
- **Wideo tutorial**: Zatwierdzanie budżetów (5 min)
- **Przewodnik krok po kroku** (PDF)

---

## Zakończenie prezentacji

Dziękuję za uwagę! Czy są pytania?

**Kontakt:**
- Email: support@omi.pl
- Telefon: +48 XXX XXX XXX
- Godziny wsparcia: Pn-Pt 8:00-16:00

---

## Notatki dla prezentera

### Wskazówki:
- Prezentacja powinna trwać **~60 minut** (z Q&A)
- Utrzymuj tempo - 1-2 minuty na slajd
- Zachęcaj do pytań na bieżąco
- Miej przygotowane dane demo (konta testowe)
- Pokaż "live" działanie systemu (nie slajdy!)
- Zwróć uwagę na kolory i intuicyjność interfejsu

### Potencjalne problemy:
- Brak danych w bazie → uruchom `setup-demo-data` przed prezentacją
- Powolne ładowanie → sprawdź połączenie z internetem
- Błędy w console → przygotuj backup (nagrany screencast)

### Backup plan:
Jeśli live demo nie działa:
1. Pokaż nagrany screencast
2. Przedstaw slajdy z screenami
3. Obiecaj dodatkową sesję demonstracyjną online
