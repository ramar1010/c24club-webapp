
-- Table to track individual wagers and results
CREATE TABLE public.minute_wagers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wager_amount integer NOT NULL,
  outcome text NOT NULL DEFAULT 'pending',
  prize_type text,
  prize_amount numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.minute_wagers ENABLE ROW LEVEL SECURITY;

-- Users can read own wagers
CREATE POLICY "Users can read own wagers"
  ON public.minute_wagers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can manage all wagers
CREATE POLICY "Admins can manage wagers"
  ON public.minute_wagers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Wager settings table for admin configuration
CREATE TABLE public.wager_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  max_daily_wagers integer NOT NULL DEFAULT 3,
  max_weekly_wagers integer NOT NULL DEFAULT 10,
  min_wager_minutes integer NOT NULL DEFAULT 10,
  max_wager_minutes integer NOT NULL DEFAULT 100,
  jackpot_amount numeric NOT NULL DEFAULT 200,
  jackpot_chance_percent numeric NOT NULL DEFAULT 0.5,
  double_chance_percent numeric NOT NULL DEFAULT 30,
  lose_chance_percent numeric NOT NULL DEFAULT 50,
  cash_win_chance_percent numeric NOT NULL DEFAULT 19.5,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wager_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read wager_settings"
  ON public.wager_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage wager_settings"
  ON public.wager_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.wager_settings (max_daily_wagers, max_weekly_wagers, min_wager_minutes, max_wager_minutes, jackpot_amount, jackpot_chance_percent, double_chance_percent, lose_chance_percent, cash_win_chance_percent)
VALUES (3, 10, 10, 100, 200, 0.5, 30, 50, 19.5);
