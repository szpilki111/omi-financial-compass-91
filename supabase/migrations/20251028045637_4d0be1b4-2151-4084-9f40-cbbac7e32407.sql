-- Tworzenie typu enum dla kategorii funkcjonalności
CREATE TYPE project_feature_category AS ENUM ('planned', 'done', 'remaining', 'beyond_plan');

-- Tworzenie typu enum dla statusu funkcjonalności
CREATE TYPE project_feature_status AS ENUM ('not_started', 'in_progress', 'completed');

-- Tworzenie typu enum dla priorytetu
CREATE TYPE project_feature_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Tworzenie tabeli dla śledzenia funkcjonalności projektu
CREATE TABLE public.project_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category project_feature_category NOT NULL DEFAULT 'planned',
  status project_feature_status NOT NULL DEFAULT 'not_started',
  priority project_feature_priority NOT NULL DEFAULT 'medium',
  implementation_percentage INTEGER DEFAULT 0 CHECK (implementation_percentage >= 0 AND implementation_percentage <= 100),
  notes TEXT,
  code_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Włączenie RLS
ALTER TABLE public.project_features ENABLE ROW LEVEL SECURITY;

-- Polityka: Admini i prowincjałowie mogą zarządzać funkcjonalnościami
CREATE POLICY "Admins and prowincjal can manage project features"
ON public.project_features
FOR ALL
USING (get_user_role() IN ('admin', 'prowincjal'))
WITH CHECK (get_user_role() IN ('admin', 'prowincjal'));

-- Polityka: Wszyscy mogą przeglądać funkcjonalności
CREATE POLICY "All users can view project features"
ON public.project_features
FOR SELECT
USING (true);

-- Trigger do automatycznej aktualizacji updated_at
CREATE TRIGGER update_project_features_updated_at
BEFORE UPDATE ON public.project_features
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();