
ALTER TABLE public.member_minutes 
  ADD COLUMN IF NOT EXISTS login_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_login_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS streak_rewards_claimed jsonb NOT NULL DEFAULT '[]'::jsonb;
