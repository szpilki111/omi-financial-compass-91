
-- Drop old tables and recreate with text-based prefixes
DROP TABLE IF EXISTS provincial_fee_accounts;
DROP TABLE IF EXISTS provincial_fee_settings;

CREATE TABLE provincial_fee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_percentage numeric NOT NULL DEFAULT 0,
  target_debit_account_prefix text,
  target_credit_account_prefix text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE provincial_fee_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number_prefix text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_number_prefix)
);

-- RLS
ALTER TABLE provincial_fee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE provincial_fee_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read provincial fee settings" ON provincial_fee_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage provincial fee settings" ON provincial_fee_settings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'prowincjal'))
);

CREATE POLICY "Everyone can read provincial fee accounts" ON provincial_fee_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage provincial fee accounts" ON provincial_fee_accounts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'prowincjal'))
);
