
-- Call windows table for scheduled time slots
CREATE TABLE public.call_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage call_windows" ON public.call_windows
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read active call_windows" ON public.call_windows
  FOR SELECT TO authenticated
  USING (is_active = true);

-- SMS reminder opt-ins
CREATE TABLE public.sms_reminder_optins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone_number text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.sms_reminder_optins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sms_reminder_optins" ON public.sms_reminder_optins
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage own sms optin" ON public.sms_reminder_optins
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_call_windows_updated_at
  BEFORE UPDATE ON public.call_windows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_reminder_optins_updated_at
  BEFORE UPDATE ON public.sms_reminder_optins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
