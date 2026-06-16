
-- Trigger fn: auto-record bounty attribution when a female + male share a room
CREATE OR REPLACE FUNCTION public.auto_record_bounty_from_room()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_female_id UUID; v_male_id UUID; v_male_is_vip BOOLEAN;
BEGIN
  IF NEW.member1_gender IS NULL OR NEW.member2_gender IS NULL THEN RETURN NEW; END IF;
  IF lower(NEW.member1_gender) = 'female' AND lower(NEW.member2_gender) = 'male' THEN
    v_female_id := NEW.member1; v_male_id := NEW.member2;
  ELSIF lower(NEW.member2_gender) = 'female' AND lower(NEW.member1_gender) = 'male' THEN
    v_female_id := NEW.member2; v_male_id := NEW.member1;
  ELSE RETURN NEW; END IF;

  SELECT (is_vip OR admin_granted_vip) INTO v_male_is_vip FROM member_minutes WHERE user_id = v_male_id;
  IF COALESCE(v_male_is_vip,false) THEN RETURN NEW; END IF;

  DELETE FROM bounty_attributions WHERE male_id = v_male_id AND female_id <> v_female_id;
  INSERT INTO bounty_attributions (male_id, female_id, interaction_type, last_interaction_at, expires_at)
  VALUES (v_male_id, v_female_id, 'call', now(), now() + interval '7 days')
  ON CONFLICT (male_id, female_id) DO UPDATE
    SET interaction_type='call', last_interaction_at=now(), expires_at=now()+interval '7 days';
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bounty_attr_room ON public.rooms;
CREATE TRIGGER trg_bounty_attr_room AFTER INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.auto_record_bounty_from_room();

-- Trigger fn: auto-record bounty attribution on DM send
CREATE OR REPLACE FUNCTION public.auto_record_bounty_from_dm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recipient UUID; v_sender_gender TEXT; v_recipient_gender TEXT;
  v_female_id UUID; v_male_id UUID; v_male_is_vip BOOLEAN;
BEGIN
  SELECT CASE WHEN participant_1 = NEW.sender_id THEN participant_2 ELSE participant_1 END
    INTO v_recipient FROM conversations WHERE id = NEW.conversation_id;
  IF v_recipient IS NULL THEN RETURN NEW; END IF;

  SELECT lower(gender) INTO v_sender_gender FROM members WHERE id = NEW.sender_id;
  SELECT lower(gender) INTO v_recipient_gender FROM members WHERE id = v_recipient;

  IF v_sender_gender = 'female' AND v_recipient_gender = 'male' THEN
    v_female_id := NEW.sender_id; v_male_id := v_recipient;
  ELSIF v_recipient_gender = 'female' AND v_sender_gender = 'male' THEN
    v_female_id := v_recipient; v_male_id := NEW.sender_id;
  ELSE RETURN NEW; END IF;

  SELECT (is_vip OR admin_granted_vip) INTO v_male_is_vip FROM member_minutes WHERE user_id = v_male_id;
  IF COALESCE(v_male_is_vip,false) THEN RETURN NEW; END IF;

  DELETE FROM bounty_attributions WHERE male_id = v_male_id AND female_id <> v_female_id;
  INSERT INTO bounty_attributions (male_id, female_id, interaction_type, last_interaction_at, expires_at)
  VALUES (v_male_id, v_female_id, 'dm', now(), now() + interval '7 days')
  ON CONFLICT (male_id, female_id) DO UPDATE
    SET interaction_type='dm', last_interaction_at=now(), expires_at=now()+interval '7 days';
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bounty_attr_dm ON public.dm_messages;
CREATE TRIGGER trg_bounty_attr_dm AFTER INSERT ON public.dm_messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_record_bounty_from_dm();
