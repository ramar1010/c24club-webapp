import { useState, useEffect, useRef, useCallback } from "react";
import { ExternalLink, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PromoAd {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  url_text: string | null;
  image_thumb_url: string | null;
  sameuser: boolean | null;
  gender: string | null;
  country: string | null;
}

interface PromoAdOverlayProps {
  viewerId: string;
  onDismiss: () => void;
}

const PromoAdOverlay = ({ viewerId, onDismiss }: PromoAdOverlayProps) => {
  const [promo, setPromo] = useState<PromoAd | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [paused, setPaused] = useState(false);
  const [linkClicked, setLinkClicked] = useState(false);
  const startTimeRef = useRef(Date.now());
  const pausedRef = useRef(false);
  const promoIdRef = useRef<string | null>(null);

  // Fetch a random active promo, respecting sameuser/gender/country targeting
  useEffect(() => {
    const fetchPromo = async () => {
      // Fetch viewer's profile for gender/country matching
      const { data: viewerProfile } = await supabase
        .from("members")
        .select("gender, country")
        .eq("id", viewerId)
        .maybeSingle();

      const viewerGender = viewerProfile?.gender ?? null;
      const viewerCountry = viewerProfile?.country ?? null;

      const { data: promos } = await supabase
        .from("promos")
        .select("id, title, description, url, url_text, image_thumb_url, sameuser, gender, country")
        .eq("is_active", true)
        .eq("status", "Active")
        .neq("member_id", viewerId)
        .limit(50);

      if (!promos || promos.length === 0) {
        onDismiss();
        return;
      }

      const { data: seenData } = await supabase
        .from("promo_analytics")
        .select("promo_id")
        .eq("viewer_id", viewerId);

      const seenPromoIds = new Set((seenData ?? []).map((r) => r.promo_id));

      const normalizeValue = (value: string | null) => value?.trim().toLowerCase() ?? null;

      const eligible = promos.filter((p) => {
        const promoGender = normalizeValue(p.gender);
        const promoCountry = normalizeValue(p.country);
        const normalizedViewerGender = normalizeValue(viewerGender);
        const normalizedViewerCountry = normalizeValue(viewerCountry);

        const genderIsWildcard = !promoGender || promoGender === "both" || promoGender === "all";
        const countryIsWildcard =
          !promoCountry ||
          promoCountry === "all countries" ||
          promoCountry === "all" ||
          promoCountry === "worldwide";

        // sameuser filter: if false, don't show to same viewer twice
        if (!p.sameuser && seenPromoIds.has(p.id)) return false;

        // Gender targeting: only filter if promo explicitly targets one gender
        if (!genderIsWildcard && normalizedViewerGender && promoGender !== normalizedViewerGender) return false;

        // Country targeting: only filter if promo explicitly targets one country
        if (!countryIsWildcard && normalizedViewerCountry && promoCountry !== normalizedViewerCountry) return false;

        return true;
      });

      if (eligible.length === 0) {
        onDismiss();
        return;
      }

      const randomPromo = eligible[Math.floor(Math.random() * eligible.length)];
      setPromo(randomPromo as PromoAd);
      promoIdRef.current = randomPromo.id;
    };
    fetchPromo();
  }, [viewerId, onDismiss]);

  // Countdown timer
  useEffect(() => {
    if (!promo) return;
    const interval = setInterval(() => {
      if (!pausedRef.current) {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [promo]);

  // Auto-dismiss when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && promo) {
      reportAndDismiss();
    }
  }, [countdown, promo]);

  const reportAndDismiss = useCallback(async () => {
    if (!promoIdRef.current) { onDismiss(); return; }
    const watchTime = Math.round((Date.now() - startTimeRef.current) / 1000);
    supabase.from("promo_analytics").insert({
      promo_id: promoIdRef.current,
      viewer_id: viewerId,
      watch_time_seconds: watchTime,
      paused: pausedRef.current,
      link_clicked: linkClicked,
    } as any).then(() => {});
    onDismiss();
  }, [viewerId, linkClicked, onDismiss]);

  const handleSkip = () => {
    reportAndDismiss();
  };

  const togglePause = () => {
    setPaused((p) => { pausedRef.current = !p; return !p; });
  };

  const handleLinkClick = (url: string) => {
    setLinkClicked(true);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!promo) return null;

  return (
    <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      {/* Top bar: countdown + skip */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-40">
        <span className="bg-white/10 rounded-full px-3 py-1 text-xs font-bold text-white">
          {countdown > 0 ? `${countdown}s` : "Done"}
        </span>
        <button
          onClick={handleSkip}
          className="bg-white/10 hover:bg-white/20 rounded-full px-3 py-1 text-xs font-bold text-white transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Promo content */}
      <div className="flex flex-col items-center text-center max-w-[90%]">
        {promo.image_thumb_url && (
          <img
            src={promo.image_thumb_url}
            alt={promo.title}
            className="w-full max-h-32 md:max-h-44 object-cover rounded-xl mb-3"
          />
        )}

        {promo.title && (
          <h3 className="text-lg md:text-xl font-black text-white mb-1">{promo.title}</h3>
        )}

        {promo.description && (
          <p className="text-xs md:text-sm text-neutral-300 mb-3 line-clamp-2">{promo.description}</p>
        )}

        <div className="flex items-center gap-3">
          {promo.url && (
            <button
              onClick={() => handleLinkClick(promo.url!)}
              className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black px-5 py-2 rounded-full text-sm transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {promo.url_text || "Join Now"}
            </button>
          )}
          <button onClick={togglePause} className="bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors">
            {paused ? <Play className="w-4 h-4 text-white" /> : <Pause className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-6 left-4 right-4">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-400 transition-all duration-1000 ease-linear"
            style={{ width: `${((5 - countdown) / 5) * 100}%` }}
          />
        </div>
        <p className="text-center text-[9px] text-neutral-500 mt-1 font-bold">SPONSORED</p>
      </div>
    </div>
  );
};

export default PromoAdOverlay;
