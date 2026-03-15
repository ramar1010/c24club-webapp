
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.member_interests ADD COLUMN IF NOT EXISTS icebreaker_message text;
