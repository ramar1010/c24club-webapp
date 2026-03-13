
-- Anchor system settings (admin-configurable)
CREATE TABLE public.anchor_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  max_anchor_cap integer NOT NULL DEFAULT 5,
  chill_hour_start text NOT NULL DEFAULT '00:00',
  power_hour_start text NOT NULL DEFAULT '19:00',
  power_hour_end text NOT NULL DEFAULT '00:00',
  power_rate_cash numeric NOT NULL DEFAULT 1.50,
  power_rate_time integer NOT NULL DEFAULT 30,
  chill_reward_time integer NOT NULL DEFAULT 45,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO public.anchor_settings (id) VALUES (gen_random_uuid());

-- Active anchor sessions (tracks who's earning, their progress)
CREATE TABLE public.anchor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_mode text NOT NULL DEFAULT 'chill',
  elapsed_seconds integer NOT NULL DEFAULT 0,
  cash_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Anchor queue (FIFO for users waiting for a slot)
CREATE TABLE public.anchor_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Anchor earnings log (history of rewards and cash earned)
CREATE TABLE public.anchor_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  earning_type text NOT NULL DEFAULT 'cash',
  amount numeric NOT NULL DEFAULT 0,
  reward_id uuid REFERENCES public.rewards(id),
  reward_title text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Anchor payouts (PayPal cashouts)
CREATE TABLE public.anchor_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paypal_email text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.anchor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anchor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anchor_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anchor_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anchor_payouts ENABLE ROW LEVEL SECURITY;

-- anchor_settings: admins manage, authenticated read
CREATE POLICY "Admins can manage anchor_settings" ON public.anchor_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read anchor_settings" ON public.anchor_settings FOR SELECT TO authenticated USING (true);

-- anchor_sessions: admins manage all, users manage own
CREATE POLICY "Admins can manage anchor_sessions" ON public.anchor_sessions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own anchor_session" ON public.anchor_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own anchor_session" ON public.anchor_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own anchor_session" ON public.anchor_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own anchor_session" ON public.anchor_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- anchor_queue: admins manage all, users manage own
CREATE POLICY "Admins can manage anchor_queue" ON public.anchor_queue FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage own queue entry" ON public.anchor_queue FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- anchor_earnings: admins manage all, users read own
CREATE POLICY "Admins can manage anchor_earnings" ON public.anchor_earnings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own anchor_earnings" ON public.anchor_earnings FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- anchor_payouts: admins manage all, users manage own
CREATE POLICY "Admins can manage anchor_payouts" ON public.anchor_payouts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own anchor_payouts" ON public.anchor_payouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own anchor_payouts" ON public.anchor_payouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
