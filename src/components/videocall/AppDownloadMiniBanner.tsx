import { X } from "lucide-react";
import { useState, useEffect } from "react";

const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.c24club.app&hl=en_US";

const STORAGE_KEY = "c24_app_mini_banner_count";
const MAX_SHOWS = 5;

interface AppDownloadMiniBannerProps {
  userId?: string;
  gender?: string | null;
}

const AppDownloadMiniBanner = ({ userId, gender }: AppDownloadMiniBannerProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isAndroid = /android/i.test(navigator.userAgent);
    const isMale = gender?.toLowerCase() === "male";
    const shown = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);

    if (isAndroid && isMale && shown < MAX_SHOWS) {
      setVisible(true);
      localStorage.setItem(STORAGE_KEY, String(shown + 1));
    }
  }, [gender]);

  if (!visible) return null;

  return (
    <div className="mx-3 mb-2 bg-gradient-to-r from-neutral-900 to-neutral-800 border border-yellow-500/30 rounded-xl px-3 py-2.5 flex items-center gap-3 shadow-[0_0_15px_rgba(234,179,8,0.15)] animate-fade-in">
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-bold leading-tight">
          🔥 Everyone is on our App!
        </p>
        <p className="text-neutral-300 text-[11px] leading-tight mt-0.5">
          Get Notified when a female user is online and searching
        </p>
      </div>
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 bg-green-500 hover:bg-green-600 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors shadow-md"
      >
        Get App
      </a>
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors"
      >
        <X className="w-4 h-4 text-neutral-400" />
      </button>
    </div>
  );
};

export default AppDownloadMiniBanner;