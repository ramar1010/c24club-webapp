import { useState } from "react";
import { X, DollarSign, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BountyPostCallNudgeProps {
  maleId: string;
  maleName: string;
  conversationId?: string | null;
  onClose: () => void;
}

const QUICK_DMS = [
  "Hey, loved chatting. You should grab VIP so we can keep talking 💕",
  "Add me on VIP — I'll call you back tonight 😘",
  "You're cute. Get VIP and let's do a real call.",
];

const BountyPostCallNudge = ({ maleId, maleName, conversationId, onClose }: BountyPostCallNudgeProps) => {
  const [sending, setSending] = useState<string | null>(null);

  const sendQuickDm = async (msg: string) => {
    setSending(msg);
    try {
      let convId = conversationId;
      if (!convId) {
        const { data: me } = await supabase.auth.getUser();
        if (!me.user) throw new Error("Not authenticated");
        const [p1, p2] = [me.user.id, maleId].sort();
        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .eq("participant_1", p1)
          .eq("participant_2", p2)
          .maybeSingle();
        if (existing?.id) {
          convId = existing.id;
        } else {
          const { data: created, error } = await supabase
            .from("conversations")
            .insert({ participant_1: p1, participant_2: p2 })
            .select("id")
            .single();
          if (error) throw error;
          convId = created.id;
        }
      }

      const { data: me } = await supabase.auth.getUser();
      await supabase.from("dm_messages").insert({
        conversation_id: convId,
        sender_id: me.user!.id,
        content: msg,
      });

      // Refresh bounty attribution window
      await supabase.rpc("record_bounty_interaction", {
        p_male_id: maleId,
        p_interaction_type: "dm",
      });

      toast.success("Message sent — earn $2.49 if he subscribes in 7 days 💰");
      onClose();
    } catch (e: any) {
      toast.error("Couldn't send message", { description: e.message });
    } finally {
      setSending(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/85 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-neutral-900 border border-emerald-500/40 rounded-2xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-white font-black text-xl tracking-wide">
            EARN $2.49
          </h2>
          <p className="text-white/70 text-sm leading-relaxed">
            <span className="text-emerald-400 font-bold">{maleName}</span> isn't VIP yet.
            Send him a follow-up — if he subscribes to Premium in the next 7 days,
            <span className="text-emerald-400 font-bold"> you get $2.49</span>.
          </p>

          <div className="w-full space-y-2 mt-2">
            {QUICK_DMS.map((msg) => (
              <button
                key={msg}
                onClick={() => sendQuickDm(msg)}
                disabled={sending !== null}
                className="w-full text-left bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 rounded-xl px-4 py-3 text-white text-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="flex-1">{sending === msg ? "Sending..." : msg}</span>
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/60 text-xs mt-2 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default BountyPostCallNudge;
