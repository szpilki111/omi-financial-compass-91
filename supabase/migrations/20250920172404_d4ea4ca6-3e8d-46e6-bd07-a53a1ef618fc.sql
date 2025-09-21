-- Dodaj pole analytical do tabeli accounts
ALTER TABLE public.accounts ADD COLUMN analytical boolean NOT NULL DEFAULT false;

-- Stwórz tabelę dla kont analitycznych (podkont)
CREATE TABLE public.analytical_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  number_suffix text NOT NULL, -- np. "1", "2", "3" dla 400-2-1-1, 400-2-1-2, itd.
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(parent_account_id, location_id, number_suffix)
);

-- Włącz RLS dla tabeli analytical_accounts
ALTER TABLE public.analytical_accounts ENABLE ROW LEVEL SECURITY;

-- Polityki RLS dla analytical_accounts
-- Ekonomowie widzą tylko swoje podkonta
CREATE POLICY "Ekonomowie widzą podkonta swojej placówki" 
ON public.analytical_accounts 
FOR SELECT 
USING (
  CASE
    WHEN get_user_role() = 'ekonom' THEN location_id = get_user_location_id()
    ELSE true
  END
);

-- Ekonomowie mogą tworzyć podkonta dla swojej placówki
CREATE POLICY "Ekonomowie tworzą podkonta dla swojej placówki" 
ON public.analytical_accounts 
FOR INSERT 
WITH CHECK (
  CASE
    WHEN get_user_role() = 'ekonom' THEN location_id = get_user_location_id() AND created_by = auth.uid()
    ELSE get_user_role() IN ('admin', 'prowincjal')
  END
);

-- Ekonomowie mogą edytować swoje podkonta
CREATE POLICY "Ekonomowie edytują podkonta swojej placówki" 
ON public.analytical_accounts 
FOR UPDATE 
USING (
  CASE
    WHEN get_user_role() = 'ekonom' THEN location_id = get_user_location_id()
    ELSE true
  END
);

-- Ekonomowie mogą usuwać swoje podkonta
CREATE POLICY "Ekonomowie usuwają podkonta swojej placówki" 
ON public.analytical_accounts 
FOR DELETE 
USING (
  CASE
    WHEN get_user_role() = 'ekonom' THEN location_id = get_user_location_id()
    ELSE true
  END
);

-- Prowincjałowie i admini zarządzają wszystkimi podkontami
CREATE POLICY "Admini i prowincjałowie zarządzają wszystkimi podkontami" 
ON public.analytical_accounts 
FOR ALL 
USING (get_user_role() IN ('admin', 'prowincjal'))
WITH CHECK (get_user_role() IN ('admin', 'prowincjal'));

-- Dodaj trigger dla updated_at
CREATE TRIGGER update_analytical_accounts_updated_at
  BEFORE UPDATE ON public.analytical_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();