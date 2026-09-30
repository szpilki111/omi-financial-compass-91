ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS frozen_at date,
  ADD COLUMN IF NOT EXISTS frozen_by uuid;

CREATE OR REPLACE FUNCTION public.enforce_location_not_frozen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_frozen date;
  v_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT frozen_at, name INTO v_frozen, v_name FROM locations WHERE id = OLD.location_id AND is_active = false;
    IF v_frozen IS NOT NULL AND
       (CASE WHEN TG_TABLE_NAME = 'documents' THEN OLD.document_date ELSE OLD.date END) >= v_frozen THEN
      RAISE EXCEPTION 'Placówka "%" jest zamrożona od % – nie można usuwać dokumentów z tego okresu', v_name, v_frozen;
    END IF;
    RETURN OLD;
  END IF;

  SELECT frozen_at, name INTO v_frozen, v_name FROM locations WHERE id = NEW.location_id AND is_active = false;
  IF v_frozen IS NOT NULL AND
     (CASE WHEN TG_TABLE_NAME = 'documents' THEN NEW.document_date ELSE NEW.date END) >= v_frozen THEN
    RAISE EXCEPTION 'Placówka "%" jest zamrożona od % – nie można dodawać ani edytować dokumentów z tego okresu', v_name, v_frozen;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_location_not_frozen ON public.documents;
CREATE TRIGGER trg_enforce_location_not_frozen
  BEFORE INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_location_not_frozen();

DROP TRIGGER IF EXISTS trg_enforce_location_not_frozen ON public.transactions;
CREATE TRIGGER trg_enforce_location_not_frozen
  BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_location_not_frozen();