CREATE TABLE public.power_hour_optins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_date date NOT NULL,
  gender text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.power_hour_optins TO authenticated;
GRANT ALL ON public.power_hour_optins TO service_role;

ALTER TABLE public.power_hour_optins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view power hour signups"
ON public.power_hour_optins FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add their own power hour signup"
ON public.power_hour_optins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own power hour signup"
ON public.power_hour_optins FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own power hour signup"
ON public.power_hour_optins FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_power_hour_optins_session_date ON public.power_hour_optins (session_date);

CREATE TRIGGER update_power_hour_optins_updated_at
BEFORE UPDATE ON public.power_hour_optins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();