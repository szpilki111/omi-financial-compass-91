-- Create error_report_responses table for conversation thread
CREATE TABLE public.error_report_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  error_report_id UUID NOT NULL REFERENCES public.error_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  attachments TEXT[], -- Array of file URLs
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.error_report_responses ENABLE ROW LEVEL SECURITY;

-- Policies for error_report_responses
CREATE POLICY "Users can view responses for their reports"
ON public.error_report_responses
FOR SELECT
USING (
  error_report_id IN (
    SELECT id FROM public.error_reports WHERE user_id = auth.uid()
  ) OR get_user_role() IN ('admin', 'prowincjal')
);

CREATE POLICY "Admins can insert responses"
ON public.error_report_responses
FOR INSERT
WITH CHECK (get_user_role() IN ('admin', 'prowincjal') AND user_id = auth.uid());

CREATE POLICY "Admins can update their own responses"
ON public.error_report_responses
FOR UPDATE
USING (get_user_role() IN ('admin', 'prowincjal') AND user_id = auth.uid());

CREATE POLICY "Admins can delete their own responses"
ON public.error_report_responses
FOR DELETE
USING (get_user_role() IN ('admin', 'prowincjal') AND user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_error_report_responses_updated_at
BEFORE UPDATE ON public.error_report_responses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();