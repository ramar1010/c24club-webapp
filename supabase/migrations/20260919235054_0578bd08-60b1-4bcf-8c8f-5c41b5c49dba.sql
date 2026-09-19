CREATE OR REPLACE FUNCTION public.resolve_ready_to_chat(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.ready_to_chat_sessions%ROWTYPE;
  v_delivery public.ready_to_chat_deliveries%ROWTYPE;
  v_eff text;
  v_sender public.members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthenticated');
  END IF;
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_session');
  END IF;

  SELECT * INTO v_session
  FROM public.ready_to_chat_sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL OR v_session.status <> 'active' OR v_session.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'session_unavailable');
  END IF;

  SELECT * INTO v_delivery
  FROM public.ready_to_chat_deliveries
  WHERE session_id = p_session_id
    AND recipient_id = v_uid
    AND status IN ('pending', 'sent', 'opened')
  FOR UPDATE;

  IF v_delivery.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'delivery_unavailable');
  END IF;

  v_eff := public.rtc_effective_mode(v_session.sender_id, v_uid, v_session.mode);
  IF v_eff IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'sender_unavailable');
  END IF;

  UPDATE public.ready_to_chat_deliveries
  SET status = 'opened', opened_at = COALESCE(opened_at, now())
  WHERE id = v_delivery.id
    AND status IN ('pending', 'sent', 'opened');

  SELECT * INTO v_sender
  FROM public.members
  WHERE id = v_session.sender_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'expires_at', v_session.expires_at,
    'effective_mode', v_eff,
    'sender', jsonb_build_object(
      'id', v_sender.id,
      'name', v_sender.name,
      'gender', v_sender.gender,
      'image_url', v_sender.image_url,
      'image_thumb_url', v_sender.image_thumb_url,
      'bio', v_sender.bio,
      'country', v_sender.country
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_ready_to_chat_action(p_session_id uuid, p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.ready_to_chat_sessions%ROWTYPE;
  v_delivery_status text;
  v_eff text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_session');
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('text', 'video', 'both') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_mode');
  END IF;

  SELECT * INTO v_session
  FROM public.ready_to_chat_sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL OR v_session.status <> 'active' OR v_session.expires_at <= now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'session_unavailable');
  END IF;

  SELECT status INTO v_delivery_status
  FROM public.ready_to_chat_deliveries
  WHERE session_id = p_session_id
    AND recipient_id = v_uid;

  IF v_delivery_status IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authorized');
  END IF;
  IF v_delivery_status NOT IN ('pending', 'sent', 'opened') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'delivery_unavailable');
  END IF;

  v_eff := public.rtc_effective_mode(v_session.sender_id, v_uid, v_session.mode);
  IF v_eff IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'sender_unavailable');
  END IF;

  IF p_mode <> 'both' AND v_eff <> 'both' AND v_eff <> p_mode THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'mode_not_available');
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'mode', CASE WHEN p_mode = 'both' THEN v_eff ELSE p_mode END,
    'effective_mode', v_eff,
    'requires_mode_choice', p_mode = 'both' AND v_eff = 'both',
    'sender_id', v_session.sender_id,
    'session_id', v_session.id,
    'expires_at', v_session.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_ready_to_chat(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.validate_ready_to_chat_action(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resolve_ready_to_chat(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_ready_to_chat_action(uuid, text) TO authenticated, service_role;