import { useState, useEffect } from "react";
import { X, Eye, EyeOff, BarChart3, Trash2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PromoPanelProps {
  userId: string;
  adPoints: number;
  onClose: () => void;
  onAdPointsChange: () => void;
}

type PromoView = "main" | "create" | "my-promos" | "templates" | "analytics";

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
  const [myPromos, setMyPromos] = useState<PromoData[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyticsPromoId, setAnalyticsPromoId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

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
    // Check VIP
    supabase.from("member_minutes").select("is_vip").eq("user_id", userId).maybeSingle()
      .then(({ data }) => setIsVip(data?.is_vip ?? false));
  }, [userId]);

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
      url: isVip ? (url || null) : null,
      url_text: isVip ? urlText : null,
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

    // Deduct ad points
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

  const reachEstimate = Math.max(0, pointsToUse * 5); // rough: 1 point ≈ 5 views

  // ─── MAIN VIEW ───
  if (view === "main") {
    return (
      <div className="bg-orange-500 text-white p-5 rounded-2xl w-full font-['Antigone',sans-serif]">
        <div className="flex items-start justify-between mb-6">
          <h2 className="text-2xl font-black">My Promo Ads</h2>
          <div className="text-right flex items-center gap-2">
            <div>
              <span className="text-3xl font-black text-yellow-300">{adPoints}</span>
              <p className="text-xs font-bold">Ad Points</p>
            </div>
            <button onClick={onClose}><X className="w-6 h-6" /></button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <button onClick={() => { resetForm(); setView("create"); }} className="bg-yellow-400 hover:bg-yellow-300 text-black font-black text-lg px-8 py-3 rounded-full border-2 border-yellow-600 shadow-lg w-64">
            Create New Promo
          </button>
          <button onClick={() => { fetchTemplates(); setView("templates"); }} className="bg-yellow-400 hover:bg-yellow-300 text-black font-black text-lg px-8 py-3 rounded-full border-2 border-yellow-600 shadow-lg w-64">
            Use Saved Templates
          </button>
          <h3 className="text-xl font-black mt-2">Created Promos</h3>
          <button onClick={() => { fetchMyPromos(); setView("my-promos"); }} className="bg-yellow-400 hover:bg-yellow-300 text-black font-black text-lg px-8 py-3 rounded-full border-2 border-yellow-600 shadow-lg w-64">
            Show My Promos
          </button>
          <button className="bg-orange-600 hover:bg-orange-700 text-white font-black text-lg px-8 py-3 rounded-full border-2 border-orange-800 shadow-lg w-64 mt-2">
            Buy Ad Points
          </button>
        </div>
      </div>
    );
  }

  // ─── CREATE VIEW ───
  if (view === "create") {
    return (
      <div className="bg-orange-500 text-white p-5 rounded-2xl w-full font-['Antigone',sans-serif] max-h-[80vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-2xl font-black">My Promo Ads</h2>
          <div className="text-right flex items-center gap-2">
            <div>
              <span className="text-3xl font-black text-yellow-300">{adPoints}</span>
              <p className="text-xs font-bold">Ad Points</p>
            </div>
            <button onClick={() => setView("main")}><X className="w-6 h-6" /></button>
          </div>
        </div>

        <div className="flex justify-center mb-4">
          <button onClick={() => { fetchMyPromos(); setView("my-promos"); }} className="bg-yellow-400 text-black font-black px-6 py-2 rounded-full border-2 border-yellow-600">
            Show My Promos
          </button>
        </div>

        {isVip && <p className="text-center text-sm font-bold mb-2">vip: Yes</p>}

        {/* Image upload (VIP only) */}
        {isVip && (
          <div className="flex justify-center mb-4">
            <label className="bg-yellow-400 rounded-lg w-40 h-32 flex items-center justify-center cursor-pointer border-2 border-yellow-600 overflow-hidden">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-black font-bold text-center">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                  Add Photo
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>
        )}

        <div className="space-y-3">
          <Input
            placeholder="Promo Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-yellow-400 border-yellow-600 text-black placeholder:text-black/60 font-bold rounded-full"
          />
          <Textarea
            placeholder="Promo brief description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-yellow-400 border-yellow-600 text-black placeholder:text-black/60 font-bold rounded-xl min-h-[80px]"
          />

          {/* URL fields (VIP only) */}
          {isVip && (
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs font-bold mb-1">Target Url Link (optional)</p>
                <Input
                  placeholder="Enter url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="bg-yellow-400 border-yellow-600 text-black placeholder:text-black/60 font-bold rounded-full"
                />
              </div>
              <div className="w-32">
                <p className="text-xs font-bold mb-1">Url Link Text (optional)</p>
                <Input
                  value={urlText}
                  onChange={(e) => setUrlText(e.target.value)}
                  className="bg-yellow-400 border-yellow-600 text-black placeholder:text-black/60 font-bold rounded-full"
                />
              </div>
            </div>
          )}

          {/* Ad Points */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="font-bold">Use</span>
            <Input
              type="number"
              min={0}
              max={adPoints}
              value={pointsToUse}
              onChange={(e) => setPointsToUse(Math.min(adPoints, Math.max(0, Number(e.target.value))))}
              className="bg-white text-black font-bold w-20 text-center rounded-md"
            />
            <span className="font-bold">Ad Points</span>
          </div>
          <p className="text-center text-sm font-bold text-yellow-200">To reach ~{reachEstimate} users</p>

          {/* Targeting */}
          <div className="flex gap-4 justify-center">
            <div>
              <p className="text-xs font-bold text-center mb-1">Country</p>
              <select value={country} onChange={(e) => setCountry(e.target.value)}
                className="bg-yellow-400 border-2 border-yellow-600 text-black font-bold rounded-full px-4 py-2">
                <option>All Countries</option>
                <option>US</option><option>UK</option><option>CA</option><option>AU</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-bold text-center mb-1">Interest</p>
              <select value={interest} onChange={(e) => setInterest(e.target.value)}
                className="bg-yellow-400 border-2 border-yellow-600 text-black font-bold rounded-full px-4 py-2">
                <option>All Interests</option>
                <option>Gaming</option><option>Music</option><option>Sports</option><option>Tech</option>
              </select>
            </div>
          </div>

          {/* Gender (VIP only) */}
          {isVip && (
            <div className="text-center mt-2">
              <p className="text-xs font-bold mb-1">Gender</p>
              <div className="flex justify-center gap-2">
                {["Male", "Female", "Both"].map((g) => (
                  <button key={g} onClick={() => setGender(g)}
                    className={`px-4 py-1.5 rounded-full font-bold text-sm ${gender === g ? "bg-black text-white" : "bg-yellow-400 text-black border-2 border-yellow-600"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Same user toggle */}
          <div className="flex justify-center mt-2">
            <button onClick={() => setSameuser(!sameuser)}
              className={`px-4 py-2 rounded-full font-bold text-sm ${sameuser ? "bg-yellow-400 text-black border-2 border-yellow-600" : "bg-orange-600 text-white border-2 border-orange-800"}`}>
              Show promo to same user (more than once)
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={handlePost} className="bg-green-600 hover:bg-green-700 text-white font-black px-6 py-2 rounded-full">
              Post
            </button>
            <button onClick={handleSaveTemplate} className="bg-red-700 hover:bg-red-800 text-white font-black px-6 py-2 rounded-full border-2 border-yellow-400">
              Save as Template
            </button>
            <button onClick={() => setView("main")} className="text-white/80 hover:text-white text-sm font-bold">
              Preview Promo
            </button>
          </div>

          <div className="flex justify-center mt-3">
            <button className="bg-orange-600 hover:bg-orange-700 text-white font-black px-8 py-2 rounded-full border-2 border-orange-800">
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
      <div className="bg-orange-500 text-white p-5 rounded-2xl w-full font-['Antigone',sans-serif]">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setView("main")} className="text-white font-bold">← Back</button>
          <h2 className="text-xl font-black">My Promos</h2>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        {loading ? (
          <p className="text-center">Loading...</p>
        ) : myPromos.length === 0 ? (
          <p className="text-center text-white/70">No promos yet. Create one!</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {myPromos.map((p) => (
              <div key={p.id} className="bg-orange-600 rounded-xl p-3 flex items-center gap-3">
                {p.image_thumb_url ? (
                  <img src={p.image_thumb_url} className="w-12 h-12 rounded object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded bg-orange-700 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-orange-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{p.title}</p>
                  <p className="text-xs text-white/70">⭐ {p.ad_points_balance ?? 0} pts • {p.status}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => togglePromoActive(p)} className="p-1.5 hover:bg-white/10 rounded-full">
                    {p.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-white/50" />}
                  </button>
                  <button onClick={() => fetchAnalytics(p.id)} className="p-1.5 hover:bg-white/10 rounded-full">
                    <BarChart3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deletePromo(p.id)} className="p-1.5 hover:bg-white/10 rounded-full text-red-300">
                    <Trash2 className="w-4 h-4" />
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
      <div className="bg-orange-500 text-white p-5 rounded-2xl w-full font-['Antigone',sans-serif]">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setView("main")} className="text-white font-bold">← Back</button>
          <h2 className="text-xl font-black">Saved Templates</h2>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        {loading ? (
          <p className="text-center">Loading...</p>
        ) : templates.length === 0 ? (
          <p className="text-center text-white/70">No templates saved yet.</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {templates.map((t: any) => (
              <button key={t.id} onClick={() => loadTemplate(t)}
                className="w-full bg-yellow-400 text-black rounded-xl p-3 text-left hover:bg-yellow-300">
                <p className="font-bold">{t.title || "Untitled"}</p>
                <p className="text-xs text-black/60">⭐ {t.ad_points_balance ?? 0} pts • {t.gender}</p>
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
      <div className="bg-orange-500 text-white p-5 rounded-2xl w-full font-['Antigone',sans-serif]">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { setView("my-promos"); fetchMyPromos(); }} className="text-white font-bold">← Back</button>
          <h2 className="text-xl font-black">Promo Analytics</h2>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <div className="space-y-4">
          <div className="bg-orange-600 rounded-xl p-4 text-center">
            <p className="text-3xl font-black">{analytics.totalViews}</p>
            <p className="text-sm font-bold text-white/80">People Viewed Your Promo</p>
          </div>
          <div className="bg-orange-600 rounded-xl p-4 text-center">
            <p className="text-3xl font-black">{analytics.avgWatchTime}s</p>
            <p className="text-sm font-bold text-white/80">Average Watch Time</p>
          </div>
          <div className="bg-orange-600 rounded-xl p-4 text-center">
            <p className="text-3xl font-black">{analytics.pauseRate}%</p>
            <p className="text-sm font-bold text-white/80">Average Pause Rate</p>
          </div>
          <div className="bg-orange-600 rounded-xl p-4 text-center">
            <p className="text-3xl font-black">{analytics.linkClicks}</p>
            <p className="text-sm font-bold text-white/80">Link Clicks</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PromoPanel;
