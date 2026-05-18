
-- Nowa rola "superior": pełen odczyt swoich placówek, brak zapisu.
-- Polityki SELECT są role-agnostyczne (else branch po location_id), więc superior
-- automatycznie widzi wszystko po wpisach w user_locations.
-- Wprowadzamy twardy bezpiecznik: trigger blokujący zapis dla roli superior.

CREATE OR REPLACE FUNCTION public.block_superior_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role() = 'superior' THEN
    RAISE EXCEPTION 'Rola superior nie ma uprawnień do zapisu (tabela: %)', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Helper do podpinania triggera
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'documents',
    'transactions',
    'reports',
    'report_account_details',
    'budget_plans',
    'budget_items',
    'accounts',
    'analytical_accounts',
    'calendar_events',
    'location_settings',
    'location_accounts',
    'locations',
    'knowledge_documents',
    'knowledge_user_media',
    'provincial_fee_accounts',
    'provincial_fee_account_exclusions',
    'provincial_fee_settings',
    'account_section_mappings',
    'account_category_restrictions',
    'budget_categories',
    'budget_category_mappings',
    'admin_notes',
    'app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_block_superior_writes ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_block_superior_writes
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.block_superior_writes()',
      t
    );
  END LOOP;
END$$;
