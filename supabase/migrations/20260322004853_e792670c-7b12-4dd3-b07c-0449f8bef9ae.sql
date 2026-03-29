
CREATE TABLE public.challenge_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_id UUID NOT NULL REFERENCES public.weekly_challenges(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own challenge issues"
  ON public.challenge_issues FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own challenge issues"
  ON public.challenge_issues FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage challenge issues"
  ON public.challenge_issues FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
