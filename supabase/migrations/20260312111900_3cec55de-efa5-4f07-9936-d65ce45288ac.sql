
ALTER TABLE public.member_minutes 
  ADD COLUMN chance_enhancer numeric NOT NULL DEFAULT 10,
  ADD COLUMN last_login_at timestamptz DEFAULT NULL,
  ADD COLUMN ce_minutes_checkpoint integer NOT NULL DEFAULT 0;
