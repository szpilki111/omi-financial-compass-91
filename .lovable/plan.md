# Dokumenty innych placówek widoczne dla Prowincji

## Co ustaliłem
- Dokument WSDPOZ/2026/09/001 jest zapisany na WSD (4-4), a wszystkie jego operacje idą na konta WSD. Dane są poprawne.
- Pracownicy Prowincji (Ekonomat Prowincji, A. Albiniak, R. Dąbkowski, M. Głowacki) mają w programie rolę **administrator**, a Ojciec Prowincjał rolę **prowincjał**. Obie role z założenia widzą dokumenty wszystkich placówek. Bez tego nie mogliby sprawdzać ani zatwierdzać raportów.
- Lista dokumentów otwiera się u nich z filtrem „Wszystkie placówki”, dlatego dokumenty domów mieszają się z dokumentami Prowincji.

## Co zmienię
1. Lista dokumentów u administratora i prowincjała będzie domyślnie pokazywać tylko dokumenty jego własnej placówki, czyli Prowincji.
2. Dokumenty innego domu albo wszystkich placówek będzie można zobaczyć tylko po świadomym wyborze w filtrze. Do sprawdzania i poprawiania nadal będą dostępne.
3. Gdy w filtrze wybrane będą „Wszystkie placówki”, przy każdym dokumencie pojawi się nazwa placówki, żeby nie mylić dokumentów domów z dokumentami Prowincji.
4. Uprawnienia zostają bez zmian, a raporty, obroty i zatwierdzanie działają jak dotąd.

## Do decyzji
Jeśli pracownicy Prowincji w ogóle nie mają widzieć dokumentów domów, nawet przez filtr, trzeba im zmienić rolę. Wtedy jednak stracą dostęp do raportów i administracji innych placówek. Tego nie robię bez Twojej decyzji.

## Szczegóły techniczne
- `DocumentsPage.tsx`: początkowa wartość `selectedLocationId` dla roli admin/prowincjał będzie równa `user.location_id`, a jeśli go brak, `'all'`.
- `DocumentsTable.tsx`: kolumna „Placówka” (`locations.name`) widoczna, gdy filtr = `'all'`.
