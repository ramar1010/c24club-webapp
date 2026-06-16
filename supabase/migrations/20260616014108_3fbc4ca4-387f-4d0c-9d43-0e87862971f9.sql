CREATE OR REPLACE FUNCTION public.auto_dm_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  owner_id uuid;
  conv_id uuid;
  welcome_msg text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    owner_id := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';

    IF EXISTS (
      SELECT 1 FROM public.member_welcome_dm_log
      WHERE user_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    SELECT id INTO conv_id
    FROM public.conversations
    WHERE (participant_1 = owner_id AND participant_2 = NEW.id)
       OR (participant_1 = NEW.id AND participant_2 = owner_id)
    LIMIT 1;

    IF conv_id IS NULL THEN
      INSERT INTO public.conversations (participant_1, participant_2)
      VALUES (owner_id, NEW.id)
      RETURNING id INTO conv_id;
    END IF;

    welcome_msg := E'Welcome to C24 Club — the video chat platform with real rewards! 🎁🏆\n\nHere''s how to get started:\n1️⃣ Tap "Start Chatting" to join a video call — you collect minutes for every conversation!\n2️⃣ Redeem your minutes for rewards in the Reward Store — gift cards, clothing, accessories & more\n3️⃣ Complete Weekly Challenges for bonus prizes! Check the Challenges page for tasks like Marathon Talk, Bestie Challenge & more\n4️⃣ Browse the Discover page — other members can send you gifts directly! The more active your profile, the more likely you are to receive them\n\n💡 Check out the How To Guide for tips on VIP perks & more: https://c24club.com/how-to-guide\n\nQuestions? Message me here or email business@c24club.com!';

    INSERT INTO public.dm_messages (conversation_id, sender_id, content)
    VALUES (conv_id, owner_id, welcome_msg);

    INSERT INTO public.member_welcome_dm_log (user_id, sent_gender)
    VALUES (NEW.id, NEW.gender);
  END IF;

  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  bad_owner uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  real_owner uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  r record;
  other_id uuid;
  target_conv uuid;
BEGIN
  FOR r IN
    SELECT id, participant_1, participant_2
    FROM public.conversations
    WHERE participant_1 = bad_owner OR participant_2 = bad_owner
  LOOP
    other_id := CASE WHEN r.participant_1 = bad_owner THEN r.participant_2 ELSE r.participant_1 END;

    SELECT id INTO target_conv
    FROM public.conversations
    WHERE ((participant_1 = real_owner AND participant_2 = other_id)
        OR (participant_1 = other_id AND participant_2 = real_owner))
      AND id <> r.id
    LIMIT 1;

    IF target_conv IS NULL THEN
      UPDATE public.dm_messages
      SET sender_id = real_owner
      WHERE conversation_id = r.id AND sender_id = bad_owner;

      UPDATE public.conversations
      SET participant_1 = real_owner, participant_2 = other_id
      WHERE id = r.id;
    ELSE
      UPDATE public.dm_messages
      SET sender_id = real_owner
      WHERE conversation_id = r.id AND sender_id = bad_owner;

      UPDATE public.dm_messages
      SET conversation_id = target_conv
      WHERE conversation_id = r.id;

      DELETE FROM public.conversations WHERE id = r.id;
    END IF;
  END LOOP;
END $$;