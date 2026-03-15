
-- Storage bucket for member selfie photos
INSERT INTO storage.buckets (id, name, public) VALUES ('member-photos', 'member-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own photos
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'member-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow anyone to view member photos
CREATE POLICY "Anyone can view member photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'member-photos');

-- Allow users to update/delete own photos
CREATE POLICY "Users can manage own photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'member-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Interest/connection requests table
CREATE TABLE public.member_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  interested_in_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, interested_in_user_id)
);

ALTER TABLE public.member_interests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own interests
CREATE POLICY "Users can insert own interests"
ON public.member_interests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can read own interests and interests in them
CREATE POLICY "Users can read related interests"
ON public.member_interests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR auth.uid() = interested_in_user_id);

-- Users can delete own interests
CREATE POLICY "Users can delete own interests"
ON public.member_interests FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Admins can manage all
CREATE POLICY "Admins can manage interests"
ON public.member_interests FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add discoverable flag to members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

-- Allow authenticated users to read discoverable members
CREATE POLICY "Users can read discoverable members"
ON public.members FOR SELECT TO authenticated
USING (is_discoverable = true);
