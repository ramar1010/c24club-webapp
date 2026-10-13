ALTER TABLE public.group_chat_messages
  ADD COLUMN IF NOT EXISTS male_id uuid,
  ADD COLUMN IF NOT EXISTS male_name text;

COMMENT ON COLUMN public.group_chat_messages.male_id IS 'For bounty system messages: the guy who went VIP, when he is not linked to any female yet (tap to DM him).';
COMMENT ON COLUMN public.group_chat_messages.male_name IS 'First name of the unlinked VIP guy in bounty system messages.';

CREATE OR REPLACE FUNCTION public.post_bounty_to_group_chat()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_cents integer;
  v_male_name text;
  v_linked boolean;
BEGIN
  IF COALESCE(NEW.clawed_back, false) THEN RETURN NEW; END IF;
  v_cents := COALESCE(NEW.amount_cents, COALESCE(NEW.amount_minutes, 0));
  IF v_cents <= 0 THEN RETURN NEW; END IF;
  v_name := public.chat_display_name(NEW.female_id);

  -- Is this guy already linked (active bounty attribution) to any female?
  SELECT EXISTS (
    SELECT 1 FROM public.bounty_attributions
    WHERE male_id = NEW.male_id
      AND expires_at > now()
  ) INTO v_linked;

  IF v_linked THEN
    INSERT INTO public.group_chat_messages (user_id, body, is_system, amount_cents)
    VALUES (
      NULL,
      '💸 ' || v_name || ' just earned $' || to_char(v_cents / 100.0, 'FM999999990.00') ||
        ' — a guy she was chatting with went VIP!',
      true,
      v_cents
    );
  ELSE
    v_male_name := public.chat_display_name(NEW.male_id);
    INSERT INTO public.group_chat_messages (user_id, body, is_system, amount_cents, male_id, male_name)
    VALUES (
      NULL,
      '💸 ' || v_name || ' just earned $' || to_char(v_cents / 100.0, 'FM999999990.00') ||
        ' — a guy she was chatting with went VIP! ' || v_male_name ||
        ' isn''t linked to anyone yet — tap his name to say hi and earn the next bounty 💬',
      true,
      v_cents,
      NEW.male_id,
      v_male_name
    );
  END IF;
  RETURN NEW;
END;
$function$;