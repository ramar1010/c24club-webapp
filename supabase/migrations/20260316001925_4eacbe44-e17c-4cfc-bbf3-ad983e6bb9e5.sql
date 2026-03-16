
CREATE TABLE public.direct_call_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE public.direct_call_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own invites" ON public.direct_call_invites
  FOR SELECT TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can insert own invites" ON public.direct_call_invites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update related invites" ON public.direct_call_invites
  FOR UPDATE TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Admins can manage invites" ON public.direct_call_invites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
