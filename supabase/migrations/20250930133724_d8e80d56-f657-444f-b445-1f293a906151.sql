-- Add email column to user_login_events to track login attempts for non-existent users
ALTER TABLE public.user_login_events ADD COLUMN IF NOT EXISTS email text;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_login_events_email ON public.user_login_events(email);

-- Make user_id nullable since we might not have a user_id for non-existent emails
ALTER TABLE public.user_login_events ALTER COLUMN user_id DROP NOT NULL;