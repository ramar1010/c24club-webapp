
-- Referral system tables
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.referral_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'signed_up',
  engaged_at timestamptz,
  reward_amount numeric NOT NULL DEFAULT 0,
  reward_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Referral settings (admin-configurable)
CREATE TABLE public.referral_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_per_referral numeric NOT NULL DEFAULT 5.00,
  engagement_threshold_minutes integer NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default referral settings
INSERT INTO public.referral_settings (reward_per_referral, engagement_threshold_minutes) VALUES (5.00, 10);

-- Enhance weekly_challenges with reward and tracking fields
ALTER TABLE public.weekly_challenges 
  ADD COLUMN reward_type text NOT NULL DEFAULT 'freeze_free',
  ADD COLUMN reward_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN challenge_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN auto_track_action text;

-- RLS for referral_codes
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referral codes" ON public.referral_codes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own referral codes" ON public.referral_codes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage referral codes" ON public.referral_codes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS for referral_tracking
ALTER TABLE public.referral_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referrals" ON public.referral_tracking
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);

CREATE POLICY "Admins can manage referral tracking" ON public.referral_tracking
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS for referral_settings
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read referral settings" ON public.referral_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage referral settings" ON public.referral_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
