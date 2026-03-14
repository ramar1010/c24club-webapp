
-- Add voice_mode to waiting_queue
ALTER TABLE public.waiting_queue ADD COLUMN IF NOT EXISTS voice_mode boolean NOT NULL DEFAULT false;

-- Add voice mode tracking to rooms
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS member1_voice_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS member2_voice_mode boolean NOT NULL DEFAULT false;
