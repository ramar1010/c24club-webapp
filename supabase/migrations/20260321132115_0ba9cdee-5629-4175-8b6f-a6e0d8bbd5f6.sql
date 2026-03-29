
-- Boyfriend Challenge Pairs
CREATE TABLE public.boyfriend_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL,
  invitee_id UUID,
  invite_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  days_completed INTEGER NOT NULL DEFAULT 0,
  proof_selfie_url TEXT,
  completed_at TIMESTAMPTZ,
  reward_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.boyfriend_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage boyfriend_pairs" ON public.boyfriend_pairs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own boyfriend_pairs" ON public.boyfriend_pairs FOR INSERT TO authenticated WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY "Users can read own boyfriend_pairs" ON public.boyfriend_pairs FOR SELECT TO authenticated USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);
CREATE POLICY "Users can update own boyfriend_pairs" ON public.boyfriend_pairs FOR UPDATE TO authenticated USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Boyfriend Daily Logs
CREATE TABLE public.boyfriend_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES public.boyfriend_pairs(id),
  day_number INTEGER NOT NULL,
  call_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_seconds INTEGER NOT NULL DEFAULT 0,
  inviter_screenshot_url TEXT,
  invitee_screenshot_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.boyfriend_daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage boyfriend_daily_logs" ON public.boyfriend_daily_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own boyfriend_daily_logs" ON public.boyfriend_daily_logs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM boyfriend_pairs bp WHERE bp.id = boyfriend_daily_logs.pair_id AND (bp.inviter_id = auth.uid() OR bp.invitee_id = auth.uid())));
CREATE POLICY "Users can read own boyfriend_daily_logs" ON public.boyfriend_daily_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM boyfriend_pairs bp WHERE bp.id = boyfriend_daily_logs.pair_id AND (bp.inviter_id = auth.uid() OR bp.invitee_id = auth.uid())));
CREATE POLICY "Users can update own boyfriend_daily_logs" ON public.boyfriend_daily_logs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM boyfriend_pairs bp WHERE bp.id = boyfriend_daily_logs.pair_id AND (bp.inviter_id = auth.uid() OR bp.invitee_id = auth.uid())));
