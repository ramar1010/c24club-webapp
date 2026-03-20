ALTER TABLE public.anchor_settings
  ADD COLUMN IF NOT EXISTS active_rate_cash numeric NOT NULL DEFAULT 1.50,
  ADD COLUMN IF NOT EXISTS active_rate_time integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS idle_rate_cash numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS idle_rate_time integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.anchor_settings.active_rate_cash IS 'Cash earned per active_rate_time minutes while connected to a male user';
COMMENT ON COLUMN public.anchor_settings.active_rate_time IS 'Minutes threshold for active earning (on call with a guy)';
COMMENT ON COLUMN public.anchor_settings.idle_rate_cash IS 'Cash earned per idle_rate_time minutes while waiting/not connected';
COMMENT ON COLUMN public.anchor_settings.idle_rate_time IS 'Minutes threshold for idle earning (not on a call)';