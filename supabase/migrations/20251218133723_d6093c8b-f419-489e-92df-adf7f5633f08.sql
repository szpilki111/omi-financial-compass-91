-- Function to get admin emails, bypassing RLS
-- This allows any authenticated user to get admin/prowincjal emails for notifications
CREATE OR REPLACE FUNCTION public.get_admin_emails()
RETURNS TABLE (id uuid, email text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.name
  FROM profiles p
  WHERE p.role IN ('admin', 'prowincjal')
    AND p.email IS NOT NULL
$$;