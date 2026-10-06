ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS location_name_snapshot text;
UPDATE public.documents d SET location_name_snapshot = l.name FROM public.locations l WHERE l.id = d.location_id AND d.location_name_snapshot IS NULL;
CREATE OR REPLACE FUNCTION public.set_document_location_name_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.location_id IS DISTINCT FROM OLD.location_id OR NEW.location_name_snapshot IS NULL THEN
    SELECT name INTO NEW.location_name_snapshot FROM public.locations WHERE id = NEW.location_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_document_location_name_snapshot ON public.documents;
CREATE TRIGGER trg_document_location_name_snapshot BEFORE INSERT OR UPDATE OF location_id, location_name_snapshot ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_document_location_name_snapshot();