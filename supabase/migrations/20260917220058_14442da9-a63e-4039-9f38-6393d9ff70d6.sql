create or replace function public.attribute_bounty_on_male_dm_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_gender text;
  v_female_id uuid;
  v_male_is_vip boolean;
begin
  select lower(gender) into v_sender_gender from public.members where id = NEW.sender_id;
  if v_sender_gender is distinct from 'male' then
    return NEW;
  end if;

  select d.sender_id into v_female_id
  from public.dm_messages d
  join public.members m on m.id = d.sender_id
  where d.conversation_id = NEW.conversation_id
    and d.sender_id <> NEW.sender_id
    and lower(m.gender) = 'female'
  order by d.created_at desc
  limit 1;

  if v_female_id is null then
    return NEW;
  end if;

  select (is_vip or admin_granted_vip) into v_male_is_vip
  from public.member_minutes where user_id = NEW.sender_id;
  if coalesce(v_male_is_vip, false) then
    return NEW;
  end if;

  delete from public.bounty_attributions
  where male_id = NEW.sender_id and female_id <> v_female_id;

  insert into public.bounty_attributions (male_id, female_id, interaction_type, last_interaction_at, expires_at)
  values (NEW.sender_id, v_female_id, 'dm', now(), now() + interval '7 days')
  on conflict (male_id, female_id) do update
    set interaction_type = 'dm',
        last_interaction_at = now(),
        expires_at = now() + interval '7 days';

  return NEW;
end;
$$;

revoke execute on function public.attribute_bounty_on_male_dm_reply() from public, anon, authenticated;

drop trigger if exists trg_dm_reply_bounty_attribution on public.dm_messages;
create trigger trg_dm_reply_bounty_attribution
  after insert on public.dm_messages
  for each row execute function public.attribute_bounty_on_male_dm_reply();