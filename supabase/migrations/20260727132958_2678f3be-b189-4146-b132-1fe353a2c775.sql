CREATE OR REPLACE FUNCTION public.notify_discover_image_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  service_key text;
  v_gender text;
  v_title text;
  v_body text;
  v_msg text;
  owner_id uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  conv_id uuid;
BEGIN
  IF NEW.image_status IS NOT DISTINCT FROM OLD.image_status THEN
    RETURN NEW;
  END IF;
  IF lower(COALESCE(NEW.image_status, '')) <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF lower(COALESCE(OLD.image_status, '')) = 'approved' THEN
    RETURN NEW;
  END IF;

  v_gender := lower(COALESCE(NEW.gender, ''));

  v_title := '🎉 You''re live on Discover!';
  IF v_gender = 'female' THEN
    v_body := 'Your photo was approved — guys can now find you and message you. Reply fast to earn more.';
    v_msg := E'🎉 Great news — your Discover photo was approved!\n\nYou''re now live on the Discover page, which means guys can find you, send you interests, gifts and DMs.\n\n💡 Tips:\n• Active users stay at the top of Discover — the more you chat, the more visibility you get\n• Reply quickly — guys only get 3 free messages before they must buy VIP to keep talking to you, and you earn gifted minutes when they upgrade\n• Add a short bio so people know what to message you about';
  ELSE
    v_body := 'Your photo was approved — you''re now visible on Discover. Start messaging to connect.';
    v_msg := E'🎉 Great news — your Discover photo was approved!\n\nYou''re now live on the Discover page, so other members can find you, send interests and message you.\n\n💡 Tip: Active users stay at the top of Discover — the more you chat, the more people see your profile.';
  END IF;

  -- System DM (visible in-app even if push is disabled)
  BEGIN
    SELECT id INTO conv_id FROM public.conversations
    WHERE (participant_1 = owner_id AND participant_2 = NEW.id)
       OR (participant_1 = NEW.id AND participant_2 = owner_id)
    LIMIT 1;

    IF conv_id IS NULL THEN
      INSERT INTO public.conversations (participant_1, participant_2)
      VALUES (owner_id, NEW.id)
      RETURNING id INTO conv_id;
    END IF;

    INSERT INTO public.dm_messages (conversation_id, sender_id, content)
    VALUES (conv_id, owner_id, v_msg);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_discover_image_approved DM failed for %: %', NEW.id, SQLERRM;
  END;

  -- Push notification
  BEGIN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

    PERFORM net.http_post(
      url := 'https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_key, '')
      ),
      body := jsonb_build_object(
        'user_id', NEW.id,
        'title', v_title,
        'body', v_body,
        'notification_type', 'discover_approved',
        'cooldown_minutes', 0,
        'force_send', true,
        'data', jsonb_build_object('screen', '/discover', 'url', '/discover', 'type', 'discover_approved')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_discover_image_approved push failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_discover_image_approved ON public.members;
CREATE TRIGGER trg_notify_discover_image_approved
AFTER UPDATE OF image_status ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.notify_discover_image_approved();