
CREATE TABLE public.anchor_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  challenge_type TEXT NOT NULL DEFAULT 'videochat',
  target_count INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.anchor_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage anchor_challenges"
  ON public.anchor_challenges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read active anchor_challenges"
  ON public.anchor_challenges FOR SELECT TO authenticated
  USING (is_active = true);
