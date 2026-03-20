
-- Bestie pairs: tracks who invited whom via a unique link code
CREATE TABLE public.bestie_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL,
  invitee_id uuid,
  invite_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  days_completed integer NOT NULL DEFAULT 0,
  reward_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Daily call logs with screenshot proof
CREATE TABLE public.bestie_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.bestie_pairs(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  call_date date NOT NULL DEFAULT CURRENT_DATE,
  total_seconds integer NOT NULL DEFAULT 0,
  inviter_screenshot_url text,
  invitee_screenshot_url text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pair_id, day_number)
);

-- RLS
ALTER TABLE public.bestie_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bestie_daily_logs ENABLE ROW LEVEL SECURITY;

-- Bestie pairs policies
CREATE POLICY "Admins can manage bestie_pairs"
  ON public.bestie_pairs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own bestie_pairs"
  ON public.bestie_pairs FOR SELECT TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can insert own bestie_pairs"
  ON public.bestie_pairs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update own bestie_pairs"
  ON public.bestie_pairs FOR UPDATE TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Bestie daily logs policies
CREATE POLICY "Admins can manage bestie_daily_logs"
  ON public.bestie_daily_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own bestie_daily_logs"
  ON public.bestie_daily_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bestie_pairs bp
    WHERE bp.id = bestie_daily_logs.pair_id
    AND (bp.inviter_id = auth.uid() OR bp.invitee_id = auth.uid())
  ));

CREATE POLICY "Users can insert own bestie_daily_logs"
  ON public.bestie_daily_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bestie_pairs bp
    WHERE bp.id = bestie_daily_logs.pair_id
    AND (bp.inviter_id = auth.uid() OR bp.invitee_id = auth.uid())
  ));

CREATE POLICY "Users can update own bestie_daily_logs"
  ON public.bestie_daily_logs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bestie_pairs bp
    WHERE bp.id = bestie_daily_logs.pair_id
    AND (bp.inviter_id = auth.uid() OR bp.invitee_id = auth.uid())
  ));

-- Trigger for updated_at
CREATE TRIGGER bestie_pairs_updated_at
  BEFORE UPDATE ON public.bestie_pairs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER bestie_daily_logs_updated_at
  BEFORE UPDATE ON public.bestie_daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
