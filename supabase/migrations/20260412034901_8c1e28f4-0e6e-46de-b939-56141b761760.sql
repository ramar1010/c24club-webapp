DROP TRIGGER IF EXISTS notify_direct_call_invite_on_insert ON public.direct_call_invites;

CREATE TRIGGER notify_direct_call_invite_on_insert
AFTER INSERT ON public.direct_call_invites
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION public.notify_direct_call_invite();