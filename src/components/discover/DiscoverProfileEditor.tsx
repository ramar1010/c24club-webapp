import { useState, useEffect } from "react";
import { Pencil, Check, X, ChevronDown, ChevronUp, Camera, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import cashappIcon from "@/assets/socials/cashapp.png";
import tiktokIcon from "@/assets/socials/tiktok.png";
import instagramIcon from "@/assets/socials/instagram.png";
import snapchatIcon from "@/assets/socials/snapchat.png";
import venmoIcon from "@/assets/socials/venmo.png";
import paypalIcon from "@/assets/socials/paypal.png";

const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", icon: instagramIcon, placeholder: "@username" },
  { key: "tiktok", label: "TikTok", icon: tiktokIcon, placeholder: "@username" },
  { key: "snapchat", label: "Snapchat", icon: snapchatIcon, placeholder: "/username" },
  { key: "cashapp", label: "CashApp", icon: cashappIcon, placeholder: "$cashtag" },
  { key: "venmo", label: "Venmo", icon: venmoIcon, placeholder: "/username" },
  { key: "paypal", label: "PayPal", icon: paypalIcon, placeholder: "@username" },
];

interface DiscoverProfileEditorProps {
  userId: string;
}

const DiscoverProfileEditor = ({ userId }: DiscoverProfileEditorProps) => {
  const [expanded, setExpanded] = useState(false);
  const [bio, setBio] = useState("");
  const [socialInputs, setSocialInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<string>("pending");
  const [showRetakeSelfie, setShowRetakeSelfie] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: member }, { data: settings }] = await Promise.all([
        supabase.from("members").select("bio, image_url, image_status").eq("id", userId).single(),
        supabase.from("vip_settings").select("pinned_socials").eq("user_id", userId).maybeSingle(),
      ]);

      setBio((member as any)?.bio || "");
      setImageUrl((member as any)?.image_url || null);
      setImageStatus((member as any)?.image_status || "pending");

      if (settings?.pinned_socials) {
        const parsed: Record<string, string> = {};
        (settings.pinned_socials as string[]).forEach(s => {
          const [k, ...v] = s.split(":");
          parsed[k] = v.join(":");
        });
        setSocialInputs(parsed);
      }
      setLoaded(true);
    };
    load();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);

    // Save bio
    await supabase.from("members").update({ bio: bio.trim() || null } as any).eq("id", userId);

    // Save socials
    const socialsArray = Object.entries(socialInputs)
      .filter(([, val]) => val.trim())
      .map(([key, val]) => `${key}:${val.trim()}`);

    const { data: existing } = await supabase
      .from("vip_settings")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("vip_settings").update({ pinned_socials: socialsArray, updated_at: new Date().toISOString() }).eq("user_id", userId);
    } else {
      await supabase.from("vip_settings").insert({ user_id: userId, pinned_socials: socialsArray });
    }

    setSaving(false);
    toast({ title: "Profile updated! ✨" });
  };

  if (!loaded) return null;

  const filledCount = Object.values(socialInputs).filter(v => v.trim()).length;

  return (
    <div className="mx-4 mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Pencil className="w-4 h-4 text-pink-400" />
          <span className="text-white text-sm font-medium">Edit My Profile</span>
          {(bio || filledCount > 0) && (
            <span className="text-white/40 text-xs">
              {bio ? "Bio" : ""}{bio && filledCount > 0 ? " · " : ""}{filledCount > 0 ? `${filledCount} social${filledCount > 1 ? "s" : ""}` : ""}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>

      {expanded && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
          {/* Bio */}
          <div>
            <label className="text-white/60 text-xs font-bold mb-1 block">Short Bio</label>
            <input
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 120))}
              placeholder="Tell people about yourself..."
              maxLength={120}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500/50"
            />
            <span className="text-white/30 text-[10px]">{bio.length}/120</span>
          </div>

          {/* Socials */}
          <div>
            <label className="text-white/60 text-xs font-bold mb-1.5 block">My Socials</label>
            <div className="space-y-1.5">
              {SOCIAL_PLATFORMS.map((platform) => (
                <div key={platform.key} className="flex items-center gap-2">
                  <img src={platform.icon} alt={platform.label} className="w-6 h-6 rounded object-contain" />
                  <input
                    value={socialInputs[platform.key] || ""}
                    onChange={(e) => setSocialInputs(prev => ({ ...prev, [platform.key]: e.target.value }))}
                    placeholder={platform.placeholder}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500/50"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      )}
    </div>
  );
};

export default DiscoverProfileEditor;
