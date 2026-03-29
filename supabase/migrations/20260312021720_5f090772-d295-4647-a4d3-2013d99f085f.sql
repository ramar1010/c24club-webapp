
-- Freeze settings (admin configurable)
CREATE TABLE public.freeze_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minute_threshold integer NOT NULL DEFAULT 400,
  frozen_earn_rate integer NOT NULL DEFAULT 2,
  vip_unfreezes_per_month integer NOT NULL DEFAULT 3,
  one_time_unfreeze_price numeric NOT NULL DEFAULT 1.99,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.freeze_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage freeze_settings" ON public.freeze_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read freeze_settings" ON public.freeze_settings
  FOR SELECT TO authenticated
  USING (true);

-- Insert default settings
INSERT INTO public.freeze_settings (minute_threshold, frozen_earn_rate, vip_unfreezes_per_month, one_time_unfreeze_price)
VALUES (400, 2, 3, 1.99);

-- Add freeze tracking columns to member_minutes
ALTER TABLE public.member_minutes
  ADD COLUMN is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN frozen_at timestamp with time zone DEFAULT null,
  ADD COLUMN freeze_free_until timestamp with time zone DEFAULT null,
  ADD COLUMN vip_unfreezes_used integer NOT NULL DEFAULT 0,
  ADD COLUMN vip_unfreezes_reset_at timestamp with time zone DEFAULT null;

-- Weekly challenges table
CREATE TABLE public.weekly_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage challenges" ON public.weekly_challenges
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read active challenges" ON public.weekly_challenges
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Challenge submissions
CREATE TABLE public.challenge_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.weekly_challenges(id) ON DELETE CASCADE,
  proof_text text,
  proof_image_url text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own submissions" ON public.challenge_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own submissions" ON public.challenge_submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage submissions" ON public.challenge_submissions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
