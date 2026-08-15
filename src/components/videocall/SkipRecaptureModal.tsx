import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, MessageCircle } from "lucide-react";

interface SkipRecaptureModalProps {
  partnerId: string;
  onMessage: (partnerId: string) => void;
  onClose: () => void;
}

/** One-tap "message them" prompt right after a short call ends. */
const SkipRecaptureModal = ({ partnerId, onMessage, onClose }: SkipRecaptureModalProps) => {
  const { data: partner } = useQuery({
    queryKey: ["skip-recapture-partner", partnerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("name, image_url, gender")
        .eq("id", partnerId)
        .maybeSingle();
      return data;
    },
  });

  const isFemalePartner = (partner?.gender ?? "").toLowerCase() === "female";
  const pronoun = isFemalePartner ? "her" : "him";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 rounded-2xl p-5 max-w-xs w-full text-center relative border border-pink-500/40">
        <button onClick={onClose} className="absolute top-3 right-3">
          <X className="w-5 h-5 text-neutral-500 hover:text-white transition-colors" />
        </button>

        {partner?.image_url ? (
          <img
            src={partner.image_url}
            alt={partner?.name ?? "partner"}
            className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-2 border-pink-500"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-pink-500/20 border-2 border-pink-500 mx-auto mb-3 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-pink-400" />
          </div>
        )}

        <h3 className="text-white font-black text-lg mb-1">That was quick 👀</h3>
        <p className="text-white/60 text-xs mb-4">
          Send {partner?.name ?? pronoun} a message — {pronoun} gets a notification even after leaving.
        </p>

        <button
          onClick={() => onMessage(partnerId)}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black text-sm py-3 rounded-full hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          MESSAGE {partner?.name ? partner.name.toUpperCase() : pronoun.toUpperCase()}
        </button>

        <button onClick={onClose} className="mt-3 text-neutral-500 hover:text-white text-xs">
          Keep swiping
        </button>
      </div>
    </div>,
    document.body
  );
};

export default SkipRecaptureModal;
