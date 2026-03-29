DROP POLICY IF EXISTS "Anyone can insert signals" ON public.room_signals;
DROP POLICY IF EXISTS "Anyone can read signals" ON public.room_signals;
DROP POLICY IF EXISTS "Anyone can delete signals" ON public.room_signals;

CREATE POLICY "Authenticated users can insert signals"
ON public.room_signals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read signals"
ON public.room_signals
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete signals"
ON public.room_signals
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);