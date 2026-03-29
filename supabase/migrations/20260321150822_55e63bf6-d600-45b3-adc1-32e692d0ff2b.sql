CREATE TABLE public.jackpot_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wager_id uuid REFERENCES public.minute_wagers(id) ON DELETE SET NULL,
  jackpot_amount numeric NOT NULL DEFAULT 0,
  minutes_credited integer NOT NULL DEFAULT 0,
  paypal_email text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jackpot_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage jackpot_payouts" ON public.jackpot_payouts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own jackpot_payouts" ON public.jackpot_payouts FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own paypal_email" ON public.jackpot_payouts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);