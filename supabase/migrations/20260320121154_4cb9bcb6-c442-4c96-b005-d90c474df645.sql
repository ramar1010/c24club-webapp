
-- Table to track per-user, per-challenge progress with weekly reset
CREATE TABLE public.anchor_challenge_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_id UUID NOT NULL REFERENCES public.anchor_challenges(id) ON DELETE CASCADE,
  unique_partners TEXT[] NOT NULL DEFAULT '{}',
  week_start DATE NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
  completed_at TIMESTAMP WITH TIME ZONE,
  rewarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id, week_start)
);

ALTER TABLE public.anchor_challenge_progress ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage anchor_challenge_progress"
  ON public.anchor_challenge_progress FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can read own progress
CREATE POLICY "Users can read own challenge progress"
  ON public.anchor_challenge_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
