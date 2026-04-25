-- Track each individual worker submission (since one task can have multiple workers via max_claims)
CREATE TABLE IF NOT EXISTS public.reddit_task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.reddit_tasks(id) ON DELETE CASCADE,
  worker_name text,
  posted_comment_url text NOT NULL,
  variant_index integer,
  variant_text_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce: same Reddit comment URL can never be submitted twice across ANY task
CREATE UNIQUE INDEX IF NOT EXISTS reddit_task_submissions_url_unique
  ON public.reddit_task_submissions (lower(posted_comment_url));

CREATE INDEX IF NOT EXISTS reddit_task_submissions_task_id_idx
  ON public.reddit_task_submissions (task_id);

ALTER TABLE public.reddit_task_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reddit_task_submissions"
  ON public.reddit_task_submissions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated submit RPC with duplicate URL detection + variant tracking
CREATE OR REPLACE FUNCTION public.submit_reddit_task(
  p_code text,
  p_worker_name text,
  p_posted_url text,
  p_variant_index integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task public.reddit_tasks%ROWTYPE;
  v_new_count integer;
  v_new_status text;
  v_normalized_url text;
  v_variant_text text;
  v_variant_hash text;
  v_existing_submission_id uuid;
BEGIN
  IF p_posted_url IS NULL OR length(trim(p_posted_url)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please paste your Reddit comment link');
  END IF;
  IF p_posted_url !~* '^https?://(www\.|old\.|new\.)?reddit\.com/' THEN
    RETURN jsonb_build_object('success', false, 'error', 'URL must be a reddit.com link');
  END IF;

  v_normalized_url := lower(trim(p_posted_url));

  -- Duplicate URL check across ALL tasks
  SELECT id INTO v_existing_submission_id
  FROM public.reddit_task_submissions
  WHERE lower(posted_comment_url) = v_normalized_url
  LIMIT 1;

  IF v_existing_submission_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This Reddit comment URL has already been submitted. Each comment must be unique.');
  END IF;

  SELECT * INTO v_task FROM public.reddit_tasks WHERE claim_code = p_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid task code');
  END IF;
  IF v_task.claims_count >= v_task.max_claims THEN
    RETURN jsonb_build_object('success', false, 'error', 'This task is full — no more submissions accepted.');
  END IF;

  -- Capture variant hash if a variant index was provided and is in range
  IF p_variant_index IS NOT NULL
     AND p_variant_index >= 0
     AND p_variant_index < array_length(v_task.suggested_comments, 1) THEN
    v_variant_text := v_task.suggested_comments[p_variant_index + 1];
    v_variant_hash := encode(digest(lower(trim(v_variant_text)), 'sha256'), 'hex');
  END IF;

  v_new_count := v_task.claims_count + 1;
  v_new_status := CASE WHEN v_new_count >= v_task.max_claims THEN 'completed' ELSE 'claimed' END;

  -- Insert submission row
  INSERT INTO public.reddit_task_submissions (task_id, worker_name, posted_comment_url, variant_index, variant_text_hash)
  VALUES (v_task.id, NULLIF(trim(p_worker_name), ''), trim(p_posted_url), p_variant_index, v_variant_hash);

  UPDATE public.reddit_tasks
  SET claims_count = v_new_count,
      status = v_new_status,
      claimed_by_name = COALESCE(NULLIF(trim(p_worker_name), ''), claimed_by_name, 'anonymous'),
      posted_comment_url = trim(p_posted_url),
      completed_at = CASE WHEN v_new_status = 'completed' THEN now() ELSE completed_at END
  WHERE claim_code = p_code;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'This Reddit comment URL has already been submitted.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_reddit_task(text, text, text, integer) TO anon, authenticated;