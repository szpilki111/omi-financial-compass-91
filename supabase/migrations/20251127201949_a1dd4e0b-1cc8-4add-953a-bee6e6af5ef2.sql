
-- Aktualizacja Planowanie budżetowe z 10% na 95%
UPDATE public.project_features SET implementation_percentage = 95, status = 'in_progress', updated_at = now()
WHERE title = 'Planowanie budżetowe';

-- Aktualizacja Integracja z API NBP na 100%
UPDATE public.project_features SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Integracja z API NBP';

-- Aktualizacja Centralne raportowanie na 95%
UPDATE public.project_features SET implementation_percentage = 95, status = 'in_progress', updated_at = now()
WHERE title = 'Centralne raportowanie';

-- Aktualizacja Automatyczne zamykanie dokumentów na 100%
UPDATE public.project_features SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Automatyczne zamykanie dokumentów po złożeniu raportu';

-- Aktualizacja Wizualizacja danych na 95%
UPDATE public.project_features SET implementation_percentage = 95, status = 'in_progress', updated_at = now()
WHERE title = 'Wizualizacja danych';

-- Aktualizacja Powiadomienia i komunikacja na 75%
UPDATE public.project_features SET implementation_percentage = 75, status = 'in_progress', updated_at = now()
WHERE title = 'Powiadomienia i komunikacja';

-- Aktualizacja Weryfikacja i korekty na 100%
UPDATE public.project_features SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Weryfikacja i korekty';

-- Aktualizacja Obsługa walut na 90%
UPDATE public.project_features SET implementation_percentage = 90, status = 'in_progress', updated_at = now()
WHERE title = 'Obsługa walut';

-- Aktualizacja KPiR na 95%
UPDATE public.project_features SET implementation_percentage = 95, status = 'in_progress', updated_at = now()
WHERE title = 'KPiR (Księga przychodów i rozchodów)';

-- Aktualizacja podfunkcji budżetowych
UPDATE public.project_features SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title IN ('Model danych budżetowania', 'Interfejs budżetowy', 'Raporty odchyleń budżetowych', 
'Workflow zatwierdzania budżetów', 'Wizualizacja realizacji budżetu');

-- Aktualizacja podfunkcji powiadomień budżetowych
UPDATE public.project_features SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title LIKE '%powiadomienia%budżet%' OR title LIKE '%email%budżet%';
