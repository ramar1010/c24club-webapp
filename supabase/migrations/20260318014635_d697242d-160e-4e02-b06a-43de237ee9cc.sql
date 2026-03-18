
-- Cashout settings table (admin-configurable rate)
CREATE TABLE public.cashout_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_per_minute numeric NOT NULL DEFAULT 0.01,
  min_cashout_minutes integer NOT NULL DEFAULT 100,
  max_cashout_minutes integer NOT NULL DEFAULT 5000,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cashout_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cashout_settings" ON public.cashout_settings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read cashout_settings" ON public.cashout_settings
  FOR SELECT TO authenticated USING (true);

-- Insert default settings row
INSERT INTO public.cashout_settings (rate_per_minute, min_cashout_minutes, max_cashout_minutes)
VALUES (0.01, 100, 5000);

-- Cashout requests table
CREATE TABLE public.cashout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  minutes_amount integer NOT NULL,
  cash_amount numeric NOT NULL,
  paypal_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cashout_requests" ON public.cashout_requests
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own cashout_requests" ON public.cashout_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own cashout_requests" ON public.cashout_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
