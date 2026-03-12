import { X, Plus, Trash2, Pencil, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import maleIcon from "@/assets/profile/male-emoji.png";
import femaleIcon from "@/assets/profile/female-emoji.svg";
import greenCheck from "@/assets/profile/green-check.png";
import chanceEnhancerIcon from "@/assets/vip/chance-enhancer.png";
import getGiftedIcon from "@/assets/vip/get-gifted.png";
import pinSocialsIcon from "@/assets/vip/pin-socials.png";
import cashappIcon from "@/assets/socials/cashapp.png";
import tiktokIcon from "@/assets/socials/tiktok.png";
import instagramIcon from "@/assets/socials/instagram.png";
import snapchatIcon from "@/assets/socials/snapchat.png";
import venmoIcon from "@/assets/socials/venmo.png";
import paypalIcon from "@/assets/socials/paypal.png";

const SOCIAL_PLATFORMS = [
  { key: "cashapp", label: "$cashtag", icon: cashappIcon, prefix: "$", placeholder: "$cashtag" },
  { key: "tiktok", label: "TikTok", icon: tiktokIcon, prefix: "@", placeholder: "@username" },
  { key: "instagram", label: "Instagram", icon: instagramIcon, prefix: "@", placeholder: "@username" },
  { key: "snapchat", label: "Snapchat", icon: snapchatIcon, prefix: "/", placeholder: "/username" },
  { key: "venmo", label: "Venmo", icon: venmoIcon, prefix: "/", placeholder: "/username" },
  { key: "paypal", label: "PayPal", icon: paypalIcon, prefix: "@", placeholder: "@username" },
] as const;

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
  const [socialEditing, setSocialEditing] = useState<string | null>(null);
  const [socialDraft, setSocialDraft] = useState("");
  const [loading, setLoading] = useState(true);

  const isPremium = vipTier === "premium";

  // Parse pinned_socials array: stored as "platform:username" strings
  const getSocialValue = (platformKey: string) => {
    const entry = pinnedSocials.find((s) => s.startsWith(platformKey + ":"));
    return entry ? entry.split(":").slice(1).join(":") : "";
  };

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

  const handleSaveSocial = async (platformKey: string) => {
    const value = socialDraft.trim();
    let updated: string[];
    if (value) {
      const entry = `${platformKey}:${value}`;
      updated = pinnedSocials.filter((s) => !s.startsWith(platformKey + ":"));
      updated.push(entry);
    } else {
      updated = pinnedSocials.filter((s) => !s.startsWith(platformKey + ":"));
    }
    setPinnedSocials(updated);
    setSocialEditing(null);
    setSocialDraft("");
    await saveSettings({ pinned_socials: updated });
    toast.success(value ? "Social saved" : "Social removed");
  };

  const handleRemoveSocial = async (platformKey: string) => {
    const updated = pinnedSocials.filter((s) => !s.startsWith(platformKey + ":"));
    setPinnedSocials(updated);
    await saveSettings({ pinned_socials: updated });
    toast.success("Social removed");
  };

  const startEditing = (platformKey: string) => {
    setSocialEditing(platformKey);
    setSocialDraft(getSocialValue(platformKey));
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
            <div className="flex items-center justify-center gap-2 mb-1">
              <p className="text-neutral-400 text-xs font-black tracking-wider text-center">Pin Social & Pay Apps On Screen.</p>
              <img src={pinSocialsIcon} alt="" className="w-5 h-5 object-contain" />
            </div>
            <div className="flex items-center justify-center gap-1.5 mb-4">
              <span className="text-[10px] text-neutral-500">📌</span>
              <Pencil className="w-3 h-3 text-yellow-500" />
            </div>

            <div className="space-y-2">
              {SOCIAL_PLATFORMS.map((platform) => {
                const value = getSocialValue(platform.key);
                const isEditing = socialEditing === platform.key;

                return (
                  <div key={platform.key} className="flex items-center gap-2.5">
                    <img src={platform.icon} alt={platform.label} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          value={socialDraft}
                          onChange={(e) => setSocialDraft(e.target.value)}
                          placeholder={platform.placeholder}
                          autoFocus
                          className="flex-1 bg-neutral-800 border border-neutral-600 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-green-500"
                          onKeyDown={(e) => e.key === "Enter" && handleSaveSocial(platform.key)}
                        />
                        <button
                          onClick={() => handleSaveSocial(platform.key)}
                          className="bg-green-600 p-1.5 rounded-lg hover:bg-green-500 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    ) : value ? (
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-green-400 text-sm font-bold">{value}</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => startEditing(platform.key)} className="text-neutral-500 hover:text-white transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRemoveSocial(platform.key)} className="text-red-400 hover:text-red-300 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(platform.key)}
                        className="flex-1 text-left text-neutral-600 text-sm italic hover:text-neutral-400 transition-colors"
                      >
                        {platform.placeholder}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
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
