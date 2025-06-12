
-- Check existing constraints first and only add what's missing
DO $$
BEGIN
    -- Add user_id foreign key only if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_user_id_fkey' 
        AND table_name = 'documents'
    ) THEN
        ALTER TABLE public.documents 
        ADD CONSTRAINT documents_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

-- Create RLS policies for user access
CREATE POLICY "Users can view their own documents" 
ON public.documents 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own documents" 
ON public.documents 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own documents" 
ON public.documents 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own documents" 
ON public.documents 
FOR DELETE 
USING (user_id = auth.uid());
