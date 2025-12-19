-- Tabela na tokeny resetu hasła (własna logika, bez Supabase Auth)
CREATE TABLE public.password_reset_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indeks na token dla szybkiego wyszukiwania
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens(token);

-- Indeks na user_id
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);

-- Enable RLS
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Polityki RLS - tokeny są zarządzane tylko przez edge functions (service_role)
-- Użytkownicy nie mają bezpośredniego dostępu

-- Funkcja do czyszczenia wygasłych tokenów
CREATE OR REPLACE FUNCTION public.cleanup_expired_password_reset_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.password_reset_tokens
  WHERE expires_at < now() - INTERVAL '1 day'
     OR used_at IS NOT NULL;
END;
$$;