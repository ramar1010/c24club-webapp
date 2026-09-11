CREATE TABLE public.female_earnings_snapshots (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  earned_today_minutes INTEGER NOT NULL DEFAULT 0,
  cashable_minutes INTEGER NOT NULL DEFAULT 0,
  near_limit_count INTEGER NOT NULL DEFAULT 0,
  near_limit_names TEXT[] NOT NULL DEFAULT '{}',
  dm_message_id UUID,
  dm_last_posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.female_earnings_snapshots TO authenticated;
GRANT ALL ON public.female_earnings_snapshots TO service_role;

ALTER TABLE public.female_earnings_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own earnings snapshot"
ON public.female_earnings_snapshots
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_female_earnings_snapshots_updated_at
BEFORE UPDATE ON public.female_earnings_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();