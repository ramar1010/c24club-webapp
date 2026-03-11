
CREATE TABLE public.member_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL,
  reward_title TEXT NOT NULL,
  reward_image_url TEXT,
  reward_rarity TEXT NOT NULL DEFAULT 'common',
  reward_type TEXT NOT NULL DEFAULT 'product',
  minutes_cost INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  shipping_name TEXT,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_country TEXT,
  cashout_amount NUMERIC,
  cashout_paypal TEXT,
  cashout_status TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.member_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions"
  ON public.member_redemptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all redemptions"
  ON public.member_redemptions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own redemptions"
  ON public.member_redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update all redemptions"
  ON public.member_redemptions
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
