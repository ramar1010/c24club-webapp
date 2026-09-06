ALTER TABLE public.members ADD COLUMN IF NOT EXISTS timezone text;

ALTER TABLE public.anchor_settings ADD COLUMN IF NOT EXISTS live_match_slots jsonb;

UPDATE public.anchor_settings
SET live_match_slots = '[
  {"key":"utc-0000","start_utc":"00:00","end_utc":"01:00"},
  {"key":"utc-0600","start_utc":"06:00","end_utc":"07:00"},
  {"key":"utc-1200","start_utc":"12:00","end_utc":"13:00"},
  {"key":"utc-1800","start_utc":"18:00","end_utc":"19:00"}
]'::jsonb
WHERE live_match_slots IS NULL;

ALTER TABLE public.power_hour_optins ADD COLUMN IF NOT EXISTS slot_key text;

UPDATE public.power_hour_optins SET slot_key = 'legacy' WHERE slot_key IS NULL;

ALTER TABLE public.power_hour_optins ALTER COLUMN slot_key SET DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS idx_power_hour_optins_date_slot
  ON public.power_hour_optins (session_date, slot_key);
