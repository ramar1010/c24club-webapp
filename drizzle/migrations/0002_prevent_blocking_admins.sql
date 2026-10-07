CREATE OR REPLACE FUNCTION public.prevent_blocking_admins()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(NEW.blocked_id, 'admin') THEN
    RAISE EXCEPTION 'This account cannot be blocked' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_blocking_admins ON public.blocked_users;
CREATE TRIGGER trg_prevent_blocking_admins
BEFORE INSERT OR UPDATE ON public.blocked_users
FOR EACH ROW EXECUTE FUNCTION public.prevent_blocking_admins();