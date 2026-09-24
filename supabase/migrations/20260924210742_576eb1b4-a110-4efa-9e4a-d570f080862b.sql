ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS message_kind text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS gift_transaction_id uuid REFERENCES public.gift_transactions(id) ON DELETE SET NULL;
ALTER TABLE public.dm_messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE public.dm_messages ADD CONSTRAINT dm_messages_kind_chk CHECK (
  (message_kind = 'user' AND sender_id IS NOT NULL AND gift_transaction_id IS NULL)
  OR (message_kind = 'system' AND sender_id IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS dm_messages_system_gift_uniq
  ON public.dm_messages(gift_transaction_id) WHERE message_kind = 'system';

-- Members can only ever insert their own normal messages
CREATE POLICY "Members insert only own user messages" ON public.dm_messages AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (message_kind = 'user' AND sender_id = auth.uid() AND gift_transaction_id IS NULL
              OR public.has_role(auth.uid(), 'admin'));

-- System rows skip bounty, push and near-limit triggers
DROP TRIGGER trg_dm_two_way_bounty_attribution ON public.dm_messages;
CREATE TRIGGER trg_dm_two_way_bounty_attribution AFTER INSERT ON public.dm_messages
  FOR EACH ROW WHEN (NEW.message_kind = 'user') EXECUTE FUNCTION public.attribute_bounty_on_dm_two_way();
DROP TRIGGER on_dm_message_insert ON public.dm_messages;
CREATE TRIGGER on_dm_message_insert AFTER INSERT ON public.dm_messages
  FOR EACH ROW WHEN (NEW.message_kind = 'user') EXECUTE FUNCTION public.notify_dm_push();
DROP TRIGGER trg_notify_male_near_limit ON public.dm_messages;
CREATE TRIGGER trg_notify_male_near_limit AFTER INSERT ON public.dm_messages
  FOR EACH ROW WHEN (NEW.message_kind = 'user') EXECUTE FUNCTION public.notify_male_near_limit();

CREATE OR REPLACE FUNCTION public.post_private_call_gift_dm(p_gift_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g record; v_convo uuid; p1 uuid; p2 uuid;
BEGIN
  SELECT * INTO g FROM public.gift_transactions WHERE id = p_gift_id;
  IF NOT FOUND OR g.status <> 'completed' OR g.private_call_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.dm_messages WHERE message_kind='system' AND gift_transaction_id=p_gift_id) THEN RETURN; END IF;
  p1 := LEAST(g.sender_id, g.recipient_id); p2 := GREATEST(g.sender_id, g.recipient_id);
  SELECT id INTO v_convo FROM public.conversations
   WHERE (participant_1=p1 AND participant_2=p2) OR (participant_1=p2 AND participant_2=p1) LIMIT 1;
  IF v_convo IS NULL THEN
    INSERT INTO public.conversations(participant_1, participant_2) VALUES (p1, p2) RETURNING id INTO v_convo;
  END IF;
  INSERT INTO public.dm_messages(conversation_id, sender_id, content, message_kind, gift_transaction_id)
  VALUES (v_convo, NULL, 'A user gifted you during your private call.', 'system', p_gift_id)
  ON CONFLICT (gift_transaction_id) WHERE message_kind = 'system' DO NOTHING;
  UPDATE public.conversations SET last_message_at = now() WHERE id = v_convo;
END $$;
REVOKE ALL ON FUNCTION public.post_private_call_gift_dm(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_private_call_gift_dm(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_iap_gift(p_sender_id uuid, p_recipient_id uuid, p_sku text, p_platform text, p_minutes integer, p_price_cents integer, p_sender_bonus integer, p_purchase_token_hash text, p_private_call_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing uuid; v_gift_id uuid;
BEGIN
  IF p_sender_id = p_recipient_id THEN RAISE EXCEPTION 'cannot_gift_self'; END IF;
  IF p_minutes IS NULL OR p_minutes <= 0 THEN RAISE EXCEPTION 'invalid_minutes'; END IF;
  IF p_purchase_token_hash IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('iap_gift:' || p_purchase_token_hash));
    SELECT gift_transaction_id INTO v_existing FROM public.iap_purchases
      WHERE action = 'verify-gift' AND purchase_token_hash = p_purchase_token_hash LIMIT 1;
    IF FOUND THEN
      BEGIN PERFORM public.post_private_call_gift_dm(v_existing); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gift dm failed: %', SQLERRM; END;
      RETURN jsonb_build_object('success', true, 'already_processed', true, 'gift_transaction_id', v_existing);
    END IF;
  END IF;
  INSERT INTO public.gift_transactions(sender_id, recipient_id, minutes_amount, price_cents, status, private_call_id)
  VALUES (p_sender_id, p_recipient_id, p_minutes, p_price_cents, 'completed', p_private_call_id)
  RETURNING id INTO v_gift_id;
  PERFORM public.atomic_increment_member_balances(p_recipient_id, 0, p_minutes);
  IF COALESCE(p_sender_bonus,0) > 0 THEN
    PERFORM public.atomic_increment_member_balances(p_sender_id, p_sender_bonus, 0);
  END IF;
  INSERT INTO public.iap_purchases(user_id, action, sku, platform, recipient_id, minutes_added, purchase_token_hash, gift_transaction_id)
  VALUES (p_sender_id, 'verify-gift', p_sku, COALESCE(p_platform,'native'), p_recipient_id, p_minutes, p_purchase_token_hash, v_gift_id);
  BEGIN PERFORM public.post_private_call_gift_dm(v_gift_id); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'gift dm failed: %', SQLERRM; END;
  RETURN jsonb_build_object('success', true, 'already_processed', false, 'gift_transaction_id', v_gift_id);
END $$;