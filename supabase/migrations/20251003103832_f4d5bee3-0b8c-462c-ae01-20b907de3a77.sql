-- Fix error_reports foreign key to auth.users
ALTER TABLE public.error_reports
DROP CONSTRAINT IF EXISTS error_reports_user_id_fkey;

ALTER TABLE public.error_reports
ADD CONSTRAINT error_reports_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Fix error_report_responses foreign key to auth.users
ALTER TABLE public.error_report_responses
DROP CONSTRAINT IF EXISTS error_report_responses_user_id_fkey;

ALTER TABLE public.error_report_responses
ADD CONSTRAINT error_report_responses_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;