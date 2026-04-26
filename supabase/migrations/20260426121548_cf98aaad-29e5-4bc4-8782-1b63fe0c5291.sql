
-- Log every native in-app purchase verification for admin visibility
CREATE TABLE IF NOT EXISTS public.iap_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,            -- 'ios' | 'android'
  sku text NOT NULL,                 -- product SKU sent from native app
  action text NOT NULL,              -- verify-subscription | verify-minutes | verify-gift | verify-unfreeze
  vip_tier text,                     -- 'basic' | 'premium' (for subscription)
  minutes_added integer,             -- for minute / gift packs
  recipient_id uuid,                 -- for gifts
  purchase_token_hash text,          -- last 12 chars of token for traceability (NEVER raw token)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iap_purchases_user_id_idx ON public.iap_purchases(user_id);
CREATE INDEX IF NOT EXISTS iap_purchases_created_at_idx ON public.iap_purchases(created_at DESC);

ALTER TABLE public.iap_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage iap_purchases"
ON public.iap_purchases
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own iap_purchases"
ON public.iap_purchases
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
