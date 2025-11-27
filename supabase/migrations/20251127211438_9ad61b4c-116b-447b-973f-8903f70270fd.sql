-- Update project_features - mark completed items correctly

-- Notatki admina i kalendarz - already implemented in KnowledgeBasePage
UPDATE public.project_features 
SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Notatki admina i kalendarz';

-- Storage PDF i dokumentacja - knowledge-base bucket and documents implemented
UPDATE public.project_features 
SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Storage PDF i dokumentacja';

-- Powiadomienia i komunikacja - email notifications working (error reports, budgets, reminders)
UPDATE public.project_features 
SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Powiadomienia i komunikacja';

-- Automatyczne przypomnienia - manual button implemented, edge function ready
UPDATE public.project_features 
SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Automatyczne przypomnienia o terminach';

-- Obsługa walut - 95% (everything except currency differences which are skipped)
UPDATE public.project_features 
SET implementation_percentage = 95, status = 'in_progress', updated_at = now()
WHERE title = 'Obsługa walut';

-- Baza wiedzy - 100% (documents, admin notes, storage all implemented)
UPDATE public.project_features 
SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Baza wiedzy';

-- Planowanie budżetowe - 100% (fully implemented with all features)
UPDATE public.project_features 
SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Planowanie budżetowe';

-- Wizualizacja danych - 100% (charts, statistics implemented)
UPDATE public.project_features 
SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Wizualizacja danych';

-- Delete duplicate entries for "Automatyczne przypomnienia o terminach"
DELETE FROM public.project_features 
WHERE title = 'Automatyczne przypomnienia o terminach' 
AND id NOT IN (
  SELECT id FROM public.project_features 
  WHERE title = 'Automatyczne przypomnienia o terminach' 
  ORDER BY created_at ASC 
  LIMIT 1
);