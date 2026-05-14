
-- 1) Drop the anon UPDATE policy on sms_campaign_sends (track-sms-click uses service role)
DROP POLICY IF EXISTS "Anon can update click tracking" ON public.sms_campaign_sends;

-- 2) Tighten promo-images storage INSERT to scope by user folder (mirror DELETE)
DROP POLICY IF EXISTS "Authenticated users can upload promo images" ON storage.objects;
CREATE POLICY "Users can upload their own promo images"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'promo-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) Allow admins to delete from suppressed_emails (so suppressions can be managed)
CREATE POLICY "Admins can delete suppressed emails"
ON public.suppressed_emails
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4) Restrict slot_signups SELECT to own rows + admins (was USING true)
DROP POLICY IF EXISTS "Authenticated can view slot signups" ON public.slot_signups;
CREATE POLICY "Users can view their own slot signups"
ON public.slot_signups
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 5) Idempotency table for consumed Stripe checkout sessions (prevents replay of buy-spins / unfreeze)
CREATE TABLE IF NOT EXISTS public.consumed_stripe_sessions (
  session_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consumed_stripe_sessions ENABLE ROW LEVEL SECURITY;
-- service-role only (no policies = no client access)
