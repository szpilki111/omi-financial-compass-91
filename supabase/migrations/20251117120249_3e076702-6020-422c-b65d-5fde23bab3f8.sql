-- Tabela główna budżetów
CREATE TABLE public.budget_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, approved, rejected
  
  -- Metoda prognozowania
  forecast_method TEXT NOT NULL DEFAULT 'last_year', -- last_year, avg_3_years, manual
  
  -- Modyfikatory budżetu
  additional_expenses NUMERIC DEFAULT 0,
  additional_expenses_description TEXT,
  planned_cost_reduction NUMERIC DEFAULT 0,
  planned_cost_reduction_description TEXT,
  
  -- Komentarze
  comments TEXT,
  rejection_reason TEXT,
  
  -- Metadata
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  submitted_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES public.profiles(id),
  
  UNIQUE(location_id, year)
);

-- Tabela pozycji budżetowych
CREATE TABLE public.budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_plan_id UUID NOT NULL REFERENCES public.budget_plans(id) ON DELETE CASCADE,
  
  account_prefix TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL, -- 'income' lub 'expense'
  
  planned_amount NUMERIC NOT NULL DEFAULT 0,
  forecasted_amount NUMERIC,
  previous_year_amount NUMERIC,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(budget_plan_id, account_prefix)
);

-- Tabela kategorii budżetowych
CREATE TABLE public.budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela mapowania kont na kategorie
CREATE TABLE public.budget_category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.budget_categories(id) ON DELETE CASCADE,
  account_prefix TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category_id, account_prefix)
);

-- Enable RLS
ALTER TABLE public.budget_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_category_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies dla budget_plans
CREATE POLICY "Ekonomowie mogą tworzyć budżety dla swojej lokalizacji"
ON public.budget_plans FOR INSERT
WITH CHECK (
  (get_user_role() = 'ekonom' AND location_id = get_user_location_id()) 
  OR get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text])
);

CREATE POLICY "Ekonomowie mogą edytować budżety draft swojej lokalizacji"
ON public.budget_plans FOR UPDATE
USING (
  ((get_user_role() = 'ekonom' AND location_id = get_user_location_id() AND status = 'draft') 
  OR get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text]))
);

CREATE POLICY "Użytkownicy widzą budżety swojej lokalizacji"
ON public.budget_plans FOR SELECT
USING (
  CASE
    WHEN (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text])) THEN true
    ELSE location_id = get_user_location_id()
  END
);

CREATE POLICY "Admin i prowincjał mogą usuwać budżety"
ON public.budget_plans FOR DELETE
USING (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text]));

-- RLS Policies dla budget_items
CREATE POLICY "Użytkownicy mogą zarządzać pozycjami swojego budżetu"
ON public.budget_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.budget_plans bp
    WHERE bp.id = budget_items.budget_plan_id
    AND (
      (get_user_role() = 'ekonom' AND bp.location_id = get_user_location_id() AND bp.status = 'draft')
      OR get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text])
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budget_plans bp
    WHERE bp.id = budget_items.budget_plan_id
    AND (
      (get_user_role() = 'ekonom' AND bp.location_id = get_user_location_id() AND bp.status = 'draft')
      OR get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text])
    )
  )
);

CREATE POLICY "Użytkownicy widzą pozycje budżetów swojej lokalizacji"
ON public.budget_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.budget_plans bp
    WHERE bp.id = budget_items.budget_plan_id
    AND (
      CASE
        WHEN (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text])) THEN true
        ELSE bp.location_id = get_user_location_id()
      END
    )
  )
);

-- RLS Policies dla kategorii (publiczne)
CREATE POLICY "Wszyscy widzą kategorie"
ON public.budget_categories FOR SELECT
USING (true);

CREATE POLICY "Admin może zarządzać kategoriami"
ON public.budget_categories FOR ALL
USING (get_user_role() = 'admin')
WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Wszyscy widzą mapowania"
ON public.budget_category_mappings FOR SELECT
USING (true);

CREATE POLICY "Admin może zarządzać mapowaniami"
ON public.budget_category_mappings FOR ALL
USING (get_user_role() = 'admin')
WITH CHECK (get_user_role() = 'admin');

-- Trigger do automatycznego update updated_at
CREATE OR REPLACE FUNCTION update_budget_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_budget_plans_updated_at
BEFORE UPDATE ON public.budget_plans
FOR EACH ROW
EXECUTE FUNCTION update_budget_updated_at();

CREATE TRIGGER update_budget_items_updated_at
BEFORE UPDATE ON public.budget_items
FOR EACH ROW
EXECUTE FUNCTION update_budget_updated_at();

-- Wstaw domyślne kategorie
INSERT INTO public.budget_categories (name, account_type, sort_order) VALUES
('Funkcjonowanie domu', 'expense', 1),
('Podróże i samochody', 'expense', 2),
('Płace pracowników', 'expense', 3),
('Osobiste', 'expense', 4),
('Formacja', 'expense', 5),
('Leczenie', 'expense', 6),
('Kult', 'expense', 7),
('Książki', 'expense', 8),
('Kuchnia i salon', 'expense', 9),
('Media i energia', 'expense', 10),
('Remonty', 'expense', 11),
('Świadczenia', 'expense', 12),
('Intencje i duszpasterstwo', 'income', 1),
('Pensje i emerytury', 'income', 2),
('Działalność gospodarcza', 'income', 3),
('Inne przychody', 'income', 4);