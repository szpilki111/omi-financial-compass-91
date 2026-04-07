
-- Tabela ustawień opłaty prowincjalnej
CREATE TABLE public.provincial_fee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_percentage numeric NOT NULL DEFAULT 0,
  target_debit_account_id uuid REFERENCES public.accounts(id),
  target_credit_account_id uuid REFERENCES public.accounts(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela kont wyzwalających opłatę prowincjalną
CREATE TABLE public.provincial_fee_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id)
);

-- RLS dla provincial_fee_settings
ALTER TABLE public.provincial_fee_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and prowincjal can manage provincial fee settings"
ON public.provincial_fee_settings
FOR ALL
TO public
USING (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text]))
WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text]));

CREATE POLICY "All authenticated users can view provincial fee settings"
ON public.provincial_fee_settings
FOR SELECT
TO authenticated
USING (true);

-- RLS dla provincial_fee_accounts
ALTER TABLE public.provincial_fee_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and prowincjal can manage provincial fee accounts"
ON public.provincial_fee_accounts
FOR ALL
TO public
USING (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text]))
WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text]));

CREATE POLICY "All authenticated users can view provincial fee accounts"
ON public.provincial_fee_accounts
FOR SELECT
TO authenticated
USING (true);
