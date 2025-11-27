-- Usunięcie funkcji "Automatyczna wysyłka PDF mailem" z planu projektu
DELETE FROM public.project_features 
WHERE title ILIKE '%automatyczna wysyłka PDF%' 
   OR title ILIKE '%wysyłka PDF mailem%'
   OR title ILIKE '%automatyczne wysyłanie PDF%';