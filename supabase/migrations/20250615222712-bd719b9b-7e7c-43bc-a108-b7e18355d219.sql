
-- Create function to get user settings
CREATE OR REPLACE FUNCTION get_user_setting(p_user_id UUID)
RETURNS TABLE(windows98_style BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT us.windows98_style
  FROM user_settings us
  WHERE us.user_id = p_user_id;
  
  -- If no record found, return default
  IF NOT FOUND THEN
    RETURN QUERY SELECT false AS windows98_style;
  END IF;
END;
$$;

-- Create function to upsert user settings
CREATE OR REPLACE FUNCTION upsert_user_setting(p_user_id UUID, p_windows98_style BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_settings (user_id, windows98_style, updated_at)
  VALUES (p_user_id, p_windows98_style, now())
  ON CONFLICT (user_id)
  DO UPDATE SET 
    windows98_style = EXCLUDED.windows98_style,
    updated_at = now();
END;
$$;
