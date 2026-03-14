
-- Create admin notifications table
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  reference_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can read/manage notifications
CREATE POLICY "Admins can manage notifications"
  ON public.admin_notifications FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- Trigger function for new member signups
CREATE OR REPLACE FUNCTION public.notify_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, reference_id)
  VALUES ('new_signup', 'New Member', 'New member registered: ' || NEW.name, NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_member
  AFTER INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_member();

-- Trigger function for new redemptions
CREATE OR REPLACE FUNCTION public.notify_new_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, reference_id)
  VALUES ('new_redemption', 'New Redemption', 'Reward redeemed: ' || NEW.reward_title, NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_redemption
  AFTER INSERT ON public.member_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_redemption();

-- Trigger function for new user reports
CREATE OR REPLACE FUNCTION public.notify_new_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, reference_id)
  VALUES ('new_report', 'User Reported', 'Reason: ' || NEW.reason, NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_report
  AFTER INSERT ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_report();

-- Trigger function for new challenge submissions
CREATE OR REPLACE FUNCTION public.notify_new_challenge_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, reference_id)
  VALUES ('new_challenge_submission', 'Challenge Submission', 'New challenge proof submitted', NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_challenge_submission
  AFTER INSERT ON public.challenge_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_challenge_submission();
