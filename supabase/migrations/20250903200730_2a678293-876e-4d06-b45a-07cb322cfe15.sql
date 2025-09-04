-- 1) Add blocked flag to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

-- 2) Create user_login_events table for auditing logins
CREATE TABLE IF NOT EXISTS public.user_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  error_message text
);

-- Enable RLS
ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;

-- Policies: admins and prowincjal can view all events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_login_events' AND policyname = 'Admins and prowincjal can select all login events'
  ) THEN
    CREATE POLICY "Admins and prowincjal can select all login events"
    ON public.user_login_events
    FOR SELECT
    USING (public.get_user_role() IN ('admin', 'prowincjal'));
  END IF;

  -- Users can view their own events (optional, harmless)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_login_events' AND policyname = 'Users can view their own login events'
  ) THEN
    CREATE POLICY "Users can view their own login events"
    ON public.user_login_events
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END$$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_login_events_user_id ON public.user_login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_events_user_id_created_at ON public.user_login_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_login_events_user_id_success_created_at ON public.user_login_events(user_id, success, created_at DESC);
