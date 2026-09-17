
-- 1. Two-way DM attribution (30 days, protected)
drop trigger if exists trg_dm_reply_bounty_attribution on public.dm_messages;
drop function if exists public.attribute_bounty_on_male_dm_reply();

create or replace function public.attribute_bounty_on_dm_two_way()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  v_sender_gender text;
  v_male_id uuid;
  v_male_is_vip boolean;
  v_has_male_first boolean;
  v_existing_protected uuid;
begin
  -- System / automated DMs never qualify
  if NEW.sender_id = v_owner_id then
    return NEW;
  end if;
  if NEW.content is null
     or NEW.content ~ '^(💰|📹|🎁|🎉)' then
    return NEW;
  end if;

  select lower(gender) into v_sender_gender from public.members where id = NEW.sender_id;
  if v_sender_gender is distinct from 'female' then
    return NEW;
  end if;

  select case when c.participant_1 = NEW.sender_id then c.participant_2 else c.participant_1 end
    into v_male_id
  from public.conversations c
  where c.id = NEW.conversation_id;

  if v_male_id is null or v_male_id = v_owner_id then
    return NEW;
  end if;

  if (select lower(gender) from public.members where id = v_male_id) is distinct from 'male' then
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

  select (is_vip or admin_granted_vip) into v_male_is_vip
  from public.member_minutes where user_id = v_male_id;
  if coalesce(v_male_is_vip, false) then
    return NEW;
  end if;

  -- One protected attribution per male: never extend or reassign
  select id into v_existing_protected
  from public.bounty_attributions
  where male_id = v_male_id
    and interaction_type = 'dm_two_way'
    and expires_at > now()
  limit 1;

  if v_existing_protected is not null then
    return NEW;
  end if;

  delete from public.bounty_attributions
  where male_id = v_male_id
    and female_id <> NEW.sender_id
    and interaction_type <> 'dm_two_way';

  insert into public.bounty_attributions (male_id, female_id, interaction_type, last_interaction_at, expires_at)
  values (v_male_id, NEW.sender_id, 'dm_two_way', now(), now() + interval '30 days')
  on conflict (male_id, female_id) do update
    set interaction_type = 'dm_two_way',
        last_interaction_at = now(),
        expires_at = now() + interval '30 days';

  return NEW;
end;
$$;

revoke execute on function public.attribute_bounty_on_dm_two_way() from public, anon, authenticated;

create trigger trg_dm_two_way_bounty_attribution
  after insert on public.dm_messages
  for each row execute function public.attribute_bounty_on_dm_two_way();

-- 2. Protect active two-way attributions from removal by other flows
create or replace function public.protect_dm_two_way_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.interaction_type = 'dm_two_way' and OLD.expires_at > now() then
    return null;
  end if;
  return OLD;
end;
$$;

revoke execute on function public.protect_dm_two_way_attribution() from public, anon, authenticated;

drop trigger if exists trg_protect_dm_two_way_attribution on public.bounty_attributions;
create trigger trg_protect_dm_two_way_attribution
  before delete on public.bounty_attributions
  for each row execute function public.protect_dm_two_way_attribution();

-- 3. Idempotent VIP payout claim
create table if not exists public.vip_bounty_payout_claims (
  male_id uuid primary key,
  female_id uuid,
  claimed_at timestamptz not null default now()
);
grant select on public.vip_bounty_payout_claims to authenticated;
grant all on public.vip_bounty_payout_claims to service_role;
alter table public.vip_bounty_payout_claims enable row level security;
drop policy if exists "Females see own vip payout claims" on public.vip_bounty_payout_claims;
create policy "Females see own vip payout claims"
  on public.vip_bounty_payout_claims for select to authenticated
  using (female_id = auth.uid());

-- backfill claims for bounties already paid so retries cannot double-pay
insert into public.vip_bounty_payout_claims (male_id, female_id, claimed_at)
select distinct on (male_id) male_id, female_id, created_at
from public.bounty_earnings
where source in ('basic', 'premium') and clawed_back = false
order by male_id, created_at asc
on conflict (male_id) do nothing;

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
  v_claimed BOOLEAN;
BEGIN
  IF p_is_renewal THEN
    RETURN jsonb_build_object('success', false, 'reason', 'renewal_no_bounty');
  END IF;

  SELECT female_id INTO v_female_id
  FROM public.bounty_attributions
  WHERE male_id = p_male_id AND expires_at > now()
  ORDER BY (interaction_type = 'dm_two_way') DESC, last_interaction_at DESC
  LIMIT 1;

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

  -- Idempotent claim: exactly one initial VIP bounty payout per male, ever
  INSERT INTO public.vip_bounty_payout_claims (male_id, female_id)
  VALUES (p_male_id, v_female_id)
  ON CONFLICT (male_id) DO NOTHING;

  GET DIAGNOSTICS v_streak_count = ROW_COUNT;
  v_claimed := v_streak_count > 0;

  IF NOT v_claimed THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_awarded');
  END IF;

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
