
-- SMS Campaigns table
CREATE TABLE public.sms_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sms_campaigns"
  ON public.sms_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- SMS Campaign Sends table (one row per recipient per campaign)
CREATE TABLE public.sms_campaign_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
  tracking_code TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL,
  recipient_gender TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clicked_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.sms_campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sms_campaign_sends"
  ON public.sms_campaign_sends FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow anon to update clicked_at (for the tracking endpoint)
CREATE POLICY "Anon can update click tracking"
  ON public.sms_campaign_sends FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to read for tracking lookup
CREATE POLICY "Anon can read for tracking"
  ON public.sms_campaign_sends FOR SELECT TO anon
  USING (true);

-- Trigger for updated_at on campaigns
CREATE TRIGGER update_sms_campaigns_updated_at
  BEFORE UPDATE ON public.sms_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
