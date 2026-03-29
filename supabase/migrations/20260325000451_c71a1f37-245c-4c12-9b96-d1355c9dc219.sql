UPDATE public.members
SET image_url = 'https://ncpbiymnafxdfsvpxirb.supabase.co/storage/v1/object/public/member-photos/6f8bb0e2-a36a-4bc0-920f-312c340f7921/selfie.png?t=' || extract(epoch from now())::bigint,
    is_discoverable = true,
    updated_at = now()
WHERE id = '6f8bb0e2-a36a-4bc0-920f-312c340f7921';