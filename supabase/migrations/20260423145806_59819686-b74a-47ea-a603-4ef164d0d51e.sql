CREATE OR REPLACE FUNCTION public.auto_dm_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  conv_id uuid;
  normalized_gender text := lower(coalesce(NEW.gender, ''));
  welcome_msg text;
BEGIN
  IF NEW.id = owner_id THEN
    RETURN NEW;
  END IF;

  IF normalized_gender = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND lower(coalesce(OLD.gender, '')) = normalized_gender THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.member_welcome_dm_log
    WHERE user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  IF normalized_gender = 'male' THEN
    welcome_msg := E'📲 Looking for the opposite gender to connect to instantly? Download our app by searching "c24club" on Google Play to get notified instantly when a female or male user is online and searching!\n\n---\n\nWelcome to C24 Club — the video chat platform with real rewards! 🎁🏆\n\nHere''s how to get started:\n1️⃣ Tap "Start Chatting" to join a video call — you collect minutes for every conversation!\n2️⃣ Redeem your minutes for rewards in the Reward Store — gift cards, clothing, accessories & more\n3️⃣ Complete Weekly Challenges for bonus prizes! Check the Challenges page for tasks like Marathon Talk, Bestie Challenge & more\n4️⃣ Browse the Discover page — other members can send you gifts directly! The more active your profile, the more likely you are to receive them\n\n💡 Check out the How To Guide for tips on VIP perks & more: https://c24club.com/how-to-guide\n\nQuestions? Message me here or email business@c24club.com!';
  ELSE
    welcome_msg := E'Welcome to C24 Club — the video chat platform with real rewards! 🎁🏆\n\nHere''s how to get started:\n1️⃣ Tap "Start Chatting" to join a video call — you collect minutes for every conversation!\n2️⃣ Redeem your minutes for rewards in the Reward Store — gift cards, clothing, accessories & more\n3️⃣ Complete Weekly Challenges for bonus prizes! Check the Challenges page for tasks like Marathon Talk, Bestie Challenge & more\n4️⃣ Browse the Discover page — other members can send you gifts directly! The more active your profile, the more likely you are to receive them\n\n💡 Check out the How To Guide for tips on VIP perks & more: https://c24club.com/how-to-guide\n\nQuestions? Message me here or email business@c24club.com!';
  END IF;

  SELECT c.id
  INTO conv_id
  FROM public.conversations c
  WHERE (c.participant_1 = owner_id AND c.participant_2 = NEW.id)
     OR (c.participant_1 = NEW.id AND c.participant_2 = owner_id)
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_1, participant_2, last_message_at)
    VALUES (owner_id, NEW.id, now())
    RETURNING id INTO conv_id;
  END IF;

  INSERT INTO public.dm_messages (conversation_id, sender_id, content)
  VALUES (conv_id, owner_id, welcome_msg);

  UPDATE public.conversations
  SET last_message_at = now()
  WHERE id = conv_id;

  INSERT INTO public.member_welcome_dm_log (user_id, sent_gender)
  VALUES (NEW.id, normalized_gender)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;