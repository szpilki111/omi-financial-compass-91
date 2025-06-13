
-- Create the location_accounts table to store relationships between locations and accounts
CREATE TABLE public.location_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(location_id, account_id)
);

-- Add Row Level Security
ALTER TABLE public.location_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for location_accounts table
-- Allow authenticated users to view all location_accounts
CREATE POLICY "Users can view location accounts" 
  ON public.location_accounts 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Allow admins and prowincjal to insert location_accounts
CREATE POLICY "Admins can insert location accounts" 
  ON public.location_accounts 
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'prowincjal')
    )
  );

-- Allow admins and prowincjal to delete location_accounts
CREATE POLICY "Admins can delete location accounts" 
  ON public.location_accounts 
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'prowincjal')
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER set_location_accounts_updated_at
  BEFORE UPDATE ON public.location_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
