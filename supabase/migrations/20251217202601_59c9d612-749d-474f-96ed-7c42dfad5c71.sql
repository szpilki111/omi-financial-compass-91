-- Aktualizacja typów kont zgodnie z polskim Zakładowym Planem Kont

-- Zespół 0 - Aktywa trwałe
UPDATE accounts SET type = 'Aktywa trwałe' 
WHERE number LIKE '0%';

-- Zespół 1 - Środki pieniężne
UPDATE accounts SET type = 'Środki pieniężne' 
WHERE number LIKE '1%';

-- Zespół 2 - Rozrachunki i roszczenia
UPDATE accounts SET type = 'Rozrachunki' 
WHERE number LIKE '2%';

-- Zespół 4 - Koszty według rodzajów
UPDATE accounts SET type = 'Koszty' 
WHERE number LIKE '4%';

-- Zespół 7 - Przychody i koszty związane z ich osiągnięciem
UPDATE accounts SET type = 'Przychody' 
WHERE number LIKE '7%';

-- Zespół 8 - Kapitały, fundusze, rezerwy i wynik finansowy
UPDATE accounts SET type = 'Kapitały i fundusze' 
WHERE number LIKE '8%';