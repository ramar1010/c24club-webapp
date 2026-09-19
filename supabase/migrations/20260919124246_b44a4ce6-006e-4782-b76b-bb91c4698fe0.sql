
-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.ready_to_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('text','video','both')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.ready_to_chat_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ready_to_chat_sessions(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  effective_mode text NOT NULL CHECK (effective_mode IN ('text','video','both')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','skipped','failed','opened','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  opened_at timestamptz,
  failure_reason text,
  CONSTRAINT ready_to_chat_deliveries_session_recipient_key UNIQUE (session_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS public.ready_to_chat_recipient_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  cooldown_expires_at timestamptz NOT NULL,
  last_session_id uuid REFERENCES public.ready_to_chat_sessions(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ready_to_chat_cooldown_pair_key UNIQUE (sender_id, recipient_id)
);

-- ============ INDEXES ============
CREATE UNIQUE INDEX IF NOT EXISTS idx_rtc_one_active_session
  ON public.ready_to_chat_sessions (sender_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rtc_sessions_sender_created
  ON public.ready_to_chat_sessions (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rtc_sessions_expiry
  ON public.ready_to_chat_sessions (expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rtc_deliveries_pending
  ON public.ready_to_chat_deliveries (session_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_rtc_deliveries_recipient
  ON public.ready_to_chat_deliveries (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rtc_cooldowns_lookup
  ON public.ready_to_chat_recipient_cooldowns (sender_id, recipient_id, cooldown_expires_at);
CREATE INDEX IF NOT EXISTS idx_members_last_active_discoverable
  ON public.members (last_active_at DESC) WHERE is_discoverable = true;

-- ============ RLS + GRANTS ============
ALTER TABLE public.ready_to_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ready_to_chat_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ready_to_chat_recipient_cooldowns ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ready_to_chat_sessions FROM anon, authenticated, public;
REVOKE ALL ON public.ready_to_chat_deliveries FROM anon, authenticated, public;
REVOKE ALL ON public.ready_to_chat_recipient_cooldowns FROM anon, authenticated, public;
GRANT ALL ON public.ready_to_chat_sessions TO service_role;
GRANT ALL ON public.ready_to_chat_deliveries TO service_role;
GRANT ALL ON public.ready_to_chat_recipient_cooldowns TO service_role;

-- ============ HELPER: contact eligibility (recipient -> sender) ============
CREATE OR REPLACE FUNCTION public.rtc_effective_mode(p_sender_id uuid, p_recipient_id uuid, p_mode text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sender public.members%ROWTYPE;
  v_recipient public.members%ROWTYPE;
  v_text_ok boolean := false;
  v_video_ok boolean := false;
  v_recipient_vip boolean;
  v_free jsonb;
BEGIN
  IF p_sender_id IS NULL OR p_recipient_id IS NULL OR p_sender_id = p_recipient_id THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_sender FROM public.members WHERE id = p_sender_id;
  SELECT * INTO v_recipient FROM public.members WHERE id = p_recipient_id;
  IF v_sender.id IS NULL OR v_recipient.id IS NULL THEN RETURN NULL; END IF;

  -- sender must remain visible/contactable
  IF COALESCE(v_sender.is_discoverable, false) = false
     OR COALESCE(v_sender.image_status, '') <> 'approved'
     OR v_sender.image_url IS NULL THEN
    RETURN NULL;
  END IF;

  -- bans (either side)
  IF EXISTS (
    SELECT 1 FROM public.user_bans b
    WHERE b.user_id IN (p_sender_id, p_recipient_id)
      AND b.is_active = true
      AND (b.expires_at IS NULL OR b.expires_at > now())
  ) THEN RETURN NULL; END IF;

  -- blocks (both directions)
  IF EXISTS (
    SELECT 1 FROM public.blocked_users bu
    WHERE (bu.blocker_id = p_sender_id AND bu.blocked_id = p_recipient_id)
       OR (bu.blocker_id = p_recipient_id AND bu.blocked_id = p_sender_id)
  ) THEN RETURN NULL; END IF;

  v_recipient_vip := public.is_user_vip(p_recipient_id);

  IF lower(COALESCE(v_sender.gender, '')) = 'female'
     AND lower(COALESCE(v_recipient.gender, '')) <> 'female' THEN
    -- male contacting a female: existing DM/call gates apply
    v_free := public.get_user_free_msg_status(p_recipient_id);
    v_text_ok := COALESCE((v_free->>'has_reached_limit')::boolean, true) = false;
    v_video_ok := v_recipient_vip;
  ELSE
    v_text_ok := true;
    v_video_ok := true;
  END IF;

  IF p_mode = 'text' THEN
    RETURN CASE WHEN v_text_ok THEN 'text' ELSE NULL END;
  ELSIF p_mode = 'video' THEN
    RETURN CASE WHEN v_video_ok THEN 'video' ELSE NULL END;
  ELSIF p_mode = 'both' THEN
    IF v_text_ok AND v_video_ok THEN RETURN 'both';
    ELSIF v_text_ok THEN RETURN 'text';
    ELSIF v_video_ok THEN RETURN 'video';
    ELSE RETURN NULL; END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- ============ START ============
CREATE OR REPLACE FUNCTION public.start_ready_to_chat(p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_me public.members%ROWTYPE;
  v_session_id uuid;
  v_expires timestamptz;
  v_last_start timestamptz;
  v_starts integer;
  v_count integer := 0;
  v_text integer := 0;
  v_video integer := 0;
  v_both integer := 0;
BEGIN
  IF v_sender IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthenticated');
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('text','video','both') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_mode');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ready_to_chat:' || v_sender::text));

  SELECT * INTO v_me FROM public.members WHERE id = v_sender;
  IF v_me.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_profile');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_bans b WHERE b.user_id = v_sender AND b.is_active = true
      AND (b.expires_at IS NULL OR b.expires_at > now())
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'banned');
  END IF;
  IF COALESCE(v_me.is_discoverable, false) = false
     OR COALESCE(v_me.image_status, '') <> 'approved'
     OR v_me.image_url IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_discoverable');
  END IF;

  -- expire stale sessions for this sender
  UPDATE public.ready_to_chat_sessions
     SET status = 'expired'
   WHERE sender_id = v_sender AND status = 'active' AND expires_at <= now();

  IF EXISTS (SELECT 1 FROM public.ready_to_chat_sessions
             WHERE sender_id = v_sender AND status = 'active' AND expires_at > now()) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'session_already_active');
  END IF;

  SELECT max(created_at), count(*) FILTER (WHERE created_at > now() - interval '24 hours')
    INTO v_last_start, v_starts
    FROM public.ready_to_chat_sessions WHERE sender_id = v_sender;

  IF v_last_start IS NOT NULL AND v_last_start > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'restart_cooldown',
      'retry_after_seconds', ceil(extract(epoch from (v_last_start + interval '5 minutes' - now()))));
  END IF;
  IF COALESCE(v_starts, 0) >= 3 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'daily_limit_reached');
  END IF;

  v_expires := now() + interval '15 minutes';
  INSERT INTO public.ready_to_chat_sessions (sender_id, mode, status, expires_at)
  VALUES (v_sender, p_mode, 'active', v_expires)
  RETURNING id INTO v_session_id;

  WITH candidates AS (
    SELECT m.id AS recipient_id,
           public.rtc_effective_mode(v_sender, m.id, p_mode) AS eff,
           m.last_active_at
      FROM public.members m
     WHERE m.id <> v_sender
       AND m.is_discoverable = true
       AND m.image_status = 'approved'
       AND m.image_url IS NOT NULL
       AND m.last_active_at >= now() - interval '24 hours'
       AND COALESCE(m.notify_enabled, false) = true
       AND m.push_token IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.ready_to_chat_recipient_cooldowns c
          WHERE c.sender_id = v_sender AND c.recipient_id = m.id
            AND c.cooldown_expires_at > now()
       )
  ),
  eligible AS (
    SELECT recipient_id, eff FROM candidates
     WHERE eff IS NOT NULL
     ORDER BY last_active_at DESC
     LIMIT 50
  ),
  ins AS (
    INSERT INTO public.ready_to_chat_deliveries (session_id, recipient_id, effective_mode, status)
    SELECT v_session_id, recipient_id, eff, 'pending' FROM eligible
    ON CONFLICT (session_id, recipient_id) DO NOTHING
    RETURNING recipient_id, effective_mode
  ),
  cool AS (
    INSERT INTO public.ready_to_chat_recipient_cooldowns (sender_id, recipient_id, cooldown_expires_at, last_session_id, updated_at)
    SELECT v_sender, recipient_id, now() + interval '24 hours', v_session_id, now() FROM ins
    ON CONFLICT (sender_id, recipient_id)
      DO UPDATE SET cooldown_expires_at = EXCLUDED.cooldown_expires_at,
                    last_session_id = EXCLUDED.last_session_id,
                    updated_at = now()
    RETURNING 1
  )
  SELECT count(*)::int,
         count(*) FILTER (WHERE effective_mode = 'text')::int,
         count(*) FILTER (WHERE effective_mode = 'video')::int,
         count(*) FILTER (WHERE effective_mode = 'both')::int
    INTO v_count, v_text, v_video, v_both
    FROM ins;

  UPDATE public.ready_to_chat_sessions SET recipient_count = v_count WHERE id = v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'mode', p_mode,
    'expires_at', v_expires,
    'ttl_seconds', 900,
    'recipient_count', v_count,
    'counts', jsonb_build_object('text', v_text, 'video', v_video, 'both', v_both)
  );
END;
$$;

-- ============ RESOLVE ============
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
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'unauthenticated'); END IF;
  IF p_session_id IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'invalid_session'); END IF;

  SELECT * INTO v_session FROM public.ready_to_chat_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL OR v_session.status <> 'active' OR v_session.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'session_unavailable');
  END IF;

  SELECT * INTO v_delivery FROM public.ready_to_chat_deliveries
   WHERE session_id = p_session_id AND recipient_id = v_uid FOR UPDATE;
  IF v_delivery.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authorized');
  END IF;

  v_eff := public.rtc_effective_mode(v_session.sender_id, v_uid, v_session.mode);
  IF v_eff IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'sender_unavailable');
  END IF;

  UPDATE public.ready_to_chat_deliveries
     SET status = 'opened', opened_at = COALESCE(opened_at, now())
   WHERE id = v_delivery.id;

  SELECT * INTO v_sender FROM public.members WHERE id = v_session.sender_id;

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

