
-- Najpierw dodaj nowe wartości do istniejącego enum report_type
ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'monthly';
ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'annual';

-- Dodaj kolumny dla szczegółowego śledzenia sald początkowych w report_details
ALTER TABLE report_details 
ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_balance numeric DEFAULT 0;

-- Utwórz tabelę dla szczegółowych pozycji kont w raportach
CREATE TABLE IF NOT EXISTS report_account_details (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES accounts(id),
    account_number text NOT NULL,
    account_name text NOT NULL,
    account_type text NOT NULL CHECK (account_type IN ('income', 'expense')),
    total_amount numeric NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(report_id, account_id, account_type)
);

-- Utwórz indeksy dla lepszej wydajności zapytań
CREATE INDEX IF NOT EXISTS idx_reports_type_location_year ON reports(report_type, location_id, year);
CREATE INDEX IF NOT EXISTS idx_reports_type_location_year_month ON reports(report_type, location_id, year, month);
CREATE INDEX IF NOT EXISTS idx_report_account_details_report_id ON report_account_details(report_id);
CREATE INDEX IF NOT EXISTS idx_report_account_details_account_type ON report_account_details(account_type);

-- Trigger do automatycznej aktualizacji updated_at dla report_account_details
CREATE OR REPLACE FUNCTION update_report_account_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_report_account_details_updated_at ON report_account_details;
CREATE TRIGGER trigger_update_report_account_details_updated_at
    BEFORE UPDATE ON report_account_details
    FOR EACH ROW
    EXECUTE FUNCTION update_report_account_details_updated_at();
