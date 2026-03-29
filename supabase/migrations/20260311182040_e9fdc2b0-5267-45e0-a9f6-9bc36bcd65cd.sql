
-- Table to store each user's total minutes balance
CREATE TABLE public.member_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_minutes integer NOT NULL DEFAULT 0,
  is_vip boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.member_minutes ENABLE ROW LEVEL SECURITY;

-- Users can read their own minutes
CREATE POLICY "Users can read own minutes" ON public.member_minutes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role handles inserts/updates via edge function

-- Table to track minutes earned per partner pair (anti-abuse)
CREATE TABLE public.call_minutes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_id text NOT NULL,
  minutes_earned integer NOT NULL DEFAULT 0,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, partner_id, session_date)
);

ALTER TABLE public.call_minutes_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own logs
CREATE POLICY "Users can read own call logs" ON public.call_minutes_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
