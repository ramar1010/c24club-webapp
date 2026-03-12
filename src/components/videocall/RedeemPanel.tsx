import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import storeIcon from "@/assets/videocall/store.png";

interface RedeemPanelProps {
  totalMinutes: number;
  onClose: () => void;
}

const RedeemPanel = ({ totalMinutes, onClose }: RedeemPanelProps) => {
  const navigate = useNavigate();

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
