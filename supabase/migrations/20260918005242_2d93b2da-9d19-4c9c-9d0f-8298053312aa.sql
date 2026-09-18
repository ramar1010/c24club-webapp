-- Remove legacy one-sided DM attribution (male message alone must not qualify, and it wiped rival pairs)
DROP TRIGGER IF EXISTS trg_bounty_attr_dm ON public.dm_messages;
DROP FUNCTION IF EXISTS public.auto_record_bounty_from_dm();

-- Pair-scoped winner lookup index
CREATE INDEX IF NOT EXISTS idx_bounty_attr_male_activity
  ON public.bounty_attributions (male_id, expires_at DESC, last_interaction_at DESC);

CREATE OR REPLACE FUNCTION public.attribute_bounty_on_dm_two_way()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_owner_id uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  v_other_id uuid;
  v_sender_gender text;
  v_other_gender text;
  v_female_id uuid;
  v_male_id uuid;
  v_male_is_vip boolean;
  v_has_male_first boolean;
  v_active_id uuid;
begin
  -- System / automated DMs never qualify and never count as activity
  if NEW.sender_id = v_owner_id then
    return NEW;
  end if;
  if NEW.content is null or NEW.content ~ '^(💰|📹|🎁|🎉)' then
    return NEW;
  end if;

  select case when c.participant_1 = NEW.sender_id then c.participant_2 else c.participant_1 end
    into v_other_id
  from public.conversations c
  where c.id = NEW.conversation_id;

  if v_other_id is null or v_other_id = v_owner_id then
    return NEW;
  end if;

  select lower(gender) into v_sender_gender from public.members where id = NEW.sender_id;
  select lower(gender) into v_other_gender from public.members where id = v_other_id;

  if v_sender_gender = 'female' and v_other_gender = 'male' then
    v_female_id := NEW.sender_id;
    v_male_id := v_other_id;
  elsif v_sender_gender = 'male' and v_other_gender = 'female' then
    v_female_id := v_other_id;
    v_male_id := NEW.sender_id;
  else
    return NEW;
  end if;

  -- Existing active record for THIS pair: refresh activity only, never extend expiry
  select id into v_active_id
  from public.bounty_attributions
  where male_id = v_male_id
    and female_id = v_female_id
    and expires_at > now()
  for update;

  if v_active_id is not null then
    update public.bounty_attributions
      set last_interaction_at = greatest(last_interaction_at, NEW.created_at)
      where id = v_active_id;
    return NEW;
  end if;

  -- Qualification requires the female's reply
  if v_female_id <> NEW.sender_id then
    return NEW;
  end if;

  select (is_vip or admin_granted_vip) into v_male_is_vip
  from public.member_minutes where user_id = v_male_id;
  if coalesce(v_male_is_vip, false) then
    return NEW;
  end if;

  -- He must have sent the first user-authored message in this thread
  select exists (
    select 1 from public.dm_messages d
    where d.conversation_id = NEW.conversation_id
      and d.sender_id = v_male_id
      and d.created_at < NEW.created_at
      and d.content is not null
      and d.content !~ '^(💰|📹|🎁|🎉)'
  ) into v_has_male_first;

  if not v_has_male_first then
    return NEW;
  end if;

  insert into public.bounty_attributions (male_id, female_id, interaction_type, last_interaction_at, expires_at)
  values (v_male_id, v_female_id, 'dm_two_way', NEW.created_at, NEW.created_at + interval '30 days')
  on conflict (male_id, female_id) do update
    set interaction_type = 'dm_two_way',
        last_interaction_at = NEW.created_at,
        expires_at = NEW.created_at + interval '30 days'
    where public.bounty_attributions.expires_at <= now();

  return NEW;
end;
$function$;

