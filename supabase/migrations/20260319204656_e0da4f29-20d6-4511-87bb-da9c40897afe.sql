
-- Camera unlock settings (singleton, admin-configurable)
CREATE TABLE public.camera_unlock_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_cents integer NOT NULL DEFAULT 299,
  recipient_cut_percent integer NOT NULL DEFAULT 25,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.camera_unlock_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage camera_unlock_settings"
  ON public.camera_unlock_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read camera_unlock_settings"
  ON public.camera_unlock_settings FOR SELECT TO authenticated
  USING (true);

-- Insert default row
INSERT INTO public.camera_unlock_settings (price_cents, recipient_cut_percent) VALUES (299, 25);

-- Camera unlock requests (transaction log)
CREATE TABLE public.camera_unlock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  room_id text,
  stripe_session_id text,
  price_cents integer NOT NULL DEFAULT 0,
  recipient_cut_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.camera_unlock_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage camera_unlock_requests"
  ON public.camera_unlock_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own camera_unlock_requests"
  ON public.camera_unlock_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert own camera_unlock_requests"
  ON public.camera_unlock_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update related camera_unlock_requests"
  ON public.camera_unlock_requests FOR UPDATE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Enable realtime for consent signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.camera_unlock_requests;
