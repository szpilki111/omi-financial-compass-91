
-- Tworzenie tabeli dla dokumentów
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_number TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_date DATE NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Dodanie indeksów dla lepszej wydajności wyszukiwania
CREATE INDEX idx_documents_document_number ON public.documents(document_number);
CREATE INDEX idx_documents_document_name ON public.documents(document_name);
CREATE INDEX idx_documents_document_date ON public.documents(document_date);
CREATE INDEX idx_documents_location_id ON public.documents(location_id);

-- Dodanie pola document_id do istniejącej tabeli transactions
ALTER TABLE public.transactions 
ADD COLUMN document_id UUID REFERENCES public.documents(id);

-- Dodanie indeksu dla document_id w transactions
CREATE INDEX idx_transactions_document_id ON public.transactions(document_id);

-- Utworzenie tabeli dla ustawień lokalizacji (skróty domów)
CREATE TABLE public.location_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) UNIQUE,
  house_abbreviation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Dodanie polityk RLS dla tabeli documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Ekonomowie widzą tylko dokumenty ze swojej lokalizacji
CREATE POLICY "Users can view documents from their location" 
  ON public.documents 
  FOR SELECT 
  USING (
    CASE 
      WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ekonom' 
      THEN location_id = (SELECT location_id FROM public.profiles WHERE id = auth.uid())
      ELSE true
    END
  );

-- Ekonomowie mogą tworzyć dokumenty tylko dla swojej lokalizacji
CREATE POLICY "Users can create documents for their location" 
  ON public.documents 
  FOR INSERT 
  WITH CHECK (
    CASE 
      WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ekonom' 
      THEN location_id = (SELECT location_id FROM public.profiles WHERE id = auth.uid())
      ELSE true
    END
  );

-- Ekonomowie mogą edytować dokumenty tylko ze swojej lokalizacji
CREATE POLICY "Users can update documents from their location" 
  ON public.documents 
  FOR UPDATE 
  USING (
    CASE 
      WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ekonom' 
      THEN location_id = (SELECT location_id FROM public.profiles WHERE id = auth.uid())
      ELSE true
    END
  );

-- Ekonomowie mogą usuwać dokumenty tylko ze swojej lokalizacji
CREATE POLICY "Users can delete documents from their location" 
  ON public.documents 
  FOR DELETE 
  USING (
    CASE 
      WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ekonom' 
      THEN location_id = (SELECT location_id FROM public.profiles WHERE id = auth.uid())
      ELSE true
    END
  );

-- Dodanie polityk RLS dla tabeli location_settings
ALTER TABLE public.location_settings ENABLE ROW LEVEL SECURITY;

-- Tylko prowincjałowie i administratorzy mogą zarządzać ustawieniami lokalizacji
CREATE POLICY "Admin and prowincjal can manage location settings" 
  ON public.location_settings 
  FOR ALL 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('prowincjal', 'admin'));

-- Wszyscy użytkownicy mogą odczytać ustawienia lokalizacji
CREATE POLICY "All users can view location settings" 
  ON public.location_settings 
  FOR SELECT 
  USING (true);

-- Dodanie triggera do automatycznej aktualizacji updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_location_settings_updated_at
  BEFORE UPDATE ON public.location_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
