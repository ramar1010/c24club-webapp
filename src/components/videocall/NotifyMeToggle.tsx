import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

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

  const handleToggle = async (checked: boolean) => {
    if (loading) return;
    setLoading(true);

    try {
      if (checked) {
        // Request push notification permission
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

        // Store the enabled state (push_token will be set when FCM is configured)
        await supabase
          .from("members")
          .update({ notify_enabled: true } as any)
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
      ? "Notify me when someone is waiting so I can Earn Cash!"
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
