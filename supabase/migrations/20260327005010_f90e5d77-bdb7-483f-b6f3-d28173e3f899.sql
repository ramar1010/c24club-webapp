
CREATE TABLE public.room_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  sender_channel text NOT NULL,
  signal_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_room_signals_room_id ON public.room_signals (room_id);
CREATE INDEX idx_room_signals_created_at ON public.room_signals (created_at);

ALTER TABLE public.room_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert signals" ON public.room_signals FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read signals" ON public.room_signals FOR SELECT USING (true);
CREATE POLICY "Anyone can delete signals" ON public.room_signals FOR DELETE USING (true);
