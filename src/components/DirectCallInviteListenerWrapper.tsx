import { useDirectCallInviteListener } from "@/hooks/useDirectCallInviteListener";

export function DirectCallInviteListenerWrapper() {
  useDirectCallInviteListener();
  return null;
}
