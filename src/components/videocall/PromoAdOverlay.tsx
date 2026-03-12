import { useState, useEffect, useRef, useCallback } from "react";
import { X, ExternalLink, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PromoAd {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  url_text: string | null;
  image_thumb_url: string | null;
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

  // Fetch a random active promo
  useEffect(() => {
    const fetchPromo = async () => {
      const { data } = await supabase
        .from("promos")
        .select("id, title, description, url, url_text, image_thumb_url")
        .eq("is_active", true)
        .eq("status", "Active")
        .neq("member_id", viewerId)
        .limit(20);

      if (data && data.length > 0) {
        const randomPromo = data[Math.floor(Math.random() * data.length)];
        setPromo(randomPromo as PromoAd);
        promoIdRef.current = randomPromo.id;
      } else {
        // No promos available, just dismiss
        onDismiss();
      }
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
    // Fire and forget analytics insert
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
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-6 relative">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Countdown */}
        <div className="absolute top-3 left-3 bg-white/10 rounded-full px-3 py-1 text-xs font-bold text-white">
          {countdown > 0 ? `${countdown}s` : "Done"}
        </div>

        {/* Promo content */}
        <div className="mt-8 text-center">
          {promo.image_thumb_url && (
            <img
              src={promo.image_thumb_url}
              alt={promo.title}
              className="w-full max-h-48 object-cover rounded-xl mb-4"
            />
          )}

          {promo.title && (
            <h3 className="text-xl font-black text-white mb-2">{promo.title}</h3>
          )}

          {promo.description && (
            <p className="text-sm text-neutral-300 mb-4">{promo.description}</p>
          )}

          <div className="flex items-center justify-center gap-3 mt-4">
            {promo.url && (
              <button
                onClick={() => handleLinkClick(promo.url!)}
                className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black px-6 py-2.5 rounded-full transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {promo.url_text || "Join Now"}
              </button>
            )}
            <button onClick={togglePause} className="bg-white/10 hover:bg-white/20 rounded-full p-2.5 transition-colors">
              {paused ? <Play className="w-5 h-5 text-white" /> : <Pause className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-400 transition-all duration-1000 ease-linear"
            style={{ width: `${((5 - countdown) / 5) * 100}%` }}
          />
        </div>

        <p className="text-center text-[10px] text-neutral-500 mt-2 font-bold">SPONSORED</p>
      </div>
    </div>
  );
};

export default PromoAdOverlay;
