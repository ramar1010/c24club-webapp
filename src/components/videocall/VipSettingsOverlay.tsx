import { X, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import maleIcon from "@/assets/profile/male-shades.png";
import femaleIcon from "@/assets/profile/girl-shades.png";
import chanceEnhancerIcon from "@/assets/vip/chance-enhancer.png";
import getGiftedIcon from "@/assets/vip/get-gifted.png";

interface VipSettingsOverlayProps {
  onClose: () => void;
  userId: string;
  vipTier: "basic" | "premium" | null;
  genderFilter: string;
  onGenderFilterChange: (g: string) => void;
}

const VipSettingsOverlay = ({ onClose, userId, vipTier, genderFilter, onGenderFilterChange }: VipSettingsOverlayProps) => {
  const [showPromoAds, setShowPromoAds] = useState(true);
  const [getGifted, setGetGifted] = useState(false);
  const [pinnedSocials, setPinnedSocials] = useState<string[]>([]);
  const [newSocial, setNewSocial] = useState("");
  const [loading, setLoading] = useState(true);

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
    const updated = [...pinnedSocials, newSocial.trim()].slice(0, 5);
    setPinnedSocials(updated);
    setNewSocial("");
    await saveSettings({ pinned_socials: updated });
    toast.success("Social added");
  };

  const handleRemoveSocial = async (index: number) => {
    const updated = pinnedSocials.filter((_, i) => i !== index);
    setPinnedSocials(updated);
    await saveSettings({ pinned_socials: updated });
  };

  const ToggleButton = ({ active, onToggle, yesLabel = "Yes", noLabel = "No" }: {
    active: boolean; onToggle: (v: boolean) => void; yesLabel?: string; noLabel?: string;
  }) => (
    <div className="flex gap-2">
      <button
        onClick={() => onToggle(true)}
        className={`px-4 py-1.5 rounded-lg text-xs font-black tracking-wide transition-all ${
          active ? "bg-green-600 text-white" : "bg-neutral-800 text-neutral-500"
        }`}
      >
        {yesLabel}
      </button>
      <button
        onClick={() => onToggle(false)}
        className={`px-4 py-1.5 rounded-lg text-xs font-black tracking-wide transition-all ${
          !active ? "bg-red-600 text-white" : "bg-neutral-800 text-neutral-500"
        }`}
      >
        {noLabel}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-neutral-400 animate-pulse">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center px-4 py-5">
        {/* Close */}
        <button onClick={onClose} className="self-start mb-3">
          <X className="w-8 h-8 text-red-500" />
        </button>

        {/* Header */}
        <h1 className="text-white text-2xl font-black tracking-wider mb-0">VIP FEATURES</h1>
        <p className="text-neutral-400 text-sm font-black tracking-wider mb-6">SETTINGS</p>

        <div className="w-full max-w-sm space-y-6">
          {/* Connect With */}
          <div className="bg-neutral-900 border border-neutral-700/60 rounded-2xl p-4">
            <p className="text-neutral-400 text-xs font-black tracking-wider text-center mb-3">Connect With</p>
            <div className="flex justify-center gap-6">
              {["guys", "both", "girls"].map((g) => (
                <button
                  key={g}
                  onClick={() => onGenderFilterChange(g)}
                  className={`flex flex-col items-center gap-1 transition-all ${
                    genderFilter === g ? "opacity-100 scale-110" : "opacity-40"
                  }`}
                >
                  {g === "guys" && <img src={maleIcon} alt="Male" className="w-12 h-12 object-contain" />}
                  {g === "girls" && <img src={femaleIcon} alt="Female" className="w-12 h-12 object-contain" />}
                  {g === "both" && (
                    <div className="flex -space-x-2">
                      <img src={maleIcon} alt="Male" className="w-10 h-10 object-contain" />
                      <img src={femaleIcon} alt="Female" className="w-10 h-10 object-contain" />
                    </div>
                  )}
                  <span className="text-white text-[10px] font-black tracking-wider uppercase">{g === "guys" ? "Male" : g === "girls" ? "Female" : "Both"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Show Promo Ads */}
          <div className="bg-neutral-900 border border-neutral-700/60 rounded-2xl p-4">
            <p className="text-neutral-400 text-xs font-black tracking-wider text-center mb-3">Show Promo Ads.</p>
            <div className="flex justify-center">
              <ToggleButton active={showPromoAds} onToggle={handleTogglePromos} />
            </div>
            {!isPremium && !showPromoAds && (
              <p className="text-yellow-500 text-[10px] text-center mt-2 font-bold">Premium VIP required to disable ads</p>
            )}
          </div>

          {/* Pin Social & Pay Apps On Screen */}
          <div className="bg-neutral-900 border border-neutral-700/60 rounded-2xl p-4">
            <p className="text-neutral-400 text-xs font-black tracking-wider text-center mb-3">Pin Social & Pay Apps On Screen.</p>
            <div className="space-y-2 mb-3">
              {pinnedSocials.map((social, i) => (
                <div key={i} className="flex items-center justify-between bg-neutral-800 rounded-lg px-3 py-2">
                  <span className="text-green-400 text-sm font-bold flex items-center gap-1">
                    @{social} <span className="text-green-500">✓</span>
                  </span>
                  <button onClick={() => handleRemoveSocial(i)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            {pinnedSocials.length < 5 && (
              <div className="flex gap-2">
                <input
                  value={newSocial}
                  onChange={(e) => setNewSocial(e.target.value)}
                  placeholder="@username"
                  className="flex-1 bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && handleAddSocial()}
                />
                <button
                  onClick={handleAddSocial}
                  className="bg-green-600 text-white px-3 rounded-lg hover:bg-green-500 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Chance Enhancer */}
          {isPremium && (
            <div className="bg-neutral-900 border border-neutral-700/60 rounded-2xl p-4 flex items-center gap-3">
              <img src={chanceEnhancerIcon} alt="" className="w-10 h-10 object-contain" />
              <div>
                <p className="text-white text-sm font-black">Chance Enhancer</p>
                <p className="text-yellow-400 text-xs font-black">35%+</p>
                <p className="text-neutral-500 text-[10px]">You get 35%+ of winning rare and legendary items each month!</p>
              </div>
            </div>
          )}

          {/* Get Gifted By Users */}
          {isPremium && (
            <div className="bg-neutral-900 border border-neutral-700/60 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <img src={getGiftedIcon} alt="" className="w-10 h-10 object-contain" />
                <div>
                  <p className="text-white text-sm font-black">Get Gifted By Users.</p>
                  <p className="text-neutral-500 text-[10px]">Reach 3 to Redeem. 1 → 1 Gift</p>
                </div>
              </div>
              <div className="flex justify-center">
                <ToggleButton active={getGifted} onToggle={handleToggleGifted} yesLabel="Enable" noLabel="Disable" />
              </div>
            </div>
          )}

          {/* Premium-only feature list */}
          {isPremium && (
            <div className="bg-neutral-900 border border-neutral-700/60 rounded-2xl p-4 space-y-2">
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
          )}

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
};

export default VipSettingsOverlay;
