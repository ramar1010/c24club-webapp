import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { messaging, getToken, onMessage } from "@/lib/firebase";

const VAPID_KEY = "BEo__3du10IrVV25ijuIjj50R14egL1ONqFpkzMXmC0RFBz8xG7J3zbczrLHfITkU1DCItWoRSZ17uU7fo3rYfk";

interface NotifyMeToggleProps {
  userId: string;
  userGender: string | null;
}

const NotifyMeToggle = ({ userId, userGender }: NotifyMeToggleProps) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load initial state
  useEffect(() => {
    if (!userId || userId === "anonymous") return;
    supabase
      .from("members")
      .select("notify_enabled")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.notify_enabled) setEnabled(true);
      });
  }, [userId]);

  // Listen for foreground messages
  useEffect(() => {
    if (!messaging) return;
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground message:", payload);
      toast(payload.notification?.title || "C24 Club", {
        description: payload.notification?.body,
      });
    });
    return () => unsubscribe();
  }, []);

  const registerServiceWorker = async () => {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );
      return registration;
    }
    return null;
  };

  const handleToggle = async (checked: boolean) => {
    if (loading) return;
    setLoading(true);

    try {
      if (checked) {
        // Request notification permission
        if (!("Notification" in window)) {
          toast.error("Your browser doesn't support notifications");
          setLoading(false);
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Please allow notifications to use this feature");
          setLoading(false);
          return;
        }

        // Register service worker and get FCM token
        const swRegistration = await registerServiceWorker();

        let token: string | null = null;
        if (messaging && VAPID_KEY) {
          try {
            token = await getToken(messaging, {
              vapidKey: VAPID_KEY,
              serviceWorkerRegistration: swRegistration || undefined,
            });
            console.log("[FCM] Token obtained:", token?.substring(0, 20) + "...");
          } catch (err) {
            console.warn("[FCM] Token registration failed:", err);
            // Still enable notify_enabled even without FCM token
            // Discord notifications will still work
          }
        }

        // Store token and enabled state
        await supabase
          .from("members")
          .update({
            notify_enabled: true,
            ...(token ? { push_token: token } : {}),
          } as any)
          .eq("id", userId);

        setEnabled(true);
        toast.success("🔔 You'll be notified when someone is waiting!");
      } else {
        await supabase
          .from("members")
          .update({ notify_enabled: false, push_token: null } as any)
          .eq("id", userId);

        setEnabled(false);
        toast.info("Notifications disabled");
      }
    } catch (err) {
      console.error("Notify toggle error:", err);
      toast.error("Failed to update notification preference");
    } finally {
      setLoading(false);
    }
  };

  const label =
    userGender === "Female"
      ? "Notify me when a male is online"
      : "Notify me when a female comes online";

  return (
    <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
      {enabled ? (
        <Bell className="w-4 h-4 text-yellow-400 shrink-0" />
      ) : (
        <BellOff className="w-4 h-4 text-neutral-500 shrink-0" />
      )}
      <span className="text-[11px] text-neutral-300 leading-tight flex-1">
        {label}
      </span>
      <Switch
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={loading}
        className="shrink-0 scale-75"
      />
    </div>
  );
};

export default NotifyMeToggle;
