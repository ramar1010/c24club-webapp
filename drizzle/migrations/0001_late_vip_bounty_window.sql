CREATE TABLE public.late_bounty_windows (
  male_id uuid PRIMARY KEY,
  tier text NOT NULL DEFAULT 'basic',
  vip_started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  nudge_sent_at timestamptz,
  awarded_female_id uuid,
  awarded_at timestamptz
);
GRANT ALL ON public.late_bounty_windows TO service_role;
ALTER TABLE public.late_bounty_windows ENABLE ROW LEVEL SECURITY;

-- Record a 7-day late window when a new VIP guy had nobody linked
CREATE OR REPLACE FUNCTION public.auto_award_bounty_from_member_minutes_vip()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_gender TEXT; v_result JSONB; v_tier TEXT; v_was_vip BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN v_was_vip := COALESCE(OLD.is_vip, false);
  ELSIF TG_OP = 'INSERT' THEN v_was_vip := false;
  ELSE RETURN NEW; END IF;

  IF v_was_vip = true OR COALESCE(NEW.is_vip, false) <> true THEN RETURN NEW; END IF;

  SELECT lower(gender) INTO v_gender FROM public.members WHERE id = NEW.user_id;
  IF v_gender <> 'male' THEN RETURN NEW; END IF;

  v_tier := CASE WHEN lower(coalesce(NEW.vip_tier, '')) = 'premium' THEN 'premium' ELSE 'basic' END;

  SELECT public.award_bounty_for_subscription(
    NEW.user_id, v_tier, 'member_minutes:auto_vip:' || NEW.user_id::text, false
  ) INTO v_result;

  IF v_result->>'reason' = 'no_active_attribution'
     AND NOT EXISTS (SELECT 1 FROM public.vip_bounty_payout_claims WHERE male_id = NEW.user_id) THEN
    INSERT INTO public.late_bounty_windows (male_id, tier)
    VALUES (NEW.user_id, v_tier)
    ON CONFLICT (male_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fire the "new VIP guy, say hi" nudge
CREATE OR REPLACE FUNCTION public.notify_late_bounty_window()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/notify-new-vip-guy',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('male_id', NEW.male_id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_late_bounty_window failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_late_bounty_window
AFTER INSERT ON public.late_bounty_windows
FOR EACH ROW EXECUTE FUNCTION public.notify_late_bounty_window();

-- Two-way DM with a VIP guy inside his late window earns the bounty
CREATE OR REPLACE FUNCTION public.attribute_bounty_on_dm_two_way()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_owner_id uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  v_other_id uuid; v_sender_gender text; v_other_gender text;
  v_female_id uuid; v_male_id uuid; v_male_is_vip boolean;
  v_other_has_real_message boolean; v_active_id uuid;
  v_window public.late_bounty_windows%rowtype; v_result jsonb;
begin
  if NEW.sender_id is null or NEW.sender_id = v_owner_id then return NEW; end if;
  if NEW.content is null or NEW.content ~ '^(💰|📹|🎁|🎉)' then return NEW; end if;

  select case when c.participant_1 = NEW.sender_id then c.participant_2 else c.participant_1 end
    into v_other_id from public.conversations c where c.id = NEW.conversation_id;
  if v_other_id is null or v_other_id = v_owner_id then return NEW; end if;

  select lower(gender) into v_sender_gender from public.members where id = NEW.sender_id;
  select lower(gender) into v_other_gender from public.members where id = v_other_id;

  if v_sender_gender = 'female' and v_other_gender = 'male' then
    v_female_id := NEW.sender_id; v_male_id := v_other_id;
  elsif v_sender_gender = 'male' and v_other_gender = 'female' then
    v_female_id := v_other_id; v_male_id := NEW.sender_id;
  else return NEW; end if;

  select id into v_active_id from public.bounty_attributions
  where male_id = v_male_id and female_id = v_female_id and expires_at > now()
  for update;
  if v_active_id is not null then
    update public.bounty_attributions
      set last_interaction_at = greatest(last_interaction_at, NEW.created_at)
      where id = v_active_id;
    return NEW;
  end if;

  select (is_vip or admin_granted_vip) into v_male_is_vip
  from public.member_minutes where user_id = v_male_id;

  if coalesce(v_male_is_vip, false) then
    select * into v_window from public.late_bounty_windows
    where male_id = v_male_id and expires_at > now() and awarded_at is null;
    if v_window.male_id is null then return NEW; end if;
    if exists (select 1 from public.vip_bounty_payout_claims where male_id = v_male_id) then return NEW; end if;
  end if;

  select exists (
    select 1 from public.dm_messages d
    where d.conversation_id = NEW.conversation_id and d.sender_id = v_other_id
      and d.created_at < NEW.created_at and d.content is not null
      and d.content !~ '^(💰|📹|🎁|🎉)'
  ) into v_other_has_real_message;
  if not v_other_has_real_message then return NEW; end if;

  insert into public.bounty_attributions (male_id, female_id, interaction_type, last_interaction_at, expires_at)
  values (v_male_id, v_female_id, 'dm_two_way', NEW.created_at, NEW.created_at + interval '30 days')
  on conflict (male_id, female_id) do update
    set interaction_type = 'dm_two_way', last_interaction_at = NEW.created_at,
        expires_at = NEW.created_at + interval '30 days'
    where public.bounty_attributions.expires_at <= now();

  if v_window.male_id is not null then
    begin
      v_result := public.award_bounty_for_subscription(
        v_male_id, v_window.tier, 'late_vip:' || v_male_id::text, false);
      if coalesce((v_result->>'success')::boolean, false) then
        update public.late_bounty_windows
          set awarded_at = now(), awarded_female_id = (v_result->>'female_id')::uuid
          where male_id = v_male_id;
      end if;
    exception when others then
      raise warning 'late bounty award failed for %: %', v_male_id, sqlerrm;
    end;
  end if;

  return NEW;
end;
$function$;