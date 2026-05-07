
ALTER TABLE public.provincial_fee_accounts
  ADD COLUMN IF NOT EXISTS target_debit_subaccount text,
  ADD COLUMN IF NOT EXISTS target_credit_subaccount text;

CREATE TABLE IF NOT EXISTS public.report_liability_category_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id uuid NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  category_key text NOT NULL CHECK (category_key IN ('loans_given','loans_taken','province','others')),
  account_prefixes text[] NOT NULL DEFAULT '{}',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS report_liability_category_mappings_unique
  ON public.report_liability_category_mappings (COALESCE(location_id::text, 'GLOBAL'), category_key);

ALTER TABLE public.report_liability_category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read liability category mappings"
  ON public.report_liability_category_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage liability category mappings"
  ON public.report_liability_category_mappings FOR ALL
  TO authenticated
  USING (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text]))
  WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text]));

CREATE TRIGGER update_report_liability_category_mappings_updated_at
  BEFORE UPDATE ON public.report_liability_category_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.report_liability_category_mappings (location_id, category_key, account_prefixes, display_order)
VALUES
  (NULL, 'loans_given', ARRAY['212','213'], 1),
  (NULL, 'loans_taken', ARRAY['215'], 2),
  (NULL, 'province',    ARRAY['200','201'], 3),
  (NULL, 'others',      ARRAY['217'], 4)
ON CONFLICT DO NOTHING;
