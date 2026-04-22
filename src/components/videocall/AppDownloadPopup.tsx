import { X } from "lucide-react";
import appPreview from "@/assets/app-promo/app-preview.jpeg";
import appStoreSoon from "@/assets/app-promo/app-store-soon.png";
import googlePlayBadge from "@/assets/app-promo/google-play-badge.svg";

interface AppDownloadPopupProps {
  onClose: () => void;
}

const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.c24club.app&hl=en_US";

const AppDownloadPopup = ({ onClose }: AppDownloadPopupProps) => {
  return (
    <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="relative bg-neutral-900 border border-white/10 rounded-2xl p-5 max-w-sm w-full text-center shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-neutral-800 hover:bg-neutral-700 rounded-full p-1.5 transition-colors z-10"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Text */}
        <div className="mb-4 mt-1">
          <h2 className="text-white font-black text-xl uppercase tracking-wide mb-2">
            🤫 It's Quiet Here!
          </h2>
          <p className="text-orange-400 font-bold text-sm mb-1">
            Everyone is on our App!
          </p>
          <p className="text-neutral-300 text-sm leading-relaxed">
            Get Notified Instantly When A Female/Male is searching!
          </p>
          <p className="text-yellow-400 font-bold text-sm mt-2">
            Get Our App To Get Notified Instantly for FREE! 🔔
          </p>
        </div>

        {/* Store badges */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <a
            href={GOOGLE_PLAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 transition-transform hover:scale-105"
          >
            <img src={googlePlayBadge} alt="Get it on Google Play" className="h-full w-auto" />
          </a>
          <div className="h-12 opacity-80">
            <img src={appStoreSoon} alt="Available on App Store Soon" className="h-full w-auto rounded-lg" />
          </div>
        </div>

        {/* App preview image */}
        <div className="rounded-xl overflow-hidden border border-white/10">
          <img
            src={appPreview}
            alt="C24Club App Preview"
            className="w-full h-auto"
          />
        </div>

        {/* CTA button */}
        <a
          href={GOOGLE_PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-black text-sm uppercase tracking-wide transition-colors"
        >
          📲 Download Now — It's FREE
        </a>
      </div>
    </div>
  );
};

export default AppDownloadPopup;