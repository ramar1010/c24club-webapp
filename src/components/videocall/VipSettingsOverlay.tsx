import { X, Plus, Trash2, ChevronUp } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import maleIcon from "@/assets/profile/male-shades.png";
import femaleIcon from "@/assets/profile/girl-shades.png";
import chanceEnhancerIcon from "@/assets/vip/chance-enhancer.png";
import getGiftedIcon from "@/assets/vip/get-gifted.png";
import rewardsGift from "@/assets/profile/rewards-gift.png";

interface VipSettingsOverlayProps {
  onClose: () => void;
  userId: string;
  vipTier: "basic" | "premium" | null;
  genderFilter: string;
  onGenderFilterChange: (g: string) => void;
}

// Platform icon/color mapping
const socialPlatforms: Record<string, { icon: string; color: string }> = {
  "$": { icon: "💲", color: "text-green-400" },
  "cashapp": { icon: "💲", color: "text-green-400" },
  "cashtag": { icon: "💲", color: "text-green-400" },
  "tiktok": { icon: "🎵", color: "text-white" },
  "instagram": { icon: "📷", color: "text-pink-400" },
  "snapchat": { icon: "👻", color: "text-yellow-400" },
  "twitter": { icon: "🐦", color: "text-blue-400" },
  "youtube": { icon: "▶️", color: "text-red-500" },
  "default": { icon: "🔗", color: "text-blue-400" },
};

function getSocialPlatform(handle: string) {
  const lower = handle.toLowerCase();
  if (lower.startsWith("$")) return socialPlatforms["$"];
  for (const key of Object.keys(socialPlatforms)) {
    if (lower.includes(key)) return socialPlatforms[key];
  }
  return socialPlatforms["default"];
}