-- ============ VALIDATE ACTION ============
CREATE OR REPLACE FUNCTION public.validate_ready_to_chat_action(p_session_id uuid, p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.ready_to_chat_sessions%ROWTYPE;
  v_eff text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated'); END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('text','video') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_mode');
  END IF;

  SELECT * INTO v_session FROM public.ready_to_chat_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL OR v_session.status <> 'active' OR v_session.expires_at <= now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'session_unavailable');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ready_to_chat_deliveries
     WHERE session_id = p_session_id AND recipient_id = v_uid
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authorized');
  END IF;

  v_eff := public.rtc_effective_mode(v_session.sender_id, v_uid, v_session.mode);
  IF v_eff IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'sender_unavailable');
  END IF;
  IF v_eff <> 'both' AND v_eff <> p_mode THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'mode_not_available');
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'mode', p_mode,
    'sender_id', v_session.sender_id,
    'session_id', v_session.id,
    'expires_at', v_session.expires_at
  );
END;
$$;

-- ============ CANCEL ============
CREATE OR REPLACE FUNCTION public.cancel_ready_to_chat(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.ready_to_chat_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'unauthenticated'); END IF;

  SELECT * INTO v_session FROM public.ready_to_chat_sessions
   WHERE id = p_session_id AND sender_id = v_uid FOR UPDATE;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  UPDATE public.ready_to_chat_sessions
     SET status = 'cancelled'
   WHERE id = v_session.id AND status = 'active';

  UPDATE public.ready_to_chat_deliveries
     SET status = 'expired'
   WHERE session_id = v_session.id AND status = 'pending';

  RETURN jsonb_build_object('success', true, 'session_id', v_session.id, 'status', 'cancelled');
END;
$$;

-- ============ CLEANUP (non-security) ============
CREATE OR REPLACE FUNCTION public.expire_ready_to_chat_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_n integer;
BEGIN
  WITH upd AS (
    UPDATE public.ready_to_chat_sessions SET status = 'expired'
     WHERE status = 'active' AND expires_at <= now() RETURNING id
  )
  UPDATE public.ready_to_chat_deliveries d SET status = 'expired'
    FROM upd WHERE d.session_id = upd.id AND d.status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- ============ FUNCTION GRANTS ============
REVOKE ALL ON FUNCTION public.rtc_effective_mode(uuid, uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_ready_to_chat(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.resolve_ready_to_chat(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.validate_ready_to_chat_action(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.cancel_ready_to_chat(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.expire_ready_to_chat_sessions() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rtc_effective_mode(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_ready_to_chat(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_ready_to_chat(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_ready_to_chat_action(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_ready_to_chat(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_ready_to_chat_sessions() TO service_role;
