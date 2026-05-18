ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin','prowincjal','ekonom','proboszcz','asystent','asystent_ekonoma_prowincjalnego','ekonom_prowincjalny','superior'));