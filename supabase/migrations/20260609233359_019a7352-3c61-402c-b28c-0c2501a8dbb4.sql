CREATE TABLE public.vip_purchase_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL,
  price_id TEXT,
  tier TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vip_purchase_intents_user ON public.vip_purchase_intents(user_id);
CREATE INDEX idx_vip_purchase_intents_source ON public.vip_purchase_intents(source);
CREATE INDEX idx_vip_purchase_intents_created ON public.vip_purchase_intents(created_at DESC);

GRANT SELECT, INSERT ON public.vip_purchase_intents TO authenticated;
GRANT ALL ON public.vip_purchase_intents TO service_role;

ALTER TABLE public.vip_purchase_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own intents"
  ON public.vip_purchase_intents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own intents"
  ON public.vip_purchase_intents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all intents"
  ON public.vip_purchase_intents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));