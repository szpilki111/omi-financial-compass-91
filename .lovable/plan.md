# Zadania z rozmowy: seminarium Obra -> Poznań, superiorzy

## Co wynika z rozmowy
1. Nowa placówka „Wyższe Seminarium Duchowne Misjonarzy Oblatów Maryi Niepokalanej w Poznaniu”, działająca od 1 października 2026. Obecne konto seminarium w Obrze pracuje dalej do końca roku.
2. Od stycznia stara placówka zmienia nazwę na „Dom Zakonny w Obrze”.
3. Potrzebne jest zamrażanie placówek z historią. Usuwanie takich placówek nie wchodzi w grę, bo mają już dane.
4. Trzeba sprawdzić, czy superior ma tylko podgląd, i napisać krótką instrukcję, jak go założyć.

## Stan obecny
- W Administracji → Placówki już są przyciski „Dodaj placówkę”, edycja nazwy i usuwanie. Usunięcie jest blokowane, gdy placówka ma użytkowników, operacje lub raporty. Klient najpewniej nie zauważył tego przycisku, więc punkty 1 i 2 da się zrobić już dziś, bez programowania.
- Rola „superior” już istnieje. Baza ma zabezpieczenie blokujące zapisy dla tej roli. Trzeba to potwierdzić testem.
- Zamrażania placówek jeszcze nie ma.

## Do zrobienia
1. **Nowa placówka Poznań (pilne, ok. 1 h)**: dodam placówkę z nowym identyfikatorem, skrótem domu i ustawieniami walut. Przypiszę jej plan kont (0xx–8xx) i użytkowników. Na koniec sprawdzę, czy numer dokumentu i raport za październik tworzą się poprawnie.
2. **Zamrożenie placówki (ok. 5–6 h)**:
   - Nowy przełącznik „Aktywna / Zamrożona” z datą zamrożenia.
   - W zamrożonej placówce nie można dodawać ani edytować dokumentów z datą po dacie zamrożenia. Blokadę sprawdza też baza, nie tylko ekran.
   - Zamrożone placówki są wyszarzone na listach wyboru i znikają z panelu „Placówki bez raportu”. Pozostają widoczne w raportach i w obrotach globalnych.
   - Przycisk „Odmroź”.
3. **Weryfikacja superiora (ok. 1–2 h)**: założę testowego superiora i sprawdzę, że widzi dokumenty, raporty i konta swojego domu, ale nie może niczego zapisać ani usunąć. Ukryję przyciski edycji, które mu się wyświetlają, a nie działają.
4. **Krótka instrukcja dla klienta (ok. 1 h)**: jak dodać placówkę, jak zmienić nazwę od stycznia, jak zamrozić placówkę i jak założyć superiora.

Razem ok. 8–10 h.

## Szczegóły techniczne
- Migracja: w `locations` dodać `is_active boolean default true`, `frozen_at date`, `frozen_by uuid` oraz trigger na `documents`/`transactions`, który odrzuca zapisy z datą >= `frozen_at`. Wzorem jest `enforce_document_date_not_locked`.
- Pliki: `LocationsManagement.tsx`, `LocationDialog.tsx`, selektory placówek (`ReportsList.tsx`, `GlobalAccountTurnovers.tsx`, `UserDialog.tsx`).
- Superior: przejrzeć `block_superior_writes` i warunki `checkPermission` w stronach dokumentów i raportów.