-- Call-based attributions: keep pair-scoped, stop wiping rival pairs, calls only
CREATE OR REPLACE FUNCTION public.record_bounty_interaction(p_male_id uuid, p_interaction_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_female_id UUID := auth.uid();
  v_female_gender TEXT;
  v_male_gender TEXT;
  v_male_is_vip BOOLEAN;
BEGIN
  IF v_female_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_interaction_type NOT IN ('call','dm') THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_type');
  END IF;
  -- DM attributions are created only by the two-way DM trigger
  IF p_interaction_type = 'dm' THEN
    RETURN jsonb_build_object('success', true, 'skipped', 'dm_handled_by_trigger');
  END IF;

  SELECT lower(gender) INTO v_female_gender FROM public.members WHERE id = v_female_id;
  SELECT lower(gender) INTO v_male_gender FROM public.members WHERE id = p_male_id;

  IF v_female_gender <> 'female' OR v_male_gender <> 'male' THEN
    RETURN jsonb_build_object('success', false, 'error', 'gender_mismatch');
  END IF;

  SELECT (is_vip OR admin_granted_vip) INTO v_male_is_vip
  FROM public.member_minutes WHERE user_id = p_male_id;
  IF COALESCE(v_male_is_vip, false) THEN
    RETURN jsonb_build_object('success', true, 'skipped', 'already_vip');
  END IF;

  INSERT INTO public.bounty_attributions (male_id, female_id, interaction_type, last_interaction_at, expires_at)
  VALUES (p_male_id, v_female_id, 'call', now(), now() + interval '7 days')
  ON CONFLICT (male_id, female_id) DO UPDATE
    SET last_interaction_at = now(),
        interaction_type = CASE WHEN public.bounty_attributions.interaction_type = 'dm_two_way'
                                 AND public.bounty_attributions.expires_at > now()
                                THEN 'dm_two_way' ELSE 'call' END,
        expires_at = CASE WHEN public.bounty_attributions.interaction_type = 'dm_two_way'
                           AND public.bounty_attributions.expires_at > now()
                          THEN public.bounty_attributions.expires_at
                          ELSE now() + interval '7 days' END;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Idempotent, atomic VIP reward credit; winner = newest user-authored DM/call activity
CREATE OR REPLACE FUNCTION public.award_bounty_for_subscription(p_male_id uuid, p_tier text, p_stripe_subscription_id text, p_is_renewal boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_female_id UUID;
  v_minutes INTEGER;
  v_source TEXT;
  v_streak_count INTEGER;
  v_inserted INTEGER;
BEGIN
  IF p_is_renewal THEN
    RETURN jsonb_build_object('success', false, 'reason', 'renewal_no_bounty');
  END IF;

  -- Serialize concurrent purchase callbacks for the same male
  PERFORM pg_advisory_xact_lock(hashtext('vip_bounty:' || p_male_id::text));

  SELECT female_id INTO v_female_id
  FROM public.bounty_attributions
  WHERE male_id = p_male_id AND expires_at > now()
  ORDER BY last_interaction_at DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_female_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_attribution');
  END IF;

  IF lower(coalesce(p_tier, '')) = 'premium' THEN
    v_minutes := 500;
    v_source := 'premium';
  ELSIF lower(coalesce(p_tier, '')) = 'basic' THEN
    v_minutes := 125;
    v_source := 'basic';
  ELSE
    RETURN jsonb_build_object('success', false, 'reason', 'unknown_tier');
  END IF;

  INSERT INTO public.vip_bounty_payout_claims (male_id, female_id)
  VALUES (p_male_id, v_female_id)
  ON CONFLICT (male_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_awarded');
  END IF;

  -- Notification triggers fire on this insert, i.e. only after the credit exists
  INSERT INTO public.bounty_earnings (
    female_id, male_id, amount_cents, amount_minutes, source, stripe_subscription_id, paid_out
  )
  VALUES (v_female_id, p_male_id, v_minutes, v_minutes, v_source, p_stripe_subscription_id, true);

  INSERT INTO public.member_minutes (user_id, gifted_minutes)
  VALUES (v_female_id, v_minutes)
  ON CONFLICT (user_id) DO UPDATE
    SET gifted_minutes = COALESCE(public.member_minutes.gifted_minutes, 0) + v_minutes,
        updated_at = now();

  SELECT COUNT(*) INTO v_streak_count
  FROM public.bounty_earnings
  WHERE female_id = v_female_id
    AND source IN ('basic', 'premium')
    AND created_at > now() - interval '7 days'
    AND clawed_back = false;

  IF v_streak_count = 3 THEN
    INSERT INTO public.bounty_earnings (
      female_id, male_id, amount_cents, amount_minutes, source, stripe_subscription_id, paid_out
    )
    VALUES (v_female_id, p_male_id, 500, 500, 'streak', p_stripe_subscription_id || ':streak', true);

    UPDATE public.member_minutes
    SET gifted_minutes = COALESCE(gifted_minutes, 0) + 500,
        updated_at = now()
    WHERE user_id = v_female_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'female_id', v_female_id,
    'minutes', v_minutes,
    'streak_count', v_streak_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.attribute_bounty_on_dm_two_way() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_dm_two_way_attribution() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_bounty_for_subscription(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_bounty_for_subscription(uuid, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_bounty_interaction(uuid, text) TO authenticated;

-- Clients may read their own rows only; all writes go through the definer functions
REVOKE INSERT, UPDATE, DELETE ON public.bounty_attributions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.vip_bounty_payout_claims FROM anon, authenticated;
GRANT SELECT ON public.bounty_attributions TO authenticated;
GRANT SELECT ON public.vip_bounty_payout_claims TO authenticated;
GRANT ALL ON public.bounty_attributions TO service_role;
GRANT ALL ON public.vip_bounty_payout_claims TO service_role;