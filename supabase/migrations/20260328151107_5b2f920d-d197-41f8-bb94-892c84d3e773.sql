
-- Add call_slug column to members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS call_slug text UNIQUE;

-- Generate slugs for all existing members: lowercase name + first 4 chars of id
UPDATE public.members
SET call_slug = lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) || '-' || left(id::text, 4)
WHERE call_slug IS NULL;

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_members_call_slug ON public.members (call_slug);
