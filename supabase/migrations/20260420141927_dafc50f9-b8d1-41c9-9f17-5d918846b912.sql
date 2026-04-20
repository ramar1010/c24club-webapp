
DROP POLICY IF EXISTS "Users can read own rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can update rooms" ON public.rooms;

CREATE POLICY "Admins can manage rooms"
ON public.rooms
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants can read own rooms"
ON public.rooms
FOR SELECT
TO authenticated
USING (auth.uid()::text = member1 OR auth.uid()::text = member2);
