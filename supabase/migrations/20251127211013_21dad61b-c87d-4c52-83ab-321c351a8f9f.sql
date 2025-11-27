-- Update project_features with actual implementation progress

-- Automatyczne przypomnienia o terminach - 90% (Edge function ready, needs cron)
UPDATE public.project_features 
SET implementation_percentage = 90, status = 'in_progress', updated_at = now()
WHERE title = 'Automatyczne przypomnienia o terminach';

-- Automatyczne zamykanie dokumentów - 100% (implemented)
UPDATE public.project_features 
SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Automatyczne zamykanie dokumentów';

-- Baza wiedzy - 95% (Storage, documents, admin notes implemented)
UPDATE public.project_features 
SET implementation_percentage = 95, status = 'in_progress', updated_at = now()
WHERE title = 'Baza wiedzy';

-- Historia kursów walut - 100% (implemented in ExchangeRateManager)
UPDATE public.project_features 
SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Historia kursów walut';

-- Dopracowanie zliczania raportów - 100% (ReportStatistics on Dashboard)
UPDATE public.project_features 
SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Dopracowanie zliczania raportów';

-- Centralne raportowanie - 100% (Excel export, PDF, statistics done)
UPDATE public.project_features 
SET implementation_percentage = 100, status = 'completed', updated_at = now()
WHERE title = 'Centralne raportowanie';