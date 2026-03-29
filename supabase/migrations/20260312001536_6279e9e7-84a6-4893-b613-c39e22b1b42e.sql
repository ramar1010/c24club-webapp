
CREATE TABLE public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL DEFAULT 'Violation of terms',
  ban_type text NOT NULL DEFAULT 'standard',
  is_active boolean NOT NULL DEFAULT true,
  banned_by uuid,
  unbanned_at timestamp with time zone,
  unban_payment_session text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage bans"
  ON public.user_bans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can read their own bans
CREATE POLICY "Users can read own bans"
  ON public.user_bans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
