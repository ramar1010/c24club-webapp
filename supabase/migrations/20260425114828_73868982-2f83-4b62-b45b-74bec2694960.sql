ALTER TABLE public.reddit_tasks
  ADD COLUMN IF NOT EXISTS max_claims integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS claims_count integer NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.get_reddit_task_by_code(text);

CREATE OR REPLACE FUNCTION public.get_reddit_task_by_code(p_code text)
RETURNS TABLE(
  id uuid,
  subreddit text,
  thread_title text,
  thread_url text,
  suggested_comments text[],
  notes text,
  status text,
  claimed_by_name text,
  posted_comment_url text,
  max_claims integer,
  claims_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, subreddit, thread_title, thread_url, suggested_comments, notes,
         status, claimed_by_name, posted_comment_url, max_claims, claims_count
  FROM public.reddit_tasks
  WHERE claim_code = p_code
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.claim_reddit_task(p_code text, p_worker_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task public.reddit_tasks%ROWTYPE;
BEGIN
  SELECT * INTO v_task FROM public.reddit_tasks WHERE claim_code = p_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid task code');
  END IF;
  IF v_task.status NOT IN ('open', 'claimed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task already completed');
  END IF;
  IF v_task.claims_count >= v_task.max_claims THEN
    RETURN jsonb_build_object('success', false, 'error', 'This task is full — no more workers needed.');
  END IF;

  UPDATE public.reddit_tasks
  SET status = 'claimed',
      claimed_by_name = COALESCE(NULLIF(trim(p_worker_name), ''), claimed_by_name, 'anonymous'),
      claimed_at = COALESCE(claimed_at, now())
  WHERE claim_code = p_code;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_reddit_task(p_code text, p_worker_name text, p_posted_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task public.reddit_tasks%ROWTYPE;
  v_new_count integer;
  v_new_status text;
BEGIN
  IF p_posted_url IS NULL OR length(trim(p_posted_url)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please paste your Reddit comment link');
  END IF;
  IF p_posted_url !~* '^https?://(www\.|old\.|new\.)?reddit\.com/' THEN
    RETURN jsonb_build_object('success', false, 'error', 'URL must be a reddit.com link');
  END IF;

  SELECT * INTO v_task FROM public.reddit_tasks WHERE claim_code = p_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid task code');
  END IF;
  IF v_task.claims_count >= v_task.max_claims THEN
    RETURN jsonb_build_object('success', false, 'error', 'This task is full — no more submissions accepted.');
  END IF;

  v_new_count := v_task.claims_count + 1;
  v_new_status := CASE WHEN v_new_count >= v_task.max_claims THEN 'completed' ELSE 'claimed' END;

  UPDATE public.reddit_tasks
  SET claims_count = v_new_count,
      status = v_new_status,
      claimed_by_name = COALESCE(NULLIF(trim(p_worker_name), ''), claimed_by_name, 'anonymous'),
      posted_comment_url = trim(p_posted_url),
      completed_at = CASE WHEN v_new_status = 'completed' THEN now() ELSE completed_at END
  WHERE claim_code = p_code;

  RETURN jsonb_build_object('success', true);
END;
$$;