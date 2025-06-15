
-- Aktualizuj typ report_type aby obsługiwał raporty roczne
ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'annual';

-- Dodaj nowe sekcje dla raportów rocznych
INSERT INTO report_sections (name, report_type, section_order) VALUES
('Przychody roczne', 'annual', 1),
('Rozchody roczne', 'annual', 2),
('Podsumowanie roczne', 'annual', 3)
ON CONFLICT DO NOTHING;

-- Dodaj mapowania kont dla raportów rocznych
INSERT INTO account_section_mappings (account_prefix, report_type, section_id) 
SELECT '7', 'annual', id FROM report_sections WHERE name = 'Przychody roczne' AND report_type = 'annual'
ON CONFLICT DO NOTHING;

INSERT INTO account_section_mappings (account_prefix, report_type, section_id) 
SELECT '4', 'annual', id FROM report_sections WHERE name = 'Rozchody roczne' AND report_type = 'annual'
ON CONFLICT DO NOTHING;

INSERT INTO account_section_mappings (account_prefix, report_type, section_id) 
SELECT '200', 'annual', id FROM report_sections WHERE name = 'Przychody roczne' AND report_type = 'annual'
ON CONFLICT DO NOTHING;

INSERT INTO account_section_mappings (account_prefix, report_type, section_id) 
SELECT '200', 'annual', id FROM report_sections WHERE name = 'Rozchody roczne' AND report_type = 'annual'
ON CONFLICT DO NOTHING;
