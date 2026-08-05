ALTER TABLE public.member_minutes
  ADD COLUMN IF NOT EXISTS recharge_minutes integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.recharge_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pack_key text NOT NULL,
  minutes integer NOT NULL,
  price_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.recharge_purchases TO authenticated;
GRANT ALL ON public.recharge_purchases TO service_role;

ALTER TABLE public.recharge_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own recharge purchases" ON public.recharge_purchases;
CREATE POLICY "Users view own recharge purchases"
ON public.recharge_purchases FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all recharge purchases" ON public.recharge_purchases;
CREATE POLICY "Admins view all recharge purchases"
ON public.recharge_purchases FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_recharge_purchases_user ON public.recharge_purchases(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recharge_purchases_session ON public.recharge_purchases(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_recharge_purchases_updated_at ON public.recharge_purchases;
CREATE TRIGGER trg_recharge_purchases_updated_at
BEFORE UPDATE ON public.recharge_purchases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.add_recharge_minutes(p_user_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN (SELECT COALESCE(recharge_minutes, 0) FROM public.member_minutes WHERE user_id = p_user_id);
  END IF;

  INSERT INTO public.member_minutes (user_id, recharge_minutes, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id) DO UPDATE
    SET recharge_minutes = COALESCE(public.member_minutes.recharge_minutes, 0) + p_amount,
        updated_at = now()
  RETURNING recharge_minutes INTO v_new;

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_recharge_minutes(p_user_id uuid, p_amount integer)
RETURNS TABLE(spent integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance integer;
  v_spend integer;
BEGIN
  SELECT COALESCE(recharge_minutes, 0) INTO v_balance
  FROM public.member_minutes WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    spent := 0; remaining := 0; RETURN NEXT; RETURN;
  END IF;

  v_spend := LEAST(GREATEST(COALESCE(p_amount, 0), 0), v_balance);

  UPDATE public.member_minutes
  SET recharge_minutes = v_balance - v_spend, updated_at = now()
  WHERE user_id = p_user_id;

  spent := v_spend;
  remaining := v_balance - v_spend;
  RETURN NEXT;
END;
$$;