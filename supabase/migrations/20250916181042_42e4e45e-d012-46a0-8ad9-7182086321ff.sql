-- Create table for account category restrictions
CREATE TABLE public.account_category_restrictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_number_prefix TEXT NOT NULL, -- The account number without identifier (e.g., "104", "439")
  category_prefix TEXT NOT NULL, -- The location category prefix (1, 2, 3, 4, 5)
  is_restricted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_number_prefix, category_prefix)
);

-- Enable RLS
ALTER TABLE public.account_category_restrictions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and prowincjal can manage account restrictions" 
ON public.account_category_restrictions 
FOR ALL 
USING (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text]))
WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text]));

CREATE POLICY "All users can view account restrictions" 
ON public.account_category_restrictions 
FOR SELECT 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_account_category_restrictions_updated_at
BEFORE UPDATE ON public.account_category_restrictions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();