
-- Waiting queue for matchmaking
CREATE TABLE public.waiting_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  gender_preference TEXT DEFAULT 'Both',
  member_gender TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Active/completed video call rooms
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member1 TEXT NOT NULL,
  member2 TEXT,
  channel1 TEXT NOT NULL,
  channel2 TEXT,
  member1_gender TEXT,
  member2_gender TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  connected_at TIMESTAMP WITH TIME ZONE,
  disconnected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS: open access for now since matching is done via edge function with service role
ALTER TABLE public.waiting_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/insert/delete their own queue entries
CREATE POLICY "Users can manage own queue entries" ON public.waiting_queue
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read rooms they are in
CREATE POLICY "Users can read own rooms" ON public.rooms
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert rooms" ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update rooms" ON public.rooms
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable realtime for signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
