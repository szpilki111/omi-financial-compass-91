-- Utwórz tabelę wydarzeń kalendarza
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('deadline', 'reminder', 'meeting', 'celebration', 'other')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  is_recurring BOOLEAN DEFAULT false,
  recurring_pattern TEXT CHECK (recurring_pattern IN ('yearly', 'monthly', 'weekly') OR recurring_pattern IS NULL),
  is_global BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Włącz RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Polityki RLS
-- Wszyscy mogą widzieć wydarzenia globalne
CREATE POLICY "Users can view global events"
ON public.calendar_events
FOR SELECT
USING (is_global = true);

-- Użytkownicy widzą wydarzenia swojej lokalizacji
CREATE POLICY "Users can view location events"
ON public.calendar_events
FOR SELECT
USING (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    ELSE location_id = get_user_location_id()
  END
);

-- Ekonomowie mogą tworzyć wydarzenia dla swojej lokalizacji
CREATE POLICY "Economists can create location events"
ON public.calendar_events
FOR INSERT
WITH CHECK (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    WHEN get_user_role() = 'ekonom' THEN location_id = get_user_location_id() AND created_by = auth.uid()
    ELSE false
  END
);

-- Użytkownicy mogą edytować swoje wydarzenia
CREATE POLICY "Users can update own events"
ON public.calendar_events
FOR UPDATE
USING (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    ELSE created_by = auth.uid()
  END
);

-- Użytkownicy mogą usuwać swoje wydarzenia
CREATE POLICY "Users can delete own events"
ON public.calendar_events
FOR DELETE
USING (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    ELSE created_by = auth.uid()
  END
);

-- Trigger dla updated_at
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Indeksy
CREATE INDEX idx_calendar_events_location_date ON public.calendar_events(location_id, event_date);
CREATE INDEX idx_calendar_events_date ON public.calendar_events(event_date);
CREATE INDEX idx_calendar_events_type ON public.calendar_events(event_type);