
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
  user_gender text;
BEGIN
  owner_id := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  user_gender := lower(COALESCE(NEW.gender, ''));

  -- Wait until gender is known before sending welcome
  IF user_gender = '' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.member_welcome_dm_log WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO conv_id FROM public.conversations
  WHERE (participant_1 = owner_id AND participant_2 = NEW.id)
     OR (participant_1 = NEW.id AND participant_2 = owner_id)
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_1, participant_2)
    VALUES (owner_id, NEW.id)
    RETURNING id INTO conv_id;
  END IF;

  IF user_gender = 'female' THEN
    welcome_msg := E'Welcome to C24 Club — the video chat platform with real rewards! 🎁🏆\n\nHere''s how to get started:\n1️⃣ Tap "Start Chatting" to join a video call — you collect minutes for every conversation!\n2️⃣ Redeem your minutes for rewards in the Reward Store — gift cards, clothing, accessories & more\n3️⃣ Browse the Discover page — other members can send you gifts directly! The more active your profile, the more likely you are to receive them\n4️⃣ Guys can only send 3 free messages before they must buy VIP to keep chatting — so a flirty follow-up often converts. Go to your profile or home page and tap "Earn money dming guys" to learn more\n\n💡 Check out the How To Guide for tips on VIP perks & more: https://c24club.com/how-to-guide\n\nQuestions? Message me here or email business@c24club.com!';
  ELSE
    welcome_msg := E'Welcome to C24 Club — the video chat platform with real rewards! 🎁🏆\n\nHere''s how to get started:\n1️⃣ Tap "Start Chatting" to join a video call — you collect minutes for every conversation!\n2️⃣ Redeem your minutes for rewards in the Reward Store — gift cards, clothing, accessories & more\n3️⃣ Browse the Discover page — other members can send you gifts directly! The more active your profile, the more likely you are to receive them\n\n💡 Check out the How To Guide for tips on VIP perks & more: https://c24club.com/how-to-guide\n\nQuestions? Message me here or email business@c24club.com!';
  END IF;

  INSERT INTO public.dm_messages (conversation_id, sender_id, content)
  VALUES (conv_id, owner_id, welcome_msg);

  INSERT INTO public.member_welcome_dm_log (user_id, sent_gender)
  VALUES (NEW.id, NEW.gender);

  RETURN NEW;
END;
$function$;

-- Backfill: send a follow-up Step 4 message to existing female users
-- whose welcome DM was logged before gender was set (sent_gender is null/empty).
DO $$
DECLARE
  owner_id uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  rec RECORD;
  conv_id uuid;
  followup text := E'PS — one more tip just for the ladies 💋\n\n4️⃣ Guys can only send 3 free messages before they must buy VIP to keep chatting — so a flirty follow-up often converts. Go to your profile or home page and tap "Earn money dming guys" to learn more.';
BEGIN
  FOR rec IN
    SELECT m.id
    FROM public.members m
    JOIN public.member_welcome_dm_log l ON l.user_id = m.id
    WHERE lower(COALESCE(m.gender,'')) = 'female'
      AND (l.sent_gender IS NULL OR lower(l.sent_gender) <> 'female')
  LOOP
    SELECT id INTO conv_id FROM public.conversations
    WHERE (participant_1 = owner_id AND participant_2 = rec.id)
       OR (participant_1 = rec.id AND participant_2 = owner_id)
    LIMIT 1;

    IF conv_id IS NULL THEN
      INSERT INTO public.conversations (participant_1, participant_2)
      VALUES (owner_id, rec.id) RETURNING id INTO conv_id;
    END IF;

    INSERT INTO public.dm_messages (conversation_id, sender_id, content)
    VALUES (conv_id, owner_id, followup);

    UPDATE public.member_welcome_dm_log SET sent_gender = 'female' WHERE user_id = rec.id;
  END LOOP;
END $$;
