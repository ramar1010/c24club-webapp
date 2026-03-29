
CREATE TABLE public.sms_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  message_text TEXT,
  vonage_status TEXT,
  vonage_error_text TEXT,
  vonage_message_id TEXT,
  vonage_network TEXT,
  vonage_remaining_balance TEXT,
  vonage_message_price TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view SMS logs"
ON public.sms_delivery_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_sms_delivery_log_created ON public.sms_delivery_log(created_at DESC);
CREATE INDEX idx_sms_delivery_log_status ON public.sms_delivery_log(vonage_status);
