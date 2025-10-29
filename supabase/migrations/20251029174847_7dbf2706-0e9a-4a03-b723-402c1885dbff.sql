-- Add parent_feature_id to support subtasks
ALTER TABLE public.project_features 
ADD COLUMN parent_feature_id uuid REFERENCES public.project_features(id) ON DELETE CASCADE;

-- Create index for better performance when querying subtasks
CREATE INDEX idx_project_features_parent_id ON public.project_features(parent_feature_id);

-- Add a function to calculate parent task progress based on subtasks
CREATE OR REPLACE FUNCTION calculate_parent_progress(p_parent_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_progress integer;
BEGIN
  SELECT COALESCE(AVG(implementation_percentage)::integer, 0)
  INTO avg_progress
  FROM project_features
  WHERE parent_feature_id = p_parent_id;
  
  RETURN avg_progress;
END;
$$;