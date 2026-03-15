import { X, Send } from "lucide-react";
import { ICEBREAKER_MESSAGES } from "@/hooks/useDiscover";

interface IcebreakerPickerProps {
  memberName: string;
  onSend: (message: string) => void;
  onClose: () => void;
}

const IcebreakerPicker = ({ memberName, onSend, onClose }: IcebreakerPickerProps) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-sm border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-bold text-sm">Send {memberName} a message 💬</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {ICEBREAKER_MESSAGES.map((msg) => (
            <button
              key={msg}
              onClick={() => onSend(msg)}
              className="w-full flex items-center justify-between gap-2 p-3 rounded-xl bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/30 text-white text-sm font-medium transition-colors text-left group"
            >
              <span>{msg}</span>
              <Send className="w-4 h-4 text-white/30 group-hover:text-pink-400 shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IcebreakerPicker;
