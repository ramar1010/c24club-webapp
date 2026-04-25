
-- Settings table for the worker portal
CREATE TABLE IF NOT EXISTS public.reddit_task_settings (
  id integer PRIMARY KEY DEFAULT 1,
  auto_assign_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton_reddit_task_settings CHECK (id = 1)
);

INSERT INTO public.reddit_task_settings (id, auto_assign_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.reddit_task_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reddit_task_settings" ON public.reddit_task_settings;
CREATE POLICY "Anyone can read reddit_task_settings"
ON public.reddit_task_settings
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage reddit_task_settings" ON public.reddit_task_settings;
CREATE POLICY "Admins manage reddit_task_settings"
ON public.reddit_task_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Auto-assign RPC: returns the claim_code of an open task (with capacity)
CREATE OR REPLACE FUNCTION public.auto_assign_reddit_task()
RETURNS TABLE (
  claim_code text,
  enabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_code text;
BEGIN
  SELECT auto_assign_enabled INTO v_enabled
  FROM public.reddit_task_settings WHERE id = 1;

  IF v_enabled IS NULL THEN
    v_enabled := true;
  END IF;

  IF NOT v_enabled THEN
    RETURN QUERY SELECT NULL::text, false;
    RETURN;
  END IF;

  -- Pick the oldest open task that still has capacity
  SELECT t.claim_code INTO v_code
  FROM public.reddit_tasks t
  WHERE t.status = 'open'
    AND t.claims_count < t.max_claims
  ORDER BY t.created_at ASC
  LIMIT 1;

  RETURN QUERY SELECT v_code, true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_assign_reddit_task() TO anon, authenticated;
