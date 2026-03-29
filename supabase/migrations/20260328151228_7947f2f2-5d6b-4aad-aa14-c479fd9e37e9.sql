
-- Allow anonymous users to read minimal profile data via call_slug for the Call Me page
CREATE POLICY "Anon can read call_slug profiles"
ON public.members
FOR SELECT
TO anon
USING (call_slug IS NOT NULL);
