
-- Table to track daily lucky spin earnings per user
CREATE TABLE public.waiting_spin_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  spin_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, spin_date)
);

ALTER TABLE public.waiting_spin_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own spin earnings"
  ON public.waiting_spin_earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage spin earnings"
  ON public.waiting_spin_earnings FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admin settings for lucky spin
CREATE TABLE public.lucky_spin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  spin_interval_ms integer NOT NULL DEFAULT 5000,
  daily_cap_cents integer NOT NULL DEFAULT 500,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lucky_spin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lucky_spin_settings"
  ON public.lucky_spin_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read lucky_spin_settings"
  ON public.lucky_spin_settings FOR SELECT
  TO authenticated
  USING (true);

-- Seed default settings
INSERT INTO public.lucky_spin_settings (is_enabled, spin_interval_ms, daily_cap_cents)
VALUES (true, 5000, 500);
