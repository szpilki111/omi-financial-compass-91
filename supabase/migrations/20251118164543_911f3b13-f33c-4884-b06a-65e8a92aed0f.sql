-- Add attachments field to budget_plans
ALTER TABLE public.budget_plans 
ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';

-- Create storage bucket for budget attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('budget-attachments', 'budget-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for budget attachments
CREATE POLICY "Users can view budget attachments for their location"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'budget-attachments' AND
  (
    -- Admins and prowincjal can see all
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'prowincjal')
    OR
    -- Ekonomowie see their location's attachments
    EXISTS (
      SELECT 1 FROM public.budget_plans bp
      WHERE bp.id::text = (storage.foldername(name))[1]
      AND bp.location_id = (SELECT location_id FROM public.profiles WHERE id = auth.uid())
    )
  )
);

CREATE POLICY "Users can upload budget attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'budget-attachments' AND
  (
    -- Admins and prowincjal can upload anywhere
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'prowincjal')
    OR
    -- Ekonomowie can upload to their location's budgets
    EXISTS (
      SELECT 1 FROM public.budget_plans bp
      WHERE bp.id::text = (storage.foldername(name))[1]
      AND bp.location_id = (SELECT location_id FROM public.profiles WHERE id = auth.uid())
    )
  )
);

CREATE POLICY "Users can delete their budget attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'budget-attachments' AND
  (
    -- Admins and prowincjal can delete all
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'prowincjal')
    OR
    -- Ekonomowie can delete their location's attachments
    EXISTS (
      SELECT 1 FROM public.budget_plans bp
      WHERE bp.id::text = (storage.foldername(name))[1]
      AND bp.location_id = (SELECT location_id FROM public.profiles WHERE id = auth.uid())
    )
  )
);