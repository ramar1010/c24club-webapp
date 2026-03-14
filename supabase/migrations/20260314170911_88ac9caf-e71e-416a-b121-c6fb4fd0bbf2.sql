
-- Add notification and test account columns to members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS notify_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS push_token text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false;

-- Create a table to track notification rate limiting
CREATE TABLE IF NOT EXISTS public.notification_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gender_segment text NOT NULL,
  last_notified_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(gender_segment)
);

-- RLS for notification_cooldowns (service role only via edge functions)
ALTER TABLE public.notification_cooldowns ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage
CREATE POLICY "Admins can manage cooldowns" ON public.notification_cooldowns
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
