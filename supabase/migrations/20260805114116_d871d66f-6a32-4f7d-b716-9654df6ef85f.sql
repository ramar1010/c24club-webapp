ALTER TABLE public.member_minutes
  ADD COLUMN IF NOT EXISTS call_earned_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE public.cashout_settings
  ADD COLUMN IF NOT EXISTS call_rate_per_minute numeric NOT NULL DEFAULT 0.20;

UPDATE public.cashout_settings SET call_rate_per_minute = 0.20;