
CREATE OR REPLACE FUNCTION public.notify_new_room_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.member2 IS NOT NULL AND (OLD.member2 IS NULL OR OLD.member2 IS DISTINCT FROM NEW.member2) THEN
    INSERT INTO public.admin_notifications (type, title, message, reference_id)
    VALUES ('new_room_join', 'Room Joined', 'A user joined a chat room', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_room_join
  AFTER UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_room_join();

CREATE OR REPLACE FUNCTION public.notify_new_room_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, reference_id)
  VALUES ('new_room_join', 'Room Created', 'A user started a new chat room', NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_room_created
  AFTER INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_room_created();
