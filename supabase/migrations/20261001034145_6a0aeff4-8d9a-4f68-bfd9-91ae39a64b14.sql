DROP TRIGGER IF EXISTS trg_enforce_location_not_frozen ON public.documents;
DROP TRIGGER IF EXISTS trg_enforce_location_not_frozen ON public.transactions;
DROP FUNCTION IF EXISTS public.enforce_location_not_frozen();

CREATE OR REPLACE FUNCTION public.enforce_document_location_not_frozen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_frozen date; v_name text; r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  SELECT frozen_at, name INTO v_frozen, v_name FROM locations WHERE id = r.location_id AND is_active = false;
  IF v_frozen IS NOT NULL AND r.document_date >= v_frozen THEN
    RAISE EXCEPTION 'Placówka "%" jest zamrożona od % – nie można dodawać, edytować ani usuwać dokumentów z tego okresu', v_name, v_frozen;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_transaction_location_not_frozen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_frozen date; v_name text; r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  SELECT frozen_at, name INTO v_frozen, v_name FROM locations WHERE id = r.location_id AND is_active = false;
  IF v_frozen IS NOT NULL AND r.date >= v_frozen THEN
    RAISE EXCEPTION 'Placówka "%" jest zamrożona od % – nie można dodawać, edytować ani usuwać operacji z tego okresu', v_name, v_frozen;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.enforce_document_location_not_frozen() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_transaction_location_not_frozen() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_enforce_location_not_frozen BEFORE INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_document_location_not_frozen();
CREATE TRIGGER trg_enforce_location_not_frozen BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_transaction_location_not_frozen();