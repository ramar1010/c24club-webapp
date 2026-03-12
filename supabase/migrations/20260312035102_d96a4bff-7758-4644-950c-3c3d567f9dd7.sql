
CREATE TABLE public.gift_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  minutes_amount INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own gifts sent or received"
  ON public.gift_transactions FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert own gifts"
  ON public.gift_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Admins can manage all gifts"
  ON public.gift_transactions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
