-- Reddit task tracking for microworker outreach
CREATE TABLE public.reddit_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_code text NOT NULL UNIQUE,
  subreddit text,
  thread_title text,
  thread_url text NOT NULL,
  suggested_comments text[] NOT NULL DEFAULT '{}',
  notes text,
  status text NOT NULL DEFAULT 'open', -- open | claimed | completed | verified | rejected
  claimed_by_name text,
  claimed_at timestamptz,
  posted_comment_url text,
  completed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reddit_tasks_claim_code ON public.reddit_tasks(claim_code);
CREATE INDEX idx_reddit_tasks_status ON public.reddit_tasks(status);

ALTER TABLE public.reddit_tasks ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins can manage reddit_tasks"
ON public.reddit_tasks FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Workers (anonymous) interact only via SECURITY DEFINER RPCs below — no direct table access.

CREATE TRIGGER update_reddit_tasks_updated_at
BEFORE UPDATE ON public.reddit_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Worker RPC: look up a task by claim code
CREATE OR REPLACE FUNCTION public.get_reddit_task_by_code(p_code text)
RETURNS TABLE (
  id uuid,
  subreddit text,
  thread_title text,
  thread_url text,
  suggested_comments text[],
  notes text,
  status text,
  claimed_by_name text,
  posted_comment_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, subreddit, thread_title, thread_url, suggested_comments, notes,
         status, claimed_by_name, posted_comment_url
  FROM public.reddit_tasks
  WHERE claim_code = p_code
  LIMIT 1;
$$;

-- Worker RPC: claim a task (sets name + claimed status)
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

  UPDATE public.reddit_tasks
  SET status = 'claimed',
      claimed_by_name = COALESCE(NULLIF(trim(p_worker_name), ''), claimed_by_name, 'anonymous'),
      claimed_at = COALESCE(claimed_at, now())
  WHERE claim_code = p_code;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Worker RPC: submit completion
CREATE OR REPLACE FUNCTION public.submit_reddit_task(
  p_code text,
  p_worker_name text,
  p_posted_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task public.reddit_tasks%ROWTYPE;
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
  IF v_task.status = 'completed' OR v_task.status = 'verified' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task already submitted');
  END IF;

  UPDATE public.reddit_tasks
  SET status = 'completed',
      claimed_by_name = COALESCE(NULLIF(trim(p_worker_name), ''), claimed_by_name, 'anonymous'),
      posted_comment_url = trim(p_posted_url),
      completed_at = now()
  WHERE claim_code = p_code;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reddit_task_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reddit_task(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_reddit_task(text, text, text) TO anon, authenticated;