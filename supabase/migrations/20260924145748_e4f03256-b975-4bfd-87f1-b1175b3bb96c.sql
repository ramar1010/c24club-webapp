ALTER TABLE public.gift_transactions ADD COLUMN IF NOT EXISTS private_call_id text;
ALTER TABLE public.iap_purchases ADD COLUMN IF NOT EXISTS gift_transaction_id uuid;
CREATE INDEX IF NOT EXISTS idx_gift_tx_private_call ON public.gift_transactions(private_call_id) WHERE private_call_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.settle_iap_gift(
  p_sender_id uuid, p_recipient_id uuid, p_sku text, p_platform text,
  p_minutes integer, p_price_cents integer, p_sender_bonus integer,
  p_purchase_token_hash text, p_private_call_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_existing uuid; v_gift_id uuid;
BEGIN
  IF p_sender_id = p_recipient_id THEN RAISE EXCEPTION 'cannot_gift_self'; END IF;
  IF p_minutes IS NULL OR p_minutes <= 0 THEN RAISE EXCEPTION 'invalid_minutes'; END IF;

  IF p_purchase_token_hash IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('iap_gift:' || p_purchase_token_hash));
    SELECT gift_transaction_id INTO v_existing FROM public.iap_purchases
      WHERE action = 'verify-gift' AND purchase_token_hash = p_purchase_token_hash LIMIT 1;
    IF FOUND THEN
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

  RETURN jsonb_build_object('success', true, 'already_processed', false, 'gift_transaction_id', v_gift_id);
END $$;
REVOKE ALL ON FUNCTION public.settle_iap_gift(uuid,uuid,text,text,integer,integer,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_iap_gift(uuid,uuid,text,text,integer,integer,integer,text,text) TO service_role;