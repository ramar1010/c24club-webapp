
ALTER TABLE public.member_redemptions 
  ADD COLUMN IF NOT EXISTS shipping_tracking_url text,
  ADD COLUMN IF NOT EXISTS address_exists text DEFAULT 'unknown';

-- Allow admins to delete redemptions
CREATE POLICY "Admins can delete redemptions"
  ON public.member_redemptions
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
