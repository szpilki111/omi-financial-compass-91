-- Create enum types for error reports
CREATE TYPE error_report_status AS ENUM ('new', 'in_progress', 'resolved', 'closed');
CREATE TYPE error_report_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Create error_reports table
CREATE TABLE public.error_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  page_url TEXT NOT NULL,
  browser_info JSONB,
  screenshot_url TEXT,
  additional_files TEXT[],
  status error_report_status NOT NULL DEFAULT 'new',
  priority error_report_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for error_reports
CREATE POLICY "Users can view their own reports"
ON public.error_reports
FOR SELECT
USING (user_id = auth.uid() OR get_user_role() IN ('admin', 'prowincjal'));

CREATE POLICY "Users can create their own reports"
ON public.error_reports
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update all reports"
ON public.error_reports
FOR UPDATE
USING (get_user_role() IN ('admin', 'prowincjal'));

CREATE POLICY "Admins can delete reports"
ON public.error_reports
FOR DELETE
USING (get_user_role() IN ('admin', 'prowincjal'));

-- Create storage bucket for error reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('error-reports', 'error-reports', false);

-- Storage policies for error-reports bucket
CREATE POLICY "Users can upload their error report files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'error-reports' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own error report files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'error-reports' AND
  (auth.uid()::text = (storage.foldername(name))[1] OR get_user_role() IN ('admin', 'prowincjal'))
);

CREATE POLICY "Admins can view all error report files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'error-reports' AND
  get_user_role() IN ('admin', 'prowincjal')
);

-- Trigger for updated_at
CREATE TRIGGER set_error_reports_updated_at
BEFORE UPDATE ON public.error_reports
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();