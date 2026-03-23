
-- Table to store which admin menu sections each moderator can access
CREATE TABLE public.moderator_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, menu_key)
);

ALTER TABLE public.moderator_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage permissions
CREATE POLICY "Admins can manage moderator_permissions"
  ON public.moderator_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Moderators can read their own permissions
CREATE POLICY "Moderators can read own permissions"
  ON public.moderator_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
