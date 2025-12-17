-- Add account deactivation columns
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS deactivated_at timestamp with time zone;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES auth.users(id);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS deactivation_reason text;

-- Create index for faster filtering by active status
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON public.accounts(is_active);

-- Update all existing accounts to be active (in case any have NULL)
UPDATE public.accounts SET is_active = true WHERE is_active IS NULL;