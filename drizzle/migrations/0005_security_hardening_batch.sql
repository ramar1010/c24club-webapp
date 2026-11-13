-- 1. Internal secret for trusted backend-to-function calls
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS app_private.internal_secrets (name text PRIMARY KEY, value text NOT NULL);
REVOKE ALL ON app_private.internal_secrets FROM PUBLIC, anon, authenticated;
INSERT INTO app_private.internal_secrets(name, value)
VALUES ('edge_internal', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.internal_edge_secret()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private AS $$
  SELECT value FROM app_private.internal_secrets WHERE name = 'edge_internal'
$$;
REVOKE EXECUTE ON FUNCTION public.internal_edge_secret() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_internal_secret(p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private AS $$
  SELECT p_secret IS NOT NULL AND p_secret = (SELECT value FROM app_private.internal_secrets WHERE name = 'edge_internal')
$$;
REVOKE EXECUTE ON FUNCTION public.verify_internal_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_internal_secret(text) TO service_role;

-- Add the secret header to every trigger function that calls our edge functions
DO $$
DECLARE r record; def text; newdef text;
BEGIN
  FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prosrc ILIKE '%functions/v1/%'
             AND p.prosrc ILIKE '%net.http_post%' AND p.prosrc NOT ILIKE '%x-internal-secret%'
             AND p.proname NOT IN ('email_queue_dispatch','email_queue_wake')
  LOOP
    def := pg_get_functiondef(r.oid);
    newdef := regexp_replace(def, '''Content-Type''\s*,\s*''application/json''',
      '''Content-Type'', ''application/json'', ''x-internal-secret'', public.internal_edge_secret()', 'g');
    IF newdef <> def THEN EXECUTE newdef; END IF;
  END LOOP;
END $$;

-- Cron jobs: add the secret header
DO $$
DECLARE j record; anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA'; fn text;
BEGIN
  FOR j IN SELECT jobid, command FROM cron.job WHERE command ILIKE '%functions/v1/%' AND command NOT ILIKE '%x-internal-secret%' AND command NOT ILIKE '%process-email-queue%' LOOP
    fn := substring(j.command from 'functions/v1/([a-z0-9-]+)');
    PERFORM cron.alter_job(j.jobid, command := format(
      $c$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s','apikey','%s','x-internal-secret', public.internal_edge_secret()), body := jsonb_build_object('time', now())) as request_id;$c$,
      'https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/' || fn, anon, anon));
  END LOOP;
END $$;

-- 2. Minute-granting functions: backend only
REVOKE EXECUTE ON FUNCTION public.atomic_increment_minutes(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atomic_increment_member_balances(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_vip_recharge_minutes(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_recharge_minutes(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_increment_minutes(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.atomic_increment_member_balances(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_vip_recharge_minutes(uuid, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_recharge_minutes(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_adjust_minutes(p_user_id uuid, p_amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN public.atomic_increment_minutes(p_user_id, p_amount);
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_minutes(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_minutes(uuid, integer) TO authenticated;

-- 3. Camera unlock requests / anchor tables: writes only through backend
DROP POLICY IF EXISTS "Users can update related camera_unlock_requests" ON public.camera_unlock_requests;
DROP POLICY IF EXISTS "Users can insert own camera_unlock_requests" ON public.camera_unlock_requests;
DROP POLICY IF EXISTS "Users can insert own anchor_session" ON public.anchor_sessions;
DROP POLICY IF EXISTS "Users can update own anchor_session" ON public.anchor_sessions;
DROP POLICY IF EXISTS "Users can delete own anchor_session" ON public.anchor_sessions;
DROP POLICY IF EXISTS "Users can manage own queue entry" ON public.anchor_queue;
CREATE POLICY "Users can read own queue entry" ON public.anchor_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. Room signals: only call participants can delete
DROP POLICY IF EXISTS "Authenticated users can delete signals" ON public.room_signals;
CREATE POLICY "Participants can delete signals" ON public.room_signals FOR DELETE TO authenticated
USING (
  room_id LIKE '%' || auth.uid()::text || '%'
  OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id::text = room_signals.room_id AND auth.uid()::text IN (r.member1, r.member2))
);

-- 5. Settings tables: no broad reads
DROP POLICY IF EXISTS "Authenticated can read camera_unlock_settings" ON public.camera_unlock_settings;
DROP POLICY IF EXISTS "Authenticated can read anchor_settings" ON public.anchor_settings;
DROP POLICY IF EXISTS "Authenticated can read referral settings" ON public.referral_settings;
DROP POLICY IF EXISTS "Authenticated can read freeze_settings" ON public.freeze_settings;
DROP POLICY IF EXISTS "Authenticated can read lucky_spin_settings" ON public.lucky_spin_settings;
DROP POLICY IF EXISTS "Authenticated can read wager_settings" ON public.wager_settings;
DROP POLICY IF EXISTS "Anyone can read reddit_task_settings" ON public.reddit_task_settings;
DROP POLICY IF EXISTS "Authenticated can read wishlist_settings" ON public.wishlist_settings;
DROP POLICY IF EXISTS "Authenticated can read cashout_settings" ON public.cashout_settings;
DROP POLICY IF EXISTS "Anyone authenticated can read signup counts" ON public.slot_signups;
DROP POLICY IF EXISTS "Authenticated can read vip_settings get_gifted" ON public.vip_settings;
CREATE POLICY "Users can read own vip_settings" ON public.vip_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Authenticated users can view power hour signups" ON public.power_hour_optins;
CREATE POLICY "Users can view own power hour signup" ON public.power_hour_optins FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_public_app_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'camera_unlock_price_cents', (SELECT price_cents FROM camera_unlock_settings LIMIT 1),
    'power_hour_start', (SELECT power_hour_start FROM anchor_settings LIMIT 1),
    'power_hour_end', (SELECT power_hour_end FROM anchor_settings LIMIT 1),
    'lucky_spin', (SELECT jsonb_build_object('is_enabled', is_enabled, 'spin_interval_ms', spin_interval_ms, 'hide_carousel', hide_carousel) FROM lucky_spin_settings LIMIT 1),
    'wishlist', (SELECT jsonb_build_object('min_minutes', min_minutes, 'max_minutes', max_minutes) FROM wishlist_settings LIMIT 1)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_app_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_app_settings() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_power_hour_summary(p_session_date date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'male', count(*) FILTER (WHERE lower(gender) = 'male'),
    'female', count(*) FILTER (WHERE lower(gender) = 'female'),
    'total', count(*),
    'joined', bool_or(user_id = auth.uid())
  ) FROM power_hour_optins WHERE session_date = p_session_date
$$;
REVOKE EXECUTE ON FUNCTION public.get_power_hour_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_power_hour_summary(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pinned_socials(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, pinned_socials text[]) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.user_id, v.pinned_socials::text[] FROM vip_settings v
  WHERE auth.uid() IS NOT NULL AND v.user_id = ANY(p_user_ids[1:200])
$$;
REVOKE EXECUTE ON FUNCTION public.get_pinned_socials(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pinned_socials(uuid[]) TO authenticated;

-- 6. Storage: stop listing whole public buckets; scope report uploads
DROP POLICY IF EXISTS "Anyone can view member photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view promo images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read blog images" ON storage.objects;
CREATE POLICY "Owners and staff can list member photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'member-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')));
CREATE POLICY "Owners and admins can list promo images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'promo-images' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Admins can list blog images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'blog-images' AND public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Users can upload report screenshots" ON storage.objects;
CREATE POLICY "Users can upload own report screenshots" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'report-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);