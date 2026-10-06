# Ekonomat widzi dokumenty WSD Poznań na swojej liście

## Co wynika z rozmowy

Ojciec Dariusz loguje się jako Ekonomat. Na liście dokumentów od razu, bez szukania, widzi dokumenty WSD Poznań. Dokumentów innych domów i parafii tam nie widzi. Chce, żeby na Ekonomacie pokazywały się tylko dokumenty Prowincji. Ustalono, że nie chodzi o uprawnienia, tylko o filtr listy. Każda placówka ma od razu widzieć tylko swoje dokumenty.

## Przyczyna (sprawdzona)

- Konta administratorów otwierają listę z filtrem „Wszystkie placówki”, więc pokazują się na niej dokumenty wszystkich domów.
- Lista jest ułożona alfabetycznie od końca według numeru dokumentu. „WSDPOZ/…” zaczyna się od W, więc trafia na samą górę. Dokumenty domów i parafii („DOM…”, „PAR…”) są pod setkami dokumentów „PROW…”, na dalszych stronach. Dlatego wyglądało, jakby problem dotyczył tylko WSD.
- Dane są poprawne. Dokument WSD jest zapisany na WSD (4-4) i na konta WSD, a utworzył go Jerzy Kotowski.

## Co zmienię

1. Po wejściu w Dokumenty administrator lub prowincjał od razu zobaczy tylko dokumenty swojej placówki. Na Ekonomacie będą to dokumenty Prowincji.
2. Dokumenty innej placówki albo wszystkich placówek nadal będzie można zobaczyć, ale dopiero po wybraniu ich w filtrze.
3. Przy „Wszystkich placówkach” przy każdym dokumencie będzie widoczna nazwa placówki.
4. Uprawnienia, raporty i obroty zostają bez zmian. Użytkownicy domów, np. Jerzy Kotowski, nie zauważą żadnej różnicy.

## Poza tym zadaniem (z tej samej rozmowy)

Zmiana nazwy „WSD w Obrze” na „Dom Zakonny w Obrze” od 2027 r. jest już w programie: Administracja → Placówki → edycja nazwy. Wcześniejsze numery dokumentów zostaną takie, jakie były. Nie robię teraz nic więcej, chyba że zechcesz, żeby stare dokumenty pokazywały starą nazwę placówki.  
  
Od użytkownika: tak, dokumenty, które zostały zrobione z określoną nazwą, muszą zostać ze starą nazwą koniecznie. Jak sie zmieni nazwa placówki, to tylko dokumenty utworzone już z nową nazwą placówki mają mieć nową nazwę.

## Szczegóły techniczne

- `DocumentsPage.tsx`: `selectedLocationId` startuje od `user.location_id` dla admin/prowincjał, a gdy go brak, od `'all'`.
- `DocumentsTable.tsx`: przy filtrze `'all'` kolumna „Placówka” z `locations.name`.