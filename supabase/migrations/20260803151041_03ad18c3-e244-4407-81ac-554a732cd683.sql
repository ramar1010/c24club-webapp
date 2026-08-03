
CREATE OR REPLACE FUNCTION public.is_verified_female(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = _user_id
      AND m.gender ILIKE 'female'
      AND m.image_status = 'approved'
      AND m.image_url IS NOT NULL
  )
$$;

CREATE TABLE public.group_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  body text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  amount_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_chat_messages TO authenticated;
GRANT ALL ON public.group_chat_messages TO service_role;

ALTER TABLE public.group_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verified females and staff can read chat"
ON public.group_chat_messages FOR SELECT TO authenticated
USING (
  public.is_verified_female(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);

CREATE POLICY "Verified females can post"
ON public.group_chat_messages FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND is_system = false
  AND (
    public.is_verified_female(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  )
);

CREATE POLICY "Authors can delete own messages"
ON public.group_chat_messages FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins manage all messages"
ON public.group_chat_messages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE INDEX idx_group_chat_messages_created_at ON public.group_chat_messages (created_at DESC);

CREATE TRIGGER update_group_chat_messages_updated_at
BEFORE UPDATE ON public.group_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chat_messages;
