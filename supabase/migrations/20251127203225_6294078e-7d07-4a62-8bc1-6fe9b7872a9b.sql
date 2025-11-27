-- ETAP 1: Tabela logów przypomnień
CREATE TABLE public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- '5_days', '1_day', 'overdue'
  sent_at TIMESTAMPTZ DEFAULT now(),
  recipient_email TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS dla reminder_logs
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admini widzą wszystkie logi" ON public.reminder_logs
FOR SELECT USING (get_user_role() IN ('admin', 'prowincjal'));

CREATE POLICY "Ekonomowie widzą logi swojej lokalizacji" ON public.reminder_logs
FOR SELECT USING (
  get_user_role() = 'ekonom' AND location_id = get_user_location_id()
);

-- ETAP 4: Historia kursów walut
CREATE TABLE public.exchange_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL,
  rate DECIMAL(10,6) NOT NULL,
  source TEXT DEFAULT 'NBP',
  fetched_at TIMESTAMPTZ DEFAULT now(),
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(currency_code, effective_date)
);

-- RLS dla exchange_rate_history
ALTER TABLE public.exchange_rate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wszyscy mogą widzieć historię kursów" ON public.exchange_rate_history
FOR SELECT USING (true);

CREATE POLICY "Admini mogą zarządzać historią kursów" ON public.exchange_rate_history
FOR ALL USING (get_user_role() IN ('admin', 'prowincjal'))
WITH CHECK (get_user_role() IN ('admin', 'prowincjal'));

-- ETAP 5: Baza wiedzy - dokumenty
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  category TEXT NOT NULL DEFAULT 'other', -- 'procedures', 'templates', 'guides', 'other'
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS dla knowledge_documents
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wszyscy mogą widzieć dokumenty" ON public.knowledge_documents
FOR SELECT USING (true);

CREATE POLICY "Admini mogą zarządzać dokumentami" ON public.knowledge_documents
FOR ALL USING (get_user_role() IN ('admin', 'prowincjal'))
WITH CHECK (get_user_role() IN ('admin', 'prowincjal'));

-- ETAP 5: Baza wiedzy - notatki administracyjne
CREATE TABLE public.admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  location_id UUID REFERENCES public.locations(id), -- NULL = globalna
  created_by UUID REFERENCES public.profiles(id),
  visible_to TEXT[] DEFAULT ARRAY['ekonom', 'proboszcz', 'prowincjal', 'admin'],
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS dla admin_notes
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Użytkownicy widzą notatki dla swojej roli" ON public.admin_notes
FOR SELECT USING (
  get_user_role() = ANY(visible_to) AND (
    location_id IS NULL OR 
    get_user_role() IN ('admin', 'prowincjal') OR
    location_id = get_user_location_id()
  )
);

CREATE POLICY "Admini mogą zarządzać notatkami" ON public.admin_notes
FOR ALL USING (get_user_role() IN ('admin', 'prowincjal'))
WITH CHECK (get_user_role() IN ('admin', 'prowincjal'));

-- Storage bucket dla bazy wiedzy
INSERT INTO storage.buckets (id, name, public) 
VALUES ('knowledge-base', 'knowledge-base', true)
ON CONFLICT (id) DO NOTHING;

-- Polityki storage dla knowledge-base
CREATE POLICY "Wszyscy mogą pobierać dokumenty z bazy wiedzy"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledge-base');

CREATE POLICY "Admini mogą uploadować do bazy wiedzy"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'knowledge-base' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'prowincjal')
);

CREATE POLICY "Admini mogą usuwać z bazy wiedzy"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'knowledge-base' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'prowincjal')
);

-- Indeksy dla wydajności
CREATE INDEX idx_reminder_logs_location ON public.reminder_logs(location_id);
CREATE INDEX idx_reminder_logs_date ON public.reminder_logs(year, month);
CREATE INDEX idx_exchange_rate_history_currency ON public.exchange_rate_history(currency_code);
CREATE INDEX idx_exchange_rate_history_date ON public.exchange_rate_history(effective_date);
CREATE INDEX idx_knowledge_documents_category ON public.knowledge_documents(category);
CREATE INDEX idx_admin_notes_location ON public.admin_notes(location_id);
CREATE INDEX idx_admin_notes_pinned ON public.admin_notes(pinned);