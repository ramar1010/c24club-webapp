
UPDATE public.member_minutes
SET vip_tier = 'premium', updated_at = now()
WHERE user_id = 'a558c974-85aa-450b-bde1-d6c650235c84';
