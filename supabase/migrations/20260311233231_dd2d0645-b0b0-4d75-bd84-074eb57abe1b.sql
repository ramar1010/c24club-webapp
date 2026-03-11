
-- Allow authenticated users to read any user's pinned topics (so partners can see each other's topics)
DROP POLICY IF EXISTS "Users can read own pinned topics" ON public.pinned_topics;

CREATE POLICY "Authenticated can read all pinned topics"
  ON public.pinned_topics
  FOR SELECT
  TO authenticated
  USING (true);
