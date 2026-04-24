-- Track when a native app user opens the app via a push notification
CREATE TABLE IF NOT EXISTS public.push_open_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  platform text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_open_events_user_time
  ON public.push_open_events (user_id, opened_at DESC);

ALTER TABLE public.push_open_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own push open events"
  ON public.push_open_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own push open events"
  ON public.push_open_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage push_open_events"
  ON public.push_open_events
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tag rooms when a participant returned from a push notification
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS member1_from_push boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS member2_from_push boolean NOT NULL DEFAULT false;
