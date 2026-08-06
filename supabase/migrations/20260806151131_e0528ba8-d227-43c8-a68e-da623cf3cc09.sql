CREATE TABLE public.vip_minute_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  grant_key text NOT NULL UNIQUE,
  minutes integer NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vip_minute_grants TO authenticated;
GRANT ALL ON public.vip_minute_grants TO service_role;

ALTER TABLE public.vip_minute_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own VIP minute grants"
ON public.vip_minute_grants FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all VIP minute grants"
ON public.vip_minute_grants FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_vip_minute_grants_user ON public.vip_minute_grants(user_id);

CREATE OR REPLACE FUNCTION public.grant_vip_recharge_minutes(
  p_user_id uuid,
  p_grant_key text,
  p_minutes integer DEFAULT 5,
  p_source text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted uuid;
  v_new integer;
BEGIN
  IF p_user_id IS NULL OR p_grant_key IS NULL OR p_minutes IS NULL OR p_minutes <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_args');
  END IF;

  INSERT INTO public.vip_minute_grants (user_id, grant_key, minutes, source)
  VALUES (p_user_id, p_grant_key, p_minutes, p_source)
  ON CONFLICT (grant_key) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_granted');
  END IF;

  v_new := public.add_recharge_minutes(p_user_id, p_minutes);

  RETURN jsonb_build_object('success', true, 'minutes', p_minutes, 'recharge_minutes', v_new);
END;
$$;