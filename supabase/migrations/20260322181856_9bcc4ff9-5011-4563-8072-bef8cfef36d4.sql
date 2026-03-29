
CREATE TABLE public.slot_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  window_id UUID NOT NULL REFERENCES public.call_windows(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, window_id)
);

ALTER TABLE public.slot_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own slot signups"
  ON public.slot_signups FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all slot signups"
  ON public.slot_signups FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can read signup counts"
  ON public.slot_signups FOR SELECT
  TO authenticated
  USING (true);
