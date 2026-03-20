ALTER TABLE weekly_challenges ADD COLUMN IF NOT EXISTS female_only boolean NOT NULL DEFAULT false;
ALTER TABLE weekly_challenges ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'cyan';
ALTER TABLE weekly_challenges ADD COLUMN IF NOT EXISTS target_minutes integer;