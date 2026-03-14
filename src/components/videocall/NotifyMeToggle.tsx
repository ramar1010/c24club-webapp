import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { getMessagingInstance, messagingInitError, getToken, onMessage } from "@/lib/firebase";

const VAPID_KEY = "BEo__3du10IrVV25ijuIjj50R14egL1ONqFpkzMXmC0RFBz8xG7J3zbczrLHfITkU1DCItWoRSZ17uU7fo3rYfk";

interface NotifyMeToggleProps {
  userId: string;
  userGender: string | null;
}

const IOS_REGEX = /iPad|iPhone|iPod/i;

const getPushSetupErrorMessage = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: string }).code) : "";

  if (code === "messaging/invalid-vapid-key") {
    return "Push configuration error (invalid VAPID key).";
  }

  if (code === "messaging/permission-blocked") {
    return "Notifications are blocked. Re-enable them in browser site settings.";
  }

  if (code === "messaging/unsupported-browser") {
    return "This browser doesn't support web push notifications.";
  }

  if (code === "messaging/failed-service-worker-registration") {
    return "Could not register notification background worker.";
  }

  const message = error instanceof Error ? error.message : "";
  if (message) return message;

  return "Push setup failed. Please try again.";
};

const checkPushSupport = () => {
  if (typeof window === "undefined") {
    return { supported: false, message: "Browser environment required." };
  }

  if (!window.isSecureContext) {
    console.warn("[Push] Not secure context");
    return { supported: false, message: "Notifications require HTTPS." };
  }

  if (!("Notification" in window)) {
    console.warn("[Push] Notification API missing");
    return { supported: false, message: "This browser doesn't support notifications." };
  }

  if (!("serviceWorker" in navigator)) {
    console.warn("[Push] ServiceWorker missing");
    return { supported: false, message: "Service workers are not supported in this browser." };
  }

  if (!("PushManager" in window)) {
    console.warn("[Push] PushManager missing");
    return { supported: false, message: "Push notifications are not supported in this browser." };
  }

  console.log("[Push] All checks passed, push supported");
  return { supported: true, message: "" };
};

const NotifyMeToggle = ({ userId, userGender }: NotifyMeToggleProps) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(msg);
    setDebugLog(prev => [...prev.slice(-8), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  // Load initial state
  useEffect(() => {
    if (!userId || userId === "anonymous") return;
    supabase
      .from("members")
      .select("notify_enabled, push_token")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setEnabled(Boolean(data?.notify_enabled && data?.push_token));
      });
  }, [userId]);

  // Listen for foreground messages
  useEffect(() => {
    const msg = getMessagingInstance();
    if (!msg) return;
    const unsubscribe = onMessage(msg, (payload) => {
      console.log("[FCM] Foreground message:", payload);
      toast(payload.notification?.title || "C24 Club", {
        description: payload.notification?.body,
      });
    });
    return () => unsubscribe();
  }, []);

  const registerServiceWorker = async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not supported in this browser.");
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;
    return registration;
  };

  const handleToggle = async (checked: boolean) => {
    if (loading) return;
    setLoading(true);
    addLog(`Toggle pressed, checked: ${checked}`);

    try {
      const normalizedGender = userGender?.toLowerCase();
      if (!normalizedGender) {
        toast.error("Please set your gender on the home profile popup first");
        addLog("ERROR: no gender set");
        return;
      }

      if (checked) {
        const pushSupport = checkPushSupport();
        addLog(`Push support: ${JSON.stringify(pushSupport)}`);
        if (!pushSupport.supported) {
          toast.error(pushSupport.message);
          return;
        }

        addLog(`Current permission: ${Notification.permission}`);
        let permission = Notification.permission;

        if (permission === "default") {
          addLog("Requesting permission...");
          permission = await Notification.requestPermission();
          addLog(`Permission result: ${permission}`);
        }

        if (permission === "denied") {
          addLog("Permission DENIED");
          toast.error("Notifications are blocked. Enable them in your browser site settings and try again.");
          return;
        }

        if (permission !== "granted") {
          addLog(`Permission not granted: ${permission}`);
          toast.error("Please allow notifications to use this feature");
          return;
        }

        addLog("Registering SW...");
        let swRegistration: ServiceWorkerRegistration;
        try {
          swRegistration = await registerServiceWorker();
          addLog("SW registered OK");
        } catch (swErr) {
          addLog(`SW FAILED: ${swErr}`);
          toast.error("Could not register notification worker. Try refreshing the page.");
          return;
        }

        addLog("Init messaging...");
        let msg;
        try {
          msg = getMessagingInstance();
        } catch (initErr) {
          addLog(`Messaging init CRASHED: ${initErr}`);
          toast.error("Push notifications failed to initialize.");
          return;
        }

        if (!msg) {
          addLog(`Messaging null: ${messagingInitError}`);
          toast.error(messagingInitError || "Push messaging is not available.");
          return;
        }

        addLog("Getting FCM token...");
        let token: string | null = null;
        try {
          token = await getToken(msg, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration,
          });
          addLog(`Token: ${token ? "obtained" : "null"}`);
        } catch (tokenErr) {
          addLog(`getToken FAILED: ${tokenErr}`);
          const errMsg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
          if (errMsg.includes("indexedDB") || errMsg.includes("IndexedDB") || errMsg.includes("backing store")) {
            toast.error("Browser blocking storage needed for notifications.");
          } else {
            toast.error(getPushSetupErrorMessage(tokenErr));
          }
          return;
        }

        if (!token) {
          addLog("Token is null/empty");
          toast.error("Could not create push token. Please try again.");
          return;
        }

        const { error } = await supabase
          .from("members")
          .update({ notify_enabled: true, push_token: token } as any)
          .eq("id", userId);

        if (error) throw error;

        setEnabled(true);
        addLog("SUCCESS - notifications enabled");
        toast.success("🔔 Notifications enabled!");
      } else {
        const { error } = await supabase
          .from("members")
          .update({ notify_enabled: false, push_token: null } as any)
          .eq("id", userId);

        if (error) throw error;

        setEnabled(false);
        addLog("Notifications disabled");
        toast.info("Notifications disabled");
      }
    } catch (err) {
      addLog(`CATCH error: ${err}`);
      toast.error(getPushSetupErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const normalizedGender = userGender?.toLowerCase();
  const label =
    normalizedGender === "female"
      ? "Notify me when a male is online"
      : normalizedGender === "male"
        ? "Notify me when a female comes online"
        : "Set your gender first to get accurate notifications";

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
