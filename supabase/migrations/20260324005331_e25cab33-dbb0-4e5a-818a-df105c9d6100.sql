CREATE POLICY "Viewers can read own analytics"
ON public.promo_analytics
FOR SELECT
TO authenticated
USING (auth.uid() = viewer_id);