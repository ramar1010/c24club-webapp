import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronDown, ChevronUp, Gift } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVipStatus } from "@/hooks/useVipStatus";

const RARITY_COLORS: Record<string, string> = {
  common: "text-white",
  rare: "text-red-500",
  legendary: "text-yellow-400",
};

const RARITY_EMOJI: Record<string, string> = {
  common: "",
  rare: "🔥",
  legendary: "👑",
};

const FILTER_OPTIONS = ["Products", "Giftcards", "Perks"] as const;
type FilterType = (typeof FILTER_OPTIONS)[number];

const filterToType: Record<FilterType, string> = {
  Products: "product",
  Giftcards: "giftcard",
  Perks: "perk",
};

const MyRewardsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("Products");

  const [showGifts, setShowGifts] = useState(false);
  const { subscribed } = useVipStatus(user?.id ?? null);

  const { data: redemptions = [], isLoading } = useQuery({
    queryKey: ["my-redemptions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_redemptions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: giftsReceived = [], isLoading: giftsLoading } = useQuery({
    queryKey: ["gifts-received", user?.id],
    enabled: !!user && subscribed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gift_transactions")
        .select("*")
        .eq("recipient_id", user!.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = redemptions.filter(
    (r: any) => r.reward_type === filterToType[selectedFilter]
  );

  const handleFilterSelect = (f: FilterType) => {
    setSelectedFilter(f);
    setDropdownOpen(false);
  };

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col">
      {/* Back button */}
      <div className="w-full flex items-center pt-3 pb-2 px-4">
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-black text-center italic mt-2 mb-6">
        My Rewards
      </h1>

      {/* Dropdown filter */}
      <div className="px-6 mb-6">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full bg-black border-2 border-white rounded-full py-3 px-6 flex items-center justify-center gap-2 font-black text-lg tracking-wide"
        >
          {selectedFilter}
          {dropdownOpen ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {dropdownOpen && (
          <div className="border-2 border-white rounded-2xl mt-2 overflow-hidden bg-black">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => handleFilterSelect(opt)}
                className={`w-full py-3 text-center font-black text-lg tracking-wide hover:bg-neutral-800 transition-colors ${
                  opt === selectedFilter ? "text-white" : "text-neutral-400"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rewards grid */}
      <div className="flex-1 px-4 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-neutral-500 text-center py-16 font-bold">
            No redeemed {selectedFilter.toLowerCase()} yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((item: any) => {
              const rarityColor = RARITY_COLORS[item.reward_rarity] || "text-white";
              const rarityEmoji = RARITY_EMOJI[item.reward_rarity] || "";
              const isLegendaryCashout = item.cashout_amount && item.cashout_amount > 0;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800"
                >
                  {/* Rarity label */}
                  <div className="px-3 pt-2">
                    <span className={`font-black text-sm ${rarityColor}`}>
                      {item.reward_rarity.charAt(0).toUpperCase() +
                        item.reward_rarity.slice(1)}
                      {rarityEmoji}
                    </span>
                    {isLegendaryCashout && (
                      <span className="block text-green-400 font-black text-xs">
                        Cash Out ${item.cashout_amount}
                      </span>
                    )}
                  </div>

                  {/* Image */}
                  <div className="aspect-square bg-neutral-800 mx-2 mt-1 rounded-xl overflow-hidden">
                    {item.reward_image_url ? (
                      <img
                        src={item.reward_image_url}
                        alt={item.reward_title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl">🎁</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 text-center">
                    <p className="font-black text-sm leading-tight">
                      {item.reward_title}
                    </p>

                    {isLegendaryCashout ? (
                      <>
                        <p className="text-green-400 font-black text-xs mt-1">
                          💰 You cashed out ${item.cashout_amount}
                        </p>
                        {item.cashout_paypal && (
                          <p className="text-[10px] text-neutral-400 mt-1">
                            PayPal: {item.cashout_paypal}
                          </p>
                        )}
                        <p className="text-xs font-bold text-neutral-300 mt-1">
                          {item.cashout_status === "pending" || item.status === "processing"
                            ? "Under Process"
                            : item.cashout_status || item.status}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-bold mt-1 uppercase">
                          CASHOUT REWARD
                        </p>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                          You chose to cashout ${item.cashout_amount} in place of product
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] text-neutral-400 mt-1">
                          {item.reward_rarity === "legendary" ? "You redeemed the item only" : "We're Preparing Your Product. Be Patient. This may take up to 24 hours!"}
                        </p>
                        <button className="text-red-500 font-bold text-xs mt-2 hover:underline">
                          Edit Shipping Details
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unlock Rewards Early */}
      <div className="px-6 pb-8 pt-4">
        <button className="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white font-black text-lg py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide">
          Unlock Rewards Early
        </button>
      </div>
    </div>
  );
};

export default MyRewardsPage;
