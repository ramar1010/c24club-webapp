import { Lock, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface CameraUnlockButtonProps {
  recipientId: string;
  roomId?: string;
}

const CameraUnlockButton = ({ recipientId, roomId }: CameraUnlockButtonProps) => {
  const [loading, setLoading] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["camera_unlock_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("camera_unlock_settings")
        .select("*")
        .limit(1)
        .single();
      return data;
    },
  });

  const priceCents = settings?.price_cents ?? 299;
  const priceDisplay = (priceCents / 100).toFixed(2);

  const handleUnlock = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("camera-unlock", {
        body: {
          action: "create-checkout",
          recipient_id: recipientId,
          room_id: roomId,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start camera unlock");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleUnlock}
      disabled={loading}
      className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-white font-bold text-xs px-3 py-2 rounded-full shadow-lg transition-all animate-pulse hover:animate-none"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Lock className="w-4 h-4" />
      )}
      <span>Unlock Camera ${priceDisplay}</span>
    </button>
  );
};

export default CameraUnlockButton;
