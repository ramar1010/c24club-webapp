
CREATE OR REPLACE FUNCTION public.auto_dm_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  conv_id uuid;
  welcome_msg text;
BEGIN
  IF NEW.id = owner_id THEN
    RETURN NEW;
  END IF;

  IF lower(COALESCE(NEW.gender, '')) = 'male' THEN
    welcome_msg := E'📲 Looking for the opposite gender to connect to instantly? Download our app by searching "C24Club" on Google Play to get notified instantly when a female or male user is online and searching!\n\n---\n\nWelcome to C24 Club — the video chat platform with real rewards! 🎁🏆\n\nHere''s how to get started:\n1️⃣ Tap "Start Chatting" to join a video call — you collect minutes for every conversation!\n2️⃣ Redeem your minutes for rewards in the Reward Store — gift cards, clothing, accessories & more\n3️⃣ Complete Weekly Challenges for bonus prizes! Check the Challenges page for tasks like Marathon Talk, Bestie Challenge & more\n4️⃣ Browse the Discover page — other members can send you gifts directly! The more active your profile, the more likely you are to receive them\n\n💡 Check out the How To Guide for tips on VIP perks & more: https://c24club.com/how-to-guide\n\nQuestions? Message me here or email business@c24club.com!';
  ELSE
    welcome_msg := E'Welcome to C24 Club — the video chat platform with real rewards! 🎁🏆\n\nHere''s how to get started:\n1️⃣ Tap "Start Chatting" to join a video call — you collect minutes for every conversation!\n2️⃣ Redeem your minutes for rewards in the Reward Store — gift cards, clothing, accessories & more\n3️⃣ Complete Weekly Challenges for bonus prizes! Check the Challenges page for tasks like Marathon Talk, Bestie Challenge & more\n4️⃣ Browse the Discover page — other members can send you gifts directly! The more active your profile, the more likely you are to receive them\n\n💡 Check out the How To Guide for tips on VIP perks & more: https://c24club.com/how-to-guide\n\nQuestions? Message me here or email business@c24club.com!';
  END IF;

  INSERT INTO public.conversations (participant_1, participant_2)
  VALUES (owner_id, NEW.id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO conv_id;

  IF conv_id IS NOT NULL THEN
    INSERT INTO public.dm_messages (conversation_id, sender_id, content)
    VALUES (conv_id, owner_id, welcome_msg);

    UPDATE public.conversations
    SET last_message_at = now()
    WHERE id = conv_id;
  END IF;

  RETURN NEW;
END;
$$;
