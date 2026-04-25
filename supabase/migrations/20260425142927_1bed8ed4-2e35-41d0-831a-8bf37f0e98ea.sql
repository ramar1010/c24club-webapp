
ALTER TABLE public.reddit_tasks
  ADD COLUMN IF NOT EXISTS no_link_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.reddit_task_submissions
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_http_status integer,
  ADD COLUMN IF NOT EXISTS verification_note text;

CREATE INDEX IF NOT EXISTS idx_reddit_task_submissions_verification
  ON public.reddit_task_submissions(verification_status, verified_at);
