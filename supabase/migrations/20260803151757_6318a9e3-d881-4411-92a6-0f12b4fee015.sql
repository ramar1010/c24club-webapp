
CREATE OR REPLACE FUNCTION public.chat_display_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(split_part(TRIM(m.name), ' ', 1), ''), 'A member')
  FROM public.members m WHERE m.id = _user_id
$$;

-- Bounty awarded -> post to group chat
CREATE OR REPLACE FUNCTION public.post_bounty_to_group_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_cents integer;
BEGIN
  IF COALESCE(NEW.clawed_back, false) THEN RETURN NEW; END IF;
  v_cents := COALESCE(NEW.amount_cents, COALESCE(NEW.amount_minutes, 0));
  IF v_cents <= 0 THEN RETURN NEW; END IF;
  v_name := public.chat_display_name(NEW.female_id);

  INSERT INTO public.group_chat_messages (user_id, body, is_system, amount_cents)
  VALUES (
    NULL,
    '💸 ' || v_name || ' just earned $' || to_char(v_cents / 100.0, 'FM999999990.00') ||
      ' — a guy she was chatting with went VIP!',
    true,
    v_cents
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_bounty_to_group_chat ON public.bounty_earnings;
CREATE TRIGGER trg_post_bounty_to_group_chat
AFTER INSERT ON public.bounty_earnings
FOR EACH ROW EXECUTE FUNCTION public.post_bounty_to_group_chat();

-- Gift completed -> post to group chat
CREATE OR REPLACE FUNCTION public.post_gift_to_group_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_cents integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;
  IF NOT public.is_verified_female(NEW.recipient_id) THEN RETURN NEW; END IF;

  v_cents := COALESCE(NEW.minutes_amount, 0);
  v_name := public.chat_display_name(NEW.recipient_id);

  INSERT INTO public.group_chat_messages (user_id, body, is_system, amount_cents)
  VALUES (
    NULL,
    '🎁 ' || v_name || ' was just gifted ' || COALESCE(NEW.minutes_amount, 0) || ' minutes ($' ||
      to_char(v_cents / 100.0, 'FM999999990.00') || ')',
    true,
    v_cents
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_gift_to_group_chat ON public.gift_transactions;
CREATE TRIGGER trg_post_gift_to_group_chat
AFTER INSERT OR UPDATE OF status ON public.gift_transactions
FOR EACH ROW EXECUTE FUNCTION public.post_gift_to_group_chat();

-- Cashout approved/paid -> post to group chat
CREATE OR REPLACE FUNCTION public.post_cashout_to_group_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_cents integer;
BEGIN
  IF NEW.status NOT IN ('approved', 'paid') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  v_name := public.chat_display_name(NEW.user_id);
  v_cents := ROUND(COALESCE(NEW.cash_amount, 0) * 100)::integer;

  INSERT INTO public.group_chat_messages (user_id, body, is_system, amount_cents)
  VALUES (
    NULL,
    '💵 Cashout approved: ' || v_name || ' withdrew $' || to_char(v_cents / 100.0, 'FM999999990.00') || ' to PayPal 🎉',
    true,
    v_cents
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_cashout_to_group_chat ON public.cashout_requests;
CREATE TRIGGER trg_post_cashout_to_group_chat
AFTER UPDATE OF status ON public.cashout_requests
FOR EACH ROW EXECUTE FUNCTION public.post_cashout_to_group_chat();
