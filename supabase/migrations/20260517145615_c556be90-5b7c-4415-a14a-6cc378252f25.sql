
-- Deactivate Boyfriend Challenge entry (if present)
UPDATE public.weekly_challenges SET is_active = false WHERE slug = 'boyfriend-challenge';

-- Drop dead feature tables
DROP TABLE IF EXISTS public.boyfriend_daily_logs CASCADE;
DROP TABLE IF EXISTS public.boyfriend_pairs CASCADE;
DROP TABLE IF EXISTS public.sms_campaign_sends CASCADE;
DROP TABLE IF EXISTS public.sms_campaigns CASCADE;
DROP TABLE IF EXISTS public.milestone_rewards CASCADE;
DROP TABLE IF EXISTS public.milestones CASCADE;
