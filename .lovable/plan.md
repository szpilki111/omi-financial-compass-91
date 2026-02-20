

# Plan aktualizacji Bazy Wiedzy - uzupelnienie brakow i rozbieznosci

## Analiza obecnego stanu

Baza wiedzy zawiera **21 notatek** (w tym 1 testowa do usuniecia) w 7 kategoriach. Po porownaniu z aktualnym stanem aplikacji zidentyfikowano nastepujace braki i rozbieznosci:

### Rozbieznosci w istniejacych artykuldach

| Artykul | Problem |
|---------|---------|
| Dokumenty - Kompletny Podrecznik | Brak informacji o walutach (PLN/EUR/USD/CAD/NOK/AUD), brak opisu blokady dokumentow gdy istnieje raport, brak opisu importu z Excel (ExcelFormImportDialog), numery dokumentow opisane jako edytowalne (a sa read-only) |
| Import Danych - CSV i MT940 | Nie wspomina o automatycznym mapowaniu kont syntetycznych na analityczne, brak info o walidacji pre-importowej (blokady raportow, brakujace konta) |
| Planowanie Budzetu | Brak informacji o imporcie budzetu z pliku Excel, brak opisu eksportu do Excela |
| Raporty | Brak informacji o statusie "do poprawy" (to_be_corrected), brak opisu funkcji "Odblokuj raport" dla admina, brak info o eksporcie 2-stronicowym |
| Wyszukiwanie Kont | Brak informacji o podsumowaniu walutowym (nowa funkcja), brak opisu kont analitycznych w kontekscie wyszukiwania |
| FAQ | Brak pytan o waluty, import budzetu, kalendarz, wizualizacje, KPiR, blokady raportow |
| Slownik | Brak terminow: konto analityczne, konto syntetyczne, identyfikator lokalizacji, kurs wymiany, saldo poczatkowe/koncowe |
| Role i Uprawnienia | Brak roli "asystent", brak informacji o wielu lokalizacjach per uzytkownik |
| Dashboard | Nie wspomina o kafelkach: status budzetu, powiadomienia, szybki dostep |

### Calkowicie brakujace tematy

| Temat | Kategoria | Priorytet |
|-------|-----------|-----------|
| Obsluga walut obcych (EUR/USD/CAD/NOK/AUD) | dokumenty | Wysoki |
| Kalendarz i wydarzenia | wprowadzenie | Sredni |
| KPiR - Ksiega Przychodow i Rozchodow | dokumenty | Wysoki |
| Wizualizacja danych i wykresy | raporty | Sredni |
| Konta analityczne - tworzenie i zarzadzanie | konta | Wysoki |
| Import budzetu z pliku Excel | budzet | Wysoki |
| Ustawienia uzytkownika (profil, zaufane urzadzenia, konta) | wprowadzenie | Sredni |
| Zglaszanie bledow w systemie | faq | Niski |

---

## Plan zmian

### FAZA 1: Usuniecie smieci i aktualizacja dat
1. Usunac notatke testowa "test tytul" (id: `013e5822-...`)
2. Zaktualizowac daty "Ostatnia aktualizacja" we wszystkich artykulach na "Luty 2026"

### FAZA 2: Aktualizacja istniejacych artykulow (8 UPDATE)

**2.1 Dokumenty - Kompletny Podrecznik** (id: `ec15da5b-...`)
Dodac:
- Sekcja "Waluty obce": opis obslugiwanych walut (PLN, EUR, USD, CAD, NOK, AUD), przelaczanie widoku PLN/waluta, kurs wymiany
- Sekcja "Blokady dokumentow": kiedy dokument jest zablokowany (istnieje raport za dany okres niezaleznie od statusu), co robic gdy trzeba edytowac
- Poprawka: numer dokumentu jest generowany automatycznie i NIE mozna go edytowac (read-only)
- Dodac informacje o datach przyszlych (dozwolone)

**2.2 Import Danych - CSV i MT940** (id: `bbd23048-...`)
Dodac:
- Automatyczne mapowanie kont syntetycznych na analityczne (np. 420 -> 420-2-3)
- Walidacja pre-importowa: sprawdzanie blokad raportow, brakujacych kont, kont syntetycznych
- Precyzyjne komunikaty bledow i ich znaczenie
- Obsluga kodowania polskich znakow (UTF-8, Windows-1250, ISO-8859-2)

**2.3 Planowanie Budzetu - Kompletny Przewodnik** (id: `a03c3df0-...`)
Dodac:
- Nowa sekcja "Import budzetu z pliku Excel": opis szablonu (5 kolumn), procedura importu, wymagania
- Eksport budzetu i porownan wieloletnich do Excela
- Informacja o paginacji listy budzetow

**2.4 Raporty - Od Tworzenia do Zatwierdzenia** (id: `5fd2e6f7-...`)
Dodac:
- Status "Do poprawy" (to_be_corrected) w tabeli statusow
- Funkcja "Odblokuj raport" dostepna dla admina
- Eksport dwustronicowy: Strona 1 (bilans, intencje, naleznosci), Strona 2 (przychody 7xx, rozchody 4xx)
- Informacja ze raport z DOWOLNYM statusem blokuje edycje/usuwanie dokumentow

