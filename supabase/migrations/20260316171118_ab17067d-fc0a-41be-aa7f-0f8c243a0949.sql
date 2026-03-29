
CREATE TABLE public.tap_me_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tap_me_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own tap events"
  ON public.tap_me_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all tap events"
  ON public.tap_me_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_tap_me_events_user_id ON public.tap_me_events(user_id);
CREATE INDEX idx_tap_me_events_created_at ON public.tap_me_events(created_at);
