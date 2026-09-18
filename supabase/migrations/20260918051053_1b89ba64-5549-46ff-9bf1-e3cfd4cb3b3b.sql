CREATE OR REPLACE FUNCTION public.attribute_bounty_on_dm_two_way()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
declare
  v_owner_id uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  v_other_id uuid;
  v_sender_gender text;
  v_other_gender text;
  v_female_id uuid;
  v_male_id uuid;
  v_male_is_vip boolean;
  v_other_has_real_message boolean;
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

  -- Don't create a new DM attribution if the male is already VIP
  select (is_vip or admin_granted_vip) into v_male_is_vip
  from public.member_minutes where user_id = v_male_id;
  if coalesce(v_male_is_vip, false) then
    return NEW;
  end if;

  -- A real back-and-forth conversation qualifies: the other participant
  -- must already have sent at least one user-authored message in this thread.
  select exists (
    select 1 from public.dm_messages d
    where d.conversation_id = NEW.conversation_id
      and d.sender_id = v_other_id
      and d.created_at < NEW.created_at
      and d.content is not null
      and d.content !~ '^(💰|📹|🎁|🎉)'
  ) into v_other_has_real_message;

  if not v_other_has_real_message then
    return NEW;
  end if;

  -- This message completes the conversation; lock attribution for 30 days from here.
  insert into public.bounty_attributions (male_id, female_id, interaction_type, last_interaction_at, expires_at)
  values (v_male_id, v_female_id, 'dm_two_way', NEW.created_at, NEW.created_at + interval '30 days')
  on conflict (male_id, female_id) do update
    set interaction_type = 'dm_two_way',
        last_interaction_at = NEW.created_at,
        expires_at = NEW.created_at + interval '30 days'
    where public.bounty_attributions.expires_at <= now();

  return NEW;
end;
$$;

-- Ensure the function is only callable by service roles / triggers, not directly by clients
REVOKE ALL ON FUNCTION public.attribute_bounty_on_dm_two_way() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attribute_bounty_on_dm_two_way() TO service_role;