**2.5 Wyszukiwanie Kont - Mistrzowski Przewodnik** (id: `6535dcef-...`)
Dodac:
- Podsumowanie walutowe: gdy na koncie sa operacje w walutach obcych, pojawia sie dodatkowy pasek z podsumowaniem Wn/Ma/Saldo w kazdej walucie
- Wyjasnienie roznic: kwoty w PLN (glowne podsumowanie) vs kwoty w walucie oryginalnej (dodatkowe podsumowanie)

**2.6 FAQ** (id: `11f68cde-...`)
Dodac pytania:
- P: Jak korzystac z walut obcych? (EUR, USD, CAD, NOK, AUD)
- P: Jak zaimportowac budzet z pliku Excel?
- P: Co to jest KPiR i jak go uzyc?
- P: Jak korzystac z kalendarza?
- P: Nie moge usunac dokumentu - dlaczego? (blokada raportu)
- P: Jak stworzyc konto analityczne?
- P: Jak zmienic nazwe konta analitycznego?
- P: Jak zglosic blad w systemie?
- P: Co oznacza ikona 📊 przy koncie? (konto z podkontami)

**2.7 Slownik Pojec** (id: `bb071398-...`)
Dodac terminy:
- Konto syntetyczne / Konto analityczne (podkonto)
- Identyfikator lokalizacji (np. 2-3)
- Kurs wymiany / Roznice kursowe
- Saldo poczatkowe / Saldo koncowe
- KPiR (Ksiega Przychodow i Rozchodow)
- 2FA (weryfikacja dwuetapowa)
- Bateria realizacji (wizualizacja % wykonania budzetu)

**2.8 Role i Uprawnienia** (id: `8f037534-...`)
Dodac:
- Wiele lokalizacji na jednego uzytkownika (ekonom obslugujacy kilka placowek)
- Informacja o funkcji "Odblokuj raport" dla admina
- Prowincjal: dostep do wizualizacji danych miedzy placowkami

### FAZA 3: Nowe artykuly (5 INSERT)

**3.1 NOWY: "💱 Obsluga Walut Obcych - Przewodnik"** (kategoria: `dokumenty`)
Zawartosc:
- Obslugiwane waluty: PLN, EUR, USD, CAD, NOK, AUD
- Jak utworzyc dokument walutowy: wybor waluty, kurs wymiany (reczny lub z NBP)
- Przelaczanie widoku: kwoty w walucie vs kwoty w PLN
- Kurs wymiany zapisywany per transakcja
- Wplyw na raporty: wszystko przeliczane na PLN
- Podsumowanie walutowe w wyszukiwaniu kont
- Gdzie sprawdzic kursy: ExchangeRateManager, tabela NBP

**3.2 NOWY: "📒 KPiR - Ksiega Przychodow i Rozchodow"** (kategoria: `dokumenty`)
Zawartosc:
- Co to jest KPiR i kto z niego korzysta (tylko ekonomowie)
- Tworzenie nowej operacji KPiR
- Import operacji do KPiR
- Edycja i usuwanie wpisow
- Podsumowanie miesieczne
- Przejscie do edycji dokumentu zrodlowego

**3.3 NOWY: "📅 Kalendarz - Planowanie Wydarzen"** (kategoria: `wprowadzenie`)
Zawartosc:
- Widok miesieczny: nawigacja, oznaczenia dni z wydarzeniami
- Typy wydarzen: termin raportu, spotkanie, wizytacja, inne
- Priorytety: wysoki, sredni, niski
- Tworzenie wydarzenia: data, tytul, opis, typ, priorytet
- Wydarzenia globalne vs lokalne
- Filtrowanie po lokalizacji (admin/prowincjal)
- Nadchodzace wydarzenia: widget z listą

**3.4 NOWY: "📊 Wizualizacja Danych - Wykresy i Porownania"** (kategoria: `raporty`)
Zawartosc (rozszerzenie istniejacego krotkiego artykulu `d82c17d4-...`):
- Porownanie przychodow i rozchodow miedzy placowkami
- Wykresy liniowe trendow miesiecznych
- Wykresy slupkowe budzetow
- Tabela zbiorcza ze wskaznikami finansowymi
- Filtrowanie po roku i lokalizacji
- Trendy wieloletnie: analiza zmian rok do roku

**3.5 NOWY: "⚙️ Ustawienia Uzytkownika"** (kategoria: `wprowadzenie`)
Zawartosc:
- Zakladka "Profil": informacje o przypisanych lokalizacjach, dane uzytkownika
- Zakladka "Konta": przegladanie kont przypisanych do lokalizacji, wyszukiwanie po numerze/nazwie
- Zakladka "Zaufane urzadzenia": lista zalogowanych urzadzen, usuwanie nieuzywanych
- Tryb Windows 98: wlaczanie/wylaczanie retro stylu

---

## Techniczne wykonanie

Wszystkie zmiany beda wykonane jako operacje SQL (UPDATE/INSERT/DELETE) na tabeli `admin_notes` z uzyciem narzedzia insert.

- **1 DELETE**: notatka testowa
- **8 UPDATE**: istniejace artykuly z rozszerzona trescia
- **5 INSERT**: nowe artykuly
- Wszystkie notatki: `visible_to = ['ekonom', 'proboszcz', 'prowincjal', 'admin']`, `pinned = false` (chyba ze glowne przewodniki)

Szacowany rozmiar nowej tresci: ~25 000 znakow (laczna tresc bazy wiedzy wzrosnie z ~60 000 do ~85 000 znakow).

