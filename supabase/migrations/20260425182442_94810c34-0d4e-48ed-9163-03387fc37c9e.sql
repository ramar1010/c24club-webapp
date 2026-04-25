CREATE TABLE public.reddit_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT,
  email TEXT,
  recovery_email TEXT,
  karma INTEGER NOT NULL DEFAULT 0,
  account_age_days INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'warming' CHECK (status IN ('warming', 'ready', 'banned', 'retired')),
  notes TEXT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reddit_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reddit_accounts"
ON public.reddit_accounts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_reddit_accounts_updated_at
BEFORE UPDATE ON public.reddit_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_reddit_accounts_status ON public.reddit_accounts(status);