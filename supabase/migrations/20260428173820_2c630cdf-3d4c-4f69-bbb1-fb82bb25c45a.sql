UPDATE public.user_bans b
SET ip_address = m.last_ip
FROM public.members m
WHERE b.user_id = m.id
  AND b.is_active = true
  AND b.ip_address IS NULL
  AND m.last_ip IS NOT NULL;