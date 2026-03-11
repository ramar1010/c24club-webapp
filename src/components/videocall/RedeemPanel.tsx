import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import storeIcon from "@/assets/videocall/store.png";

interface RedeemPanelProps {
  totalMinutes: number;
  onClose: () => void;
}

const RedeemPanel = ({ totalMinutes, onClose }: RedeemPanelProps) => {
  const navigate = useNavigate();

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .order("unlock_minutes", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onClose}
          className="text-red-500 hover:text-red-400 transition-colors"
        >
          <X className="w-8 h-8" strokeWidth={3} />
        </button>
        <h2 className="text-2xl font-black text-white tracking-wide">Redeem</h2>
      </div>

      {/* Balance */}
      <p className="text-lg font-bold text-white mb-5">
        You have{" "}
        <span className="text-green-400">{totalMinutes}</span>{" "}
        Minutes To Redeem
      </p>

      {/* Milestone Tiers */}
      <div className="flex flex-col gap-3 mb-5">
        {milestones.map((m, idx) => (
          <button
            key={m.id}
            disabled={totalMinutes < m.unlock_minutes}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
              totalMinutes >= m.unlock_minutes
                ? "bg-neutral-800 hover:bg-neutral-700 border border-neutral-600"
                : "bg-neutral-800/50 border border-neutral-700/50 opacity-50 cursor-not-allowed"
            }`}
          >
            <span className="text-white font-bold text-lg">{idx + 1}.</span>
            <span className="text-3xl">🎁</span>
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg leading-tight">
                {m.title}
              </span>
              <span className="text-neutral-400 text-sm">
                {m.unlock_minutes} minutes
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* View Reward Store */}
      <div className="text-center">
        <button onClick={() => navigate("/store")} className="flex items-center justify-center gap-2 mx-auto hover:opacity-80 transition-opacity">
          <img src={storeIcon} alt="Store" className="w-10 h-10 object-contain" />
          <span className="text-white font-bold text-lg">View Reward Store</span>
        </button>
        <p className="text-neutral-500 text-xs font-bold mt-2">
          The more you chat the more rewards appear!
        </p>
      </div>
    </div>
  );
};

export default RedeemPanel;