const VipSettingsOverlay = ({ onClose, userId, vipTier, genderFilter, onGenderFilterChange }: VipSettingsOverlayProps) => {
  const [showPromoAds, setShowPromoAds] = useState(true);
  const [getGifted, setGetGifted] = useState(false);
  const [pinnedSocials, setPinnedSocials] = useState<string[]>([]);
  const [newSocial, setNewSocial] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddInput, setShowAddInput] = useState(false);

  const isPremium = vipTier === "premium";

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("vip_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setShowPromoAds(data.show_promo_ads);
      setGetGifted(data.get_gifted);
      setPinnedSocials(data.pinned_socials || []);
    }
    setLoading(false);
  };

  const saveSettings = async (updates: Record<string, any>) => {
    const { data: existing } = await supabase
      .from("vip_settings")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("vip_settings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    } else {
      await supabase
        .from("vip_settings")
        .insert({ user_id: userId, ...updates });
    }
  };

  const handleTogglePromos = async (val: boolean) => {
    setShowPromoAds(val);
    await saveSettings({ show_promo_ads: val });
    toast.success(val ? "Promo ads enabled" : "Promo ads disabled");
  };

  const handleToggleGifted = async (val: boolean) => {
    setGetGifted(val);
    await saveSettings({ get_gifted: val });
    toast.success(val ? "Gifting enabled" : "Gifting disabled");
  };

  const handleAddSocial = async () => {
    if (!newSocial.trim()) return;
    const updated = [...pinnedSocials, newSocial.trim()].slice(0, 6);
    setPinnedSocials(updated);
    setNewSocial("");
    setShowAddInput(false);
    await saveSettings({ pinned_socials: updated });
    toast.success("Social added");
  };

  const handleRemoveSocial = async (index: number) => {
    const updated = pinnedSocials.filter((_, i) => i !== index);
    setPinnedSocials(updated);
    await saveSettings({ pinned_socials: updated });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-neutral-400 animate-pulse">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
      <div className="min-h-screen flex flex-col px-5 py-4">
        {/* Close */}
        <button onClick={onClose} className="self-start mb-2">
          <X className="w-7 h-7 text-red-500" />
        </button>

        {/* Header */}
        <h1
          className="text-white text-2xl font-black tracking-wider italic"
          style={{ fontFamily: "'Antigone Compact Pro', sans-serif" }}
        >
          VIP FEATURES
        </h1>
        <p className="text-white text-sm font-black tracking-widest mb-5">SETTINGS</p>

        {/* Connect With */}
        <p className="text-white text-sm font-black text-center mb-3">Connect With</p>
        <div className="flex justify-center items-end gap-3 mb-5">
          {/* Male */}
          <button
            onClick={() => onGenderFilterChange("guys")}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="relative">
              {genderFilter === "guys" && (
                <span className="absolute -top-1 -left-1 text-green-400 text-xs">☑️</span>
              )}
              <img src={maleIcon} alt="Male" className="w-14 h-14 object-contain" />
            </div>
            <span className="text-white text-[10px] font-black">Male</span>
          </button>

          {/* Both */}
          <button
            onClick={() => onGenderFilterChange("both")}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="relative">
              {genderFilter === "both" && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] text-white font-black bg-neutral-700 px-1 rounded">Both</span>
              )}
              <div className="flex -space-x-3 mt-2">
                <img src={maleIcon} alt="Male" className="w-12 h-12 object-contain" />
                <img src={femaleIcon} alt="Female" className="w-12 h-12 object-contain" />
              </div>
            </div>
          </button>

          {/* Female */}
          <button
            onClick={() => onGenderFilterChange("girls")}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="relative">
              {genderFilter === "girls" && (
                <span className="absolute -top-1 -right-1 text-green-400 text-xs">☑️</span>
              )}
              <img src={femaleIcon} alt="Female" className="w-14 h-14 object-contain" />
            </div>
            <span className="text-white text-[10px] font-black">Female</span>
          </button>
        </div>

        {/* Show Promo Ads */}
        <p className="text-white text-sm font-black text-center mb-2">Show Promo Ads.</p>
        <div className="flex justify-center gap-6 mb-5">
          <button
            onClick={() => handleTogglePromos(true)}
            className="flex items-center gap-1.5"
          >
            <span className={`text-sm ${showPromoAds ? "text-green-400" : "text-neutral-600"}`}>
              {showPromoAds ? "☑️" : "⬜"}
            </span>
            <span className={`text-sm font-black ${showPromoAds ? "text-white" : "text-neutral-500"}`}>Yes</span>
          </button>
          <button
            onClick={() => handleTogglePromos(false)}
            className="flex items-center gap-1.5"
          >
            <span className={`text-sm ${!showPromoAds ? "text-green-400" : "text-neutral-600"}`}>
              {!showPromoAds ? "☑️" : "⬜"}
            </span>
            <span className={`text-sm font-black ${!showPromoAds ? "text-white" : "text-neutral-500"}`}>No</span>
          </button>
        </div>
        {!isPremium && !showPromoAds && (
          <p className="text-yellow-500 text-[10px] text-center mb-3 font-bold">Premium VIP required to disable ads</p>
        )}

        {/* Pin Social & Pay Apps On Screen */}
        <div className="mb-5">
          <p className="text-white text-sm font-black text-center mb-2">
            Pin Social & Pay Apps<br />On Screen. 📌
          </p>

          {/* Social list */}
          <div className="space-y-1.5 mb-2">
            {pinnedSocials.map((social, i) => {
              const platform = getSocialPlatform(social);
              return (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-xs">✅</span>
                    <span className={`${platform.color} text-sm`}>{platform.icon}</span>
                    <span className="text-white text-sm font-bold">
                      {social.startsWith("@") || social.startsWith("$") || social.startsWith("/") ? social : `@${social}`}
                    </span>
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <button
                    onClick={() => handleRemoveSocial(i)}
                    className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add social */}
          {pinnedSocials.length < 6 && (
            <>
              {showAddInput ? (
                <div className="flex gap-2 items-center">
                  <input
                    value={newSocial}
                    onChange={(e) => setNewSocial(e.target.value)}
                    placeholder="@username or $cashtag"
                    autoFocus
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-green-500"
                    onKeyDown={(e) => e.key === "Enter" && handleAddSocial()}
                  />
                  <button onClick={handleAddSocial} className="text-green-400 font-black text-sm px-2">Add</button>
                  <button onClick={() => setShowAddInput(false)}>
                    <ChevronUp className="w-4 h-4 text-neutral-500" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddInput(true)}
                  className="flex items-center gap-1 text-neutral-500 text-xs font-bold hover:text-green-400 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Social
                </button>
              )}
            </>
          )}
        </div>

        {/* Chance Enhancer */}
        <div className="flex items-center gap-2 mb-1">
          <img src={chanceEnhancerIcon} alt="" className="w-8 h-8 object-contain" />
          <div>
            <span className="text-white text-sm font-black">Chance Enhancer</span>
            <br />
            <span className="text-orange-400 text-sm font-black">35%+</span>
          </div>
        </div>
        <p className="text-neutral-500 text-[10px] mb-4 ml-10">
          You get 35%+ of winning rare and legendary items each month! You also increase your chance enhancer faster!
        </p>

        {/* Get Gifted By Users */}
        <div className="flex items-start gap-2 mb-5">
          <div className="flex flex-col">
            <p className="text-white text-sm font-black">Get Gifted By Users.</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-orange-400 font-black text-sm">2</span>
              <span className="text-white text-xs">Reach</span>
              <span className="text-orange-400 font-black text-sm">3</span>
              <span className="text-white text-xs">to Redeem.</span>
              <img src={rewardsGift} alt="" className="w-5 h-5 object-contain" />
            </div>
            <p className="text-neutral-500 text-[10px]">1 → 1 Gift</p>
          </div>
        </div>

        {/* Add Custom Topics */}
        <p className="text-blue-400 text-sm font-black underline mb-3 cursor-pointer">Add Custom Topics</p>

        {/* Premium feature list */}
        <div className="space-y-1 mb-6">
          {[
            "200 Ad Points Per Month",
            "Spin Legendary Items",
            "30 Minute Cap Per User",
            "2nd Try On Rare & Legendary Items",
            "Free Shipping",
            "Target Country On Promos",
            "Target Gender On Promos",
            "Post Clickable Links",
          ].map((feat) => (
            <p key={feat} className="text-blue-400 text-xs font-black underline">{feat}</p>
          ))}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
};

export default VipSettingsOverlay;
