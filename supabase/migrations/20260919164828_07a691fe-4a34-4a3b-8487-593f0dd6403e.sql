CREATE OR REPLACE VIEW public.private_call_billing_log
WITH (security_invoker = true) AS
SELECT
  id,
  user_id AS earner_id,
  partner_id,
  minutes_earned AS spent_minutes,
  session_date,
  created_at,
  updated_at
FROM public.call_minutes_log;

GRANT SELECT ON public.private_call_billing_log TO authenticated;
GRANT SELECT ON public.private_call_billing_log TO service_role;