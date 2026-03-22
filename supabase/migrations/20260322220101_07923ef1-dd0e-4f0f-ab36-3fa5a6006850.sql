
CREATE OR REPLACE FUNCTION public.auto_dm_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  owner_id uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  conv_id uuid;
BEGIN
  IF NEW.id = owner_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.conversations (participant_1, participant_2, last_message_at)
  VALUES (owner_id, NEW.id, now())
  RETURNING id INTO conv_id;

  INSERT INTO public.dm_messages (conversation_id, sender_id, content)
  VALUES (
    conv_id,
    owner_id,
    'Welcome to my website where video chats mean rewards & cash!  💰💲🎁 If you have any questions feel free to reach out here or at business@c24club.com!'
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_auto_dm_welcome
AFTER INSERT ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.auto_dm_welcome();
