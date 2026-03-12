import { useState, useEffect, useCallback } from "react";
import { X, Eye, EyeOff, BarChart3, Trash2, Image as ImageIcon, Link2, Gift, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import LinkClicksRewardPicker from "./LinkClicksRewardPicker";

interface PromoPanelProps {
  userId: string;
  adPoints: number;
  onClose: () => void;
  onAdPointsChange: () => void;
}

type PromoView = "main" | "create" | "my-promos" | "templates" | "analytics" | "link-clicks" | "pick-reward";

interface PromoData {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  url_text: string | null;
  image_thumb_url: string | null;
  gender: string | null;
  country: string | null;
  interest: string | null;
  sameuser: boolean | null;
  ad_points_balance: number | null;
  status: string | null;
  is_active: boolean | null;
  promo_type: string | null;
}

interface AnalyticsData {
  totalViews: number;
  avgWatchTime: number;
  pauseRate: number;
  linkClicks: number;
}

const PromoPanel = ({ userId, adPoints, onClose, onAdPointsChange }: PromoPanelProps) => {
  const [view, setView] = useState<PromoView>("main");
  const [isVip, setIsVip] = useState(false);
  const [isPremiumVip, setIsPremiumVip] = useState(false);
  const [myPromos, setMyPromos] = useState<PromoData[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyticsPromoId, setAnalyticsPromoId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [totalLinkClicks, setTotalLinkClicks] = useState(0);
  const [linkClicksClaimed, setLinkClicksClaimed] = useState(0);
  const [claimingReward, setClaimingReward] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [urlText, setUrlText] = useState("Join Now");
  const [pointsToUse, setPointsToUse] = useState(0);
  const [country, setCountry] = useState("All Countries");
  const [interest, setInterest] = useState("All Interests");
  const [gender, setGender] = useState("Both");
  const [sameuser, setSameuser] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("member_minutes").select("is_vip, vip_tier").eq("user_id", userId).maybeSingle()
      .then(({ data }) => {
        setIsVip(data?.is_vip ?? false);
        setIsPremiumVip(data?.is_vip === true && data?.vip_tier === "premium");
      });
  }, [userId]);

  // Fetch link clicks on mount for Premium VIP banner
  useEffect(() => {
    if (isPremiumVip) fetchTotalLinkClicks();
  }, [isPremiumVip]);

  const fetchMyPromos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("promos")
      .select("*")
      .eq("member_id", userId)
      .order("created_at", { ascending: false });
    setMyPromos((data as any[]) ?? []);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("promo_templates")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setTemplates(data ?? []);
    setLoading(false);
  };

  const fetchAnalytics = async (promoId: string) => {
    const { data } = await supabase
      .from("promo_analytics")
      .select("watch_time_seconds, paused, link_clicked")
      .eq("promo_id", promoId);

    if (!data || data.length === 0) {
      setAnalytics({ totalViews: 0, avgWatchTime: 0, pauseRate: 0, linkClicks: 0 });
    } else {
      const totalViews = data.length;
      const avgWatchTime = Math.round(data.reduce((s, r) => s + r.watch_time_seconds, 0) / totalViews);
      const pauseRate = Math.round((data.filter(r => r.paused).length / totalViews) * 100);
      const linkClicks = data.filter(r => r.link_clicked).length;
      setAnalytics({ totalViews, avgWatchTime, pauseRate, linkClicks });
    }
    setAnalyticsPromoId(promoId);
    setView("analytics");
  };

  const LINK_CLICKS_THRESHOLD = 200;

  const fetchTotalLinkClicks = useCallback(async () => {
    // Get all user's promo IDs
    const { data: userPromos } = await supabase
      .from("promos")
      .select("id")
      .eq("member_id", userId);

    if (!userPromos || userPromos.length === 0) {
      setTotalLinkClicks(0);
      return;
    }

    const promoIds = userPromos.map((p) => p.id);
    const { data: clickData } = await supabase
      .from("promo_analytics")
      .select("id")
      .in("promo_id", promoIds)
      .eq("link_clicked", true);

    setTotalLinkClicks(clickData?.length ?? 0);

    // Check how many rewards already claimed from link clicks
    const { data: claimedData } = await supabase
      .from("member_redemptions")
      .select("id")
      .eq("user_id", userId)
      .eq("reward_type", "promo_link_clicks");

    setLinkClicksClaimed(claimedData?.length ?? 0);
  }, [userId]);

  const availableRewards = Math.floor(totalLinkClicks / LINK_CLICKS_THRESHOLD) - linkClicksClaimed;

  const handleClaimLinkClickReward = async () => {
    if (availableRewards <= 0) {
      toast.error("Not enough link clicks to claim a reward");
      return;
    }
    setClaimingReward(true);
    // Insert a redemption record for the promo link click reward
    const { error } = await supabase.from("member_redemptions").insert({
      user_id: userId,
      reward_title: "Promo Link Clicks Reward",
      reward_type: "promo_link_clicks",
      reward_rarity: "common",
      minutes_cost: 0,
      status: "pending_selection",
      notes: `Earned from ${LINK_CLICKS_THRESHOLD} promo link clicks`,
    });

    if (error) {
      toast.error("Failed to claim reward");
    } else {
      toast.success("🎉 Reward unlocked! An admin will reach out with your reward selection.");
      setLinkClicksClaimed((prev) => prev + 1);
    }
    setClaimingReward(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setUrl(""); setUrlText("Join Now");
    setPointsToUse(0); setCountry("All Countries"); setInterest("All Interests");
    setGender("Both"); setSameuser(false); setImageFile(null); setImagePreview(null);
  };

  const handlePost = async () => {
    if (pointsToUse > adPoints) {
      toast.error("Not enough Ad Points");
      return;
    }

    let imageUrl: string | null = null;
    if (imageFile && isVip) {
      const ext = imageFile.name.split(".").pop();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("promo-images").upload(path, imageFile);
      if (error) { toast.error("Image upload failed"); return; }
      const { data: urlData } = supabase.storage.from("promo-images").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from("promos").insert({
      title: title || "Untitled Promo",
      description: description || null,
      url: isPremiumVip ? (url || null) : null,
      url_text: isPremiumVip ? urlText : null,
      image_thumb_url: imageUrl,
      member_id: userId,
      gender: isVip ? gender : "Both",
      country,
      interest,
      sameuser,
      ad_points_balance: pointsToUse,
      status: "Active",
      is_active: true,
      promo_type: "user",
    } as any);

    if (error) { toast.error("Failed to create promo"); return; }

    if (pointsToUse > 0) {
      await supabase.functions.invoke("earn-minutes", {
        body: { type: "spend_ad_points", userId, points: pointsToUse },
      });
      onAdPointsChange();
    }

    toast.success("Promo created!");
    resetForm();
    setView("main");
  };

  const handleSaveTemplate = async () => {
    await supabase.from("promo_templates").insert({
      user_id: userId,
      title: title || null,
      description: description || null,
      url: url || null,
      url_text: urlText,
      country,
      interest,
      gender,
      sameuser,
      ad_points_balance: pointsToUse,
    } as any);
    toast.success("Template saved!");
  };

  const loadTemplate = (t: any) => {
    setTitle(t.title || ""); setDescription(t.description || "");
    setUrl(t.url || ""); setUrlText(t.url_text || "Join Now");
    setPointsToUse(t.ad_points_balance || 0); setCountry(t.country || "All Countries");
    setInterest(t.interest || "All Interests"); setGender(t.gender || "Both");
    setSameuser(t.sameuser || false);
    setView("create");
  };

  const togglePromoActive = async (promo: PromoData) => {
    await supabase.from("promos").update({ is_active: !promo.is_active } as any).eq("id", promo.id);
    fetchMyPromos();
  };

  const deletePromo = async (id: string) => {
    await supabase.from("promos").delete().eq("id", id);
    toast.success("Promo deleted");
    fetchMyPromos();
  };

  const reachEstimate = Math.max(0, pointsToUse * 5);

  // Shared header
  const Header = ({ title: headerTitle, backTo }: { title: string; backTo?: PromoView }) => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {backTo && (
          <button onClick={() => { setView(backTo); if (backTo === "my-promos") fetchMyPromos(); }} className="text-neutral-400 hover:text-white font-bold text-sm">
            ← Back
          </button>
        )}
        <h2 className="text-2xl font-black tracking-wide">{headerTitle}</h2>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <span className="text-2xl font-black text-yellow-400">{adPoints}</span>
          <p className="text-[10px] font-bold text-neutral-400">Ad Points</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );

  // ─── MAIN VIEW ───
  if (view === "main") {
    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] p-5 overflow-y-auto">
        <Header title="My Promo Ads" />

        {/* Link Clicks Summary Banner */}
        {isPremiumVip && (
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 mb-6 text-center">
            <p className="text-sm font-black text-neutral-300 mb-1">YOU HAVE TOTAL</p>
            <p className="text-4xl font-black text-green-500">{totalLinkClicks} <span className="text-lg text-neutral-300">LINK CLICKS</span></p>
            <p className="text-sm mt-2">
              <span className="text-red-500 font-black">{LINK_CLICKS_THRESHOLD} Link Clicks Required</span>
              <span className="font-black text-white"> from your Promos for a reward of your choice!</span>
            </p>
            <button
              onClick={() => { fetchTotalLinkClicks(); setView("link-clicks"); }}
              className="mt-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white font-black px-6 py-2 rounded-full text-sm transition-colors inline-flex items-center gap-2"
            >
              <Link2 className="w-4 h-4" />
              View Link Clicks Details
            </button>
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <button onClick={() => { resetForm(); setView("create"); }}
            className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white font-black text-lg px-8 py-3 rounded-lg w-72 transition-colors">
            Create New Promo
          </button>
          <button onClick={() => { fetchTemplates(); setView("templates"); }}
            className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white font-black text-lg px-8 py-3 rounded-lg w-72 transition-colors">
            Use Saved Templates
          </button>
          <h3 className="text-xl font-black mt-4 text-neutral-300">Created Promos</h3>
          <button onClick={() => { fetchMyPromos(); setView("my-promos"); }}
            className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white font-black text-lg px-8 py-3 rounded-lg w-72 transition-colors">
            Show My Promos
          </button>
          <button className="bg-yellow-400 hover:bg-yellow-300 text-black font-black text-lg px-8 py-3 rounded-lg w-72 mt-4 transition-colors">
            Buy Ad Points
          </button>
        </div>
      </div>
    );
  }

  // ─── CREATE VIEW ───
  if (view === "create") {
    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] p-5 overflow-y-auto">
        <Header title="Create Promo" backTo="main" />

        <div className="flex justify-center mb-5">
          <button onClick={() => { fetchMyPromos(); setView("my-promos"); }}
            className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors">
            Show My Promos
          </button>
        </div>

        {isVip && <p className="text-center text-sm font-bold text-yellow-400 mb-3">⭐ VIP Member</p>}

        {/* Image upload (VIP only) */}
        {isVip && (
          <div className="flex justify-center mb-5">
            <label className="bg-neutral-800 border border-neutral-600 rounded-xl w-44 h-32 flex items-center justify-center cursor-pointer overflow-hidden hover:border-neutral-500 transition-colors">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-neutral-400 text-center">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                  <span className="text-sm font-bold">Add Photo</span>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>
        )}

        <div className="space-y-4 max-w-md mx-auto">
          <Input
            placeholder="Promo Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500 font-bold"
          />
          <Textarea
            placeholder="Promo brief description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500 font-bold min-h-[80px]"
          />

          {/* URL Link - Premium VIP only */}
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-xs font-bold text-neutral-400 mb-1">Target URL Link {!isPremiumVip && "🔒 Premium VIP"}</p>
              <Input
                placeholder="Enter url"
                value={url}
                disabled={!isPremiumVip}
                onChange={(e) => setUrl(e.target.value)}
                className={`bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500 font-bold ${!isPremiumVip ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => {
                  if (!isPremiumVip) toast("👑 Premium VIP Feature", { description: "Upgrade to Premium VIP to add clickable links to your promos!" });
                }}
              />
            </div>
            <div className="w-32">
              <p className="text-xs font-bold text-neutral-400 mb-1">CTA Text</p>
              <Input
                value={urlText}
                disabled={!isPremiumVip}
                onChange={(e) => setUrlText(e.target.value)}
                className={`bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500 font-bold ${!isPremiumVip ? "opacity-50 cursor-not-allowed" : ""}`}
              />
            </div>
          </div>

          {/* Ad Points */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <span className="font-bold text-neutral-300">Use</span>
            <Input
              type="number"
              min={0}
              max={adPoints}
              value={pointsToUse}
              onChange={(e) => setPointsToUse(Math.min(adPoints, Math.max(0, Number(e.target.value))))}
              className="bg-neutral-800 border-neutral-600 text-white font-bold w-20 text-center"
            />
            <span className="font-bold text-neutral-300">Ad Points</span>
          </div>
          <p className="text-center text-sm font-bold text-yellow-400">To reach ~{reachEstimate} users</p>

          {/* Targeting */}
          <div className="flex gap-6 justify-center">
            <div>
              <p className="text-xs font-bold text-neutral-400 text-center mb-1">Country</p>
              <select value={country} onChange={(e) => setCountry(e.target.value)}
                className="bg-neutral-800 border border-neutral-600 text-white font-bold rounded-lg px-4 py-2 text-sm">
                <option>All Countries</option>
                <option>US</option><option>UK</option><option>CA</option><option>AU</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-400 text-center mb-1">Interest</p>
              <select value={interest} onChange={(e) => setInterest(e.target.value)}
                className="bg-neutral-800 border border-neutral-600 text-white font-bold rounded-lg px-4 py-2 text-sm">
                <option>All Interests</option>
                <option>Gaming</option><option>Music</option><option>Sports</option><option>Tech</option>
              </select>
            </div>
          </div>

          {/* Gender Targeting */}
          <div className="text-center pt-2">
            <p className="text-xs font-bold text-neutral-400 mb-2">Gender Targeting {!isVip && "🔒"}</p>
            <div className="flex justify-center gap-2">
              {["Male", "Female", "Both"].map((g) => (
                <button key={g} onClick={() => {
                  if (!isVip) {
                    toast("🚀 VIP Feature", { description: "Upgrade to VIP to target promos by gender!" });
                    return;
                  }
                  setGender(g);
                }}
                  className={`px-5 py-1.5 rounded-lg font-bold text-sm transition-colors ${
                    gender === g
                      ? "bg-white text-black"
                      : "bg-neutral-800 border border-neutral-600 text-neutral-300 hover:bg-neutral-700"
                  } ${!isVip && g !== "Both" ? "opacity-50" : ""}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Same user visibility */}
          <div className="text-center pt-1">
            <select value={sameuser ? "multiple" : "once"}
              onChange={(e) => setSameuser(e.target.value === "multiple")}
              className="bg-neutral-800 border border-neutral-600 text-white font-bold rounded-lg px-4 py-2.5 text-sm w-72">
              <option value="multiple">Show promo to same user (more than once)</option>
              <option value="once">Show promo only once to a user</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <button onClick={handlePost} className="bg-green-600 hover:bg-green-700 text-white font-black px-8 py-2.5 rounded-lg transition-colors">
              Post
            </button>
            <button onClick={handleSaveTemplate} className="bg-neutral-700 hover:bg-neutral-600 border border-neutral-500 text-white font-black px-6 py-2.5 rounded-lg transition-colors">
              Save as Template
            </button>
          </div>

          <div className="flex justify-center pt-3 pb-8">
            <button className="bg-yellow-400 hover:bg-yellow-300 text-black font-black px-8 py-2.5 rounded-lg transition-colors">
              Buy Ad Points
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── MY PROMOS VIEW ───
  if (view === "my-promos") {
    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] p-5 overflow-y-auto">
        <Header title="My Promos" backTo="main" />
        {loading ? (
          <p className="text-center text-neutral-400">Loading...</p>
        ) : myPromos.length === 0 ? (
          <p className="text-center text-neutral-500 mt-8">No promos yet. Create one!</p>
        ) : (
          <div className="space-y-3 max-w-md mx-auto">
            {myPromos.map((p) => (
              <div key={p.id} className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 flex items-center gap-3">
                {p.image_thumb_url ? (
                  <img src={p.image_thumb_url} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-neutral-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{p.title}</p>
                  <p className="text-xs text-neutral-400">⭐ {p.ad_points_balance ?? 0} pts • {p.status}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => togglePromoActive(p)} className="p-1.5 hover:bg-neutral-800 rounded-full transition-colors">
                    {p.is_active ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4 text-neutral-600" />}
                  </button>
                  <button onClick={() => fetchAnalytics(p.id)} className="p-1.5 hover:bg-neutral-800 rounded-full transition-colors">
                    <BarChart3 className="w-4 h-4 text-neutral-400" />
                  </button>
                  <button onClick={() => deletePromo(p.id)} className="p-1.5 hover:bg-neutral-800 rounded-full transition-colors">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── TEMPLATES VIEW ───
  if (view === "templates") {
    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] p-5 overflow-y-auto">
        <Header title="Saved Templates" backTo="main" />
        {loading ? (
          <p className="text-center text-neutral-400">Loading...</p>
        ) : templates.length === 0 ? (
          <p className="text-center text-neutral-500 mt-8">No templates saved yet.</p>
        ) : (
          <div className="space-y-3 max-w-md mx-auto">
            {templates.map((t: any) => (
              <button key={t.id} onClick={() => loadTemplate(t)}
                className="w-full bg-neutral-900 border border-neutral-700 hover:border-neutral-500 rounded-xl p-4 text-left transition-colors">
                <p className="font-bold">{t.title || "Untitled"}</p>
                <p className="text-xs text-neutral-400 mt-1">⭐ {t.ad_points_balance ?? 0} pts • {t.gender}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── ANALYTICS VIEW ───
  if (view === "analytics" && analytics) {
    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] p-5 overflow-y-auto">
        <Header title="Promo Analytics" backTo="my-promos" />
        <div className="space-y-4 max-w-md mx-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 text-center">
            <p className="text-4xl font-black">{analytics.totalViews}</p>
            <p className="text-sm font-bold text-neutral-400 mt-1">People Viewed Your Promo</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 text-center">
            <p className="text-4xl font-black">{analytics.avgWatchTime}s</p>
            <p className="text-sm font-bold text-neutral-400 mt-1">Average Watch Time</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 text-center">
            <p className="text-4xl font-black">{analytics.pauseRate}%</p>
            <p className="text-sm font-bold text-neutral-400 mt-1">Average Pause Rate</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 text-center">
            <p className="text-4xl font-black">{analytics.linkClicks}</p>
            <p className="text-sm font-bold text-neutral-400 mt-1">Link Clicks</p>
          </div>
        </div>
      </div>
    );
  }


  // ─── LINK CLICKS VIEW ───
  if (view === "link-clicks") {
    const clicksTowardNext = totalLinkClicks - (linkClicksClaimed * LINK_CLICKS_THRESHOLD);
    const progressPercent = Math.min(100, (clicksTowardNext / LINK_CLICKS_THRESHOLD) * 100);

    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] p-5 overflow-y-auto">
        <Header title="Link Clicks" backTo="main" />

        <div className="max-w-md mx-auto space-y-6">
          {/* Total link clicks */}
          <div className="text-center">
            <p className="text-sm font-black text-neutral-400 mb-1">YOUR TOTAL LINK CLICKS</p>
            <p className="text-6xl font-black text-green-500">{totalLinkClicks}</p>
          </div>

          {/* Requirement info */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 text-center">
            <p className="text-sm">
              <span className="text-red-500 font-black">{LINK_CLICKS_THRESHOLD} Link Clicks Required</span>
              <span className="font-black text-white"> from your Promos for a reward of your choice!</span>
            </p>
          </div>

          {/* Progress toward next reward */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-neutral-400">Progress to next reward</span>
              <span className="text-sm font-black text-green-400">{clicksTowardNext}/{LINK_CLICKS_THRESHOLD}</span>
            </div>
            <div className="h-3 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Rewards claimed */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 text-center">
            <p className="text-sm font-bold text-neutral-400 mb-1">REWARDS CLAIMED</p>
            <p className="text-3xl font-black text-yellow-400">{linkClicksClaimed}</p>
          </div>

          {/* Create Promo CTA */}
          <button onClick={() => { resetForm(); setView("create"); }}
            className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white font-black text-lg px-8 py-3 rounded-full w-full transition-colors flex items-center justify-center gap-2">
            CREATE PROMO
          </button>

          {/* Unlock Reward Button */}
          <button
            onClick={handleClaimLinkClickReward}
            disabled={availableRewards <= 0 || claimingReward}
            className={`w-full font-black text-lg px-8 py-4 rounded-full transition-colors flex flex-col items-center gap-1 ${
              availableRewards > 0
                ? "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white"
                : "bg-neutral-800 border border-neutral-700 text-neutral-500 cursor-not-allowed"
            }`}
          >
            <span className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              {availableRewards > 0 ? "CLAIM FREE REWARD" : `REACH ${LINK_CLICKS_THRESHOLD} LINK CLICKS`}
            </span>
            <span className="text-xs font-bold opacity-75">
              {availableRewards > 0
                ? `You have ${availableRewards} reward${availableRewards > 1 ? "s" : ""} to claim!`
                : "UNLOCK FREE PRODUCT"
              }
            </span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default PromoPanel;
