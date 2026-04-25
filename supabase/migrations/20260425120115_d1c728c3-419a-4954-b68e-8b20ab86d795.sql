CREATE OR REPLACE FUNCTION public.submit_reddit_task(p_code text, p_worker_name text, p_posted_url text, p_variant_index integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF p_variant_index IS NOT NULL
     AND p_variant_index >= 0
     AND p_variant_index < array_length(v_task.suggested_comments, 1) THEN
    v_variant_text := v_task.suggested_comments[p_variant_index + 1];
    -- Use md5 (built-in, no extension required) instead of digest()
    v_variant_hash := md5(lower(trim(v_variant_text)));
  END IF;

  v_new_count := v_task.claims_count + 1;
  v_new_status := CASE WHEN v_new_count >= v_task.max_claims THEN 'completed' ELSE 'claimed' END;

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
$function$;