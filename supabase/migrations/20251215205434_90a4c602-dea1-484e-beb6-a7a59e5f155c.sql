-- Insert demo admin notes for knowledge base
INSERT INTO public.admin_notes (title, content, created_by, pinned, visible_to, location_id) VALUES
-- Przypięte notatki ogólne
('🚀 Szybki start - Ekonom', 
'## Pierwsze kroki w systemie

1. **Zaloguj się** używając otrzymanych danych
2. Przejdź do **Dashboard** - zobaczysz statystyki placówki
3. Stwórz pierwszy **Dokument** (menu → Dokumenty → Nowy dokument)
4. Na koniec miesiąca wygeneruj **Raport**

### Ważne terminy:
- Raport miesięczny: do 10. dnia następnego miesiąca
- Budżet roczny: do 30 listopada

### Pomoc:
- Przycisk "Zgłoś błąd" - prawy dolny róg
- Dokumentacja: zakładka "Dokumenty" w Bazie Wiedzy',
'fbdffef6-646d-4237-aa54-62ae80792ba4', true, ARRAY['ekonom', 'proboszcz'], NULL),

('📋 Checklist miesięczny',
'## Co zrobić każdego miesiąca?

### Do 5. dnia:
- [ ] Wprowadź wszystkie dokumenty z poprzedniego miesiąca
- [ ] Sprawdź poprawność sald na kontach bankowych
- [ ] Zweryfikuj bilans dokumentów (Wn = Ma)

### Do 10. dnia:
- [ ] Wygeneruj raport miesięczny
- [ ] Sprawdź podsumowanie finansowe
- [ ] Złóż raport do zatwierdzenia

### Wskazówki:
- Dokumenty można importować z plików CSV i MT940
- Używaj funkcji "Rozbij operację" dla złożonych transakcji',
'fbdffef6-646d-4237-aa54-62ae80792ba4', true, ARRAY['ekonom'], NULL),

('⚠️ Częste błędy i rozwiązania',
'## Najczęstsze problemy

### "Nie mogę utworzyć raportu"
**Przyczyna:** Niekompletne dokumenty w danym miesiącu
**Rozwiązanie:** System pokaże listę dokumentów do poprawy. Uzupełnij brakujące pola.

### "Dokument nie zapisuje się"
**Przyczyna:** Niezgodność sum (Winien ≠ Ma)
**Rozwiązanie:** Sprawdź kwoty - suma po stronie Winien musi równać się sumie Ma.

### "Nie widzę swojego konta"
**Przyczyna:** Konto nie jest przypisane do placówki
**Rozwiązanie:** Skontaktuj się z administratorem.

### "Brak uprawnień"
**Przyczyna:** Twoja rola nie pozwala na tę akcję
**Rozwiązanie:** Sprawdź czy jesteś zalogowany na właściwe konto.',
'fbdffef6-646d-4237-aa54-62ae80792ba4', true, ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'], NULL),

('📊 Przewodnik po budżecie',
'## Jak stworzyć budżet?

### Krok 1: Przygotowanie
- Zbierz dane o wydatkach z poprzednich lat
- Określ planowane inwestycje i zmiany

### Krok 2: Tworzenie
1. Menu → Budżet → Nowy budżet
2. Wybierz rok i metodę prognozowania:
   - **Ostatni rok** - kopiuje wartości
   - **Średnia 3 lat** - oblicza średnią
   - **Ręcznie** - puste pola

### Krok 3: Wypełnienie
- Wprowadź planowane kwoty dla każdego konta
- Dodaj "Inne wydatki" jeśli planujesz dodatkowe koszty
- Opisz planowaną "Redukcję kosztów"

### Krok 4: Złożenie
- Sprawdź wszystkie pozycje
- Kliknij "Złóż do zatwierdzenia"
- Prowincjał otrzyma powiadomienie',
'fbdffef6-646d-4237-aa54-62ae80792ba4', false, ARRAY['ekonom'], NULL),

('🔐 Bezpieczeństwo konta',
'## Zasady bezpieczeństwa

### Hasło:
- Minimum 8 znaków
- Zawiera litery i cyfry
- Zmieniaj co 90 dni

### Logowanie:
- Nie udostępniaj hasła innym osobom
- Wyloguj się po zakończeniu pracy
- Na wspólnym komputerze nie zaznaczaj "Zapamiętaj urządzenie"

### Weryfikacja dwuskładnikowa:
- Przy pierwszym logowaniu z nowego urządzenia system wyśle kod na e-mail
- Kod jest ważny 10 minut

### Podejrzana aktywność:
- Sprawdź listę zaufanych urządzeń (Ustawienia → Zaufane urządzenia)
- Nieznane urządzenie? Usuń je i zmień hasło!',
'fbdffef6-646d-4237-aa54-62ae80792ba4', false, ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'], NULL),

-- Notatki dla konkretnej placówki (Gorzów)
('📍 Informacje dla placówki Gorzów',
'## Specyficzne ustawienia

### Identyfikator lokalizacji: 2-3
Wszystkie konta placówki mają sufiks "-2-3"
Przykład: 401-2-3 (Koszty żywności)

### Kontakt z ekonomem prowincji:
- E-mail: ekonom@oblaci.pl
- Telefon: +48 123 456 789

### Terminy specjalne:
- Inwentaryzacja: grudzień
- Sprawozdanie roczne: do 15 stycznia',
'fbdffef6-646d-4237-aa54-62ae80792ba4', false, ARRAY['ekonom', 'proboszcz'], '0a4ed1de-0b63-468e-a110-73d3b339d85f'),

-- Notatka dla prowincjałów/adminów
('📈 Instrukcja zatwierdzania dokumentów',
'## Workflow zatwierdzania

### Raporty:
1. Przejdź do Raporty → filtruj "Złożone"
2. Kliknij raport aby zobaczyć szczegóły
3. Sprawdź:
   - Zgodność sum przychodów i rozchodów
   - Komentarze ekonoma
   - Porównanie z poprzednimi miesiącami
4. **Zatwierdź** lub **Odrzuć** (podaj powód)

### Budżety:
1. Przejdź do Budżet → filtruj "Złożone"  
2. Sprawdź:
   - Realność założeń
   - Porównanie z poprzednim rokiem
   - Uzasadnienia dla dużych zmian
3. **Zatwierdź** lub **Odrzuć**

### Powiadomienia:
- System automatycznie powiadomi ekonoma o decyzji
- Odrzucony dokument wraca do statusu "Szkic"',
'fbdffef6-646d-4237-aa54-62ae80792ba4', false, ARRAY['prowincjal', 'admin'], NULL),

('🔧 Panel administracyjny',
'## Zarządzanie systemem

### Użytkownicy:
- Administracja → Użytkownicy
- Tworzenie, edycja, blokowanie kont
- Przypisywanie ról i placówek

### Placówki:
- Administracja → Placówki
- Dodawanie nowych lokalizacji
- Konfiguracja identyfikatorów

### Konta księgowe:
- Administracja → Konta placówek
- Przypisywanie kont do lokalizacji
- Tworzenie kont analitycznych

### Przypomnienia:
- Administracja → Przypomnienia
- Ręczne wysyłanie przypomnień
- Automatyczne przypomnienia: 5 dni przed, 1 dzień przed terminem

### Zgłoszenia błędów:
- Administracja → Zgłoszenia
- Obsługa zgłoszeń użytkowników
- Priorytetyzacja i śledzenie statusów',
'fbdffef6-646d-4237-aa54-62ae80792ba4', false, ARRAY['admin'], NULL);

-- Insert demo knowledge documents metadata (without actual files)
INSERT INTO public.knowledge_documents (title, description, file_name, file_path, category, file_size, uploaded_by) VALUES
('Instruktaż systemu - pełna wersja',
'Kompletny przewodnik po systemie finansowym OMI. Zawiera opis wszystkich modułów, instrukcje dla każdej roli użytkownika, FAQ i słownik pojęć księgowych.',
'INSTRUKTAZ_SYSTEMU.pdf', 'instruktaz/INSTRUKTAZ_SYSTEMU.pdf', 'Poradniki', 2048000,
'fbdffef6-646d-4237-aa54-62ae80792ba4'),

('Szablon raportu miesięcznego',
'Wzór prawidłowo wypełnionego raportu miesięcznego z komentarzami i objaśnieniami.',
'szablon_raport_miesięczny.xlsx', 'szablony/szablon_raport_miesięczny.xlsx', 'Szablony', 128000,
'fbdffef6-646d-4237-aa54-62ae80792ba4'),

('Szablon budżetu rocznego',
'Wzór planu budżetowego z przykładowymi wartościami i instrukcją wypełniania.',
'szablon_budzet_roczny.xlsx', 'szablony/szablon_budzet_roczny.xlsx', 'Szablony', 156000,
'fbdffef6-646d-4237-aa54-62ae80792ba4'),

('Procedura zamknięcia miesiąca',
'Krok po kroku: jak prawidłowo zamknąć miesiąc księgowy i złożyć raport.',
'procedura_zamkniecia_miesiaca.pdf', 'procedury/procedura_zamkniecia_miesiaca.pdf', 'Procedury', 512000,
'fbdffef6-646d-4237-aa54-62ae80792ba4'),

('Plan kont - wykaz',
'Pełny wykaz kont księgowych stosowanych w systemie z opisami i przykładami użycia.',
'plan_kont_wykaz.pdf', 'procedury/plan_kont_wykaz.pdf', 'Procedury', 768000,
'fbdffef6-646d-4237-aa54-62ae80792ba4'),

('Instrukcja importu MT940',
'Jak importować wyciągi bankowe w formacie MT940 do systemu.',
'instrukcja_import_mt940.pdf', 'poradniki/instrukcja_import_mt940.pdf', 'Poradniki', 384000,
'fbdffef6-646d-4237-aa54-62ae80792ba4'),

('Regulamin prowadzenia ksiąg',
'Wewnętrzny regulamin prowadzenia dokumentacji finansowej w placówkach OMI.',
'regulamin_prowadzenia_ksiag.pdf', 'procedury/regulamin_prowadzenia_ksiag.pdf', 'Procedury', 640000,
'fbdffef6-646d-4237-aa54-62ae80792ba4'),

('Słownik pojęć księgowych',
'Definicje najważniejszych terminów księgowych używanych w systemie.',
'slownik_pojec_ksiegowych.pdf', 'poradniki/slownik_pojec_ksiegowych.pdf', 'Poradniki', 256000,
'fbdffef6-646d-4237-aa54-62ae80792ba4');