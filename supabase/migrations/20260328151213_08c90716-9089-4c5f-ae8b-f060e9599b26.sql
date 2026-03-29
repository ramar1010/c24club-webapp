
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_name text;
  short_id text;
BEGIN
  base_name := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    '[^a-zA-Z0-9]', '', 'g'
  ));
  short_id := left(NEW.id::text, 4);

  INSERT INTO public.members (id, name, email, call_slug)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    base_name || '-' || short_id
  );
  RETURN NEW;
END;
$function$;
