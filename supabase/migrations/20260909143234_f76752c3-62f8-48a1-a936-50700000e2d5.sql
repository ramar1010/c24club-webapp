CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  raw_name text;
  display_name text;
  base_name text;
  short_id text;
  meta_gender text;
BEGIN
  raw_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'user' || left(NEW.id::text, 8)
  );

  meta_gender := lower(COALESCE(NEW.raw_user_meta_data->>'gender', ''));

  -- Apple private relay / random-looking handles get a friendly name instead
  IF NEW.email ILIKE '%privaterelay.appleid.com'
     OR raw_name ~ '^[a-z0-9]{8,}$' AND raw_name !~ '[aeiou]{1}[a-z]*[aeiou]' THEN
    display_name :=
      CASE
        WHEN meta_gender = 'female' THEN 'iphonegirl'
        WHEN meta_gender = 'male' THEN 'iphoneguy'
        ELSE 'iphoneuser'
      END || (1000 + floor(random() * 9000))::int::text;
  ELSE
    display_name := raw_name;
  END IF;

  base_name := lower(regexp_replace(display_name, '[^a-zA-Z0-9]', '', 'g'));
  IF base_name = '' THEN
    base_name := 'user' || left(NEW.id::text, 8);
  END IF;
  short_id := left(NEW.id::text, 4);

  INSERT INTO public.members (id, name, email, call_slug)
  VALUES (NEW.id, display_name, NEW.email, base_name || '-' || short_id);

  RETURN NEW;
END;
$function$;