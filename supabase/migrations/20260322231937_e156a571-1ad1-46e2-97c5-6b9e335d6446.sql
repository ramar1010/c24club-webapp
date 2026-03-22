
CREATE OR REPLACE FUNCTION public.auto_dm_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  conv_id uuid;
BEGIN
  IF NEW.id = owner_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.conversations (participant_1, participant_2)
  VALUES (owner_id, NEW.id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO conv_id;

  IF conv_id IS NOT NULL THEN
    INSERT INTO public.dm_messages (conversation_id, sender_id, content)
    VALUES (
      conv_id,
      owner_id,
      E'Welcome to C24 Club where video chats mean rewards & cash! \U0001F4B0\U0001F4B2\U0001F381\n\nHere''s how to get started earning:\n1️⃣ Tap "Start Chatting" to join a video call — you earn minutes for every conversation!\n2️⃣ Redeem your minutes for real rewards, gift cards & cash in the Reward Store\n3️⃣ Complete Weekly Challenges for bonus cash — up to $135+ every week! Check the Challenges page for tasks like Marathon Talk, Bestie Challenge & more\n4️⃣ Browse the Discover page — other members can send you real cash gifts directly! The more active your profile, the more likely you are to receive gifts\n\n\U0001F4A1 Check out the How To Guide in the menu for tips on VIP perks & more!\n\nQuestions? Message me here or email business@c24club.com!'
    );

    UPDATE public.conversations
    SET last_message_at = now()
    WHERE id = conv_id;
  END IF;

  RETURN NEW;
END;
$$;
