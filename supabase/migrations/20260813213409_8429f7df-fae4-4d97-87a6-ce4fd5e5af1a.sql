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
    split_part(NEW.email, '@', 1)
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
  short_id := left(NEW.id::text, 4);

  INSERT INTO public.members (id, name, email, call_slug)
  VALUES (NEW.id, display_name, NEW.email, base_name || '-' || short_id);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.personalize_placeholder_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  digits text;
BEGIN
  IF NEW.gender IS NOT NULL AND NEW.name ~* '^iphoneuser[0-9]+$' THEN
    digits := regexp_replace(NEW.name, '^[a-zA-Z]+', '');
    IF lower(NEW.gender) = 'female' THEN
      NEW.name := 'iphonegirl' || digits;
    ELSIF lower(NEW.gender) = 'male' THEN
      NEW.name := 'iphoneguy' || digits;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_personalize_placeholder_name ON public.members;
CREATE TRIGGER trg_personalize_placeholder_name
BEFORE INSERT OR UPDATE OF gender, name ON public.members
FOR EACH ROW EXECUTE FUNCTION public.personalize_placeholder_name();