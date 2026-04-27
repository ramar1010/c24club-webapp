UPDATE public.member_minutes
SET is_vip = true,
    vip_tier = 'basic',
    subscription_end = (now() + interval '7 days'),
    updated_at = now()
WHERE user_id = '1e9c5f15-9331-4ae5-beaa-b12c08a93f72';