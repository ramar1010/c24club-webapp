import { X, Sparkles } from "lucide-react";
import appPreview from "@/assets/app-promo/app-preview-with-badges.jpeg";

interface AppDownloadPopupProps {
  onClose: () => void;
}

const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.c24club.app&hl=en_US";

const AppDownloadPopup = ({ onClose }: AppDownloadPopupProps) => (
  <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center px-4">
    <div className="relative bg-neutral-900 border border-white/10 rounded-2xl p-5 max-w-sm w-full text-center shadow-[0_0_40px_rgba(234,179,8,0.25)] max-h-[90vh] overflow-y-auto animate-scale-in">
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 bg-neutral-800 hover:bg-neutral-700 rounded-full p-1.5 transition-colors z-10"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Floating emoji decorations */}
      <span className="absolute -top-3 -left-3 text-3xl animate-bounce" style={{ animationDuration: "2s" }}>🔔</span>
      <span className="absolute -top-3 -right-3 text-3xl animate-bounce" style={{ animationDuration: "2.5s", animationDelay: "0.3s" }}>📲</span>
      <span className="absolute -bottom-3 left-6 text-2xl animate-bounce" style={{ animationDuration: "1.8s", animationDelay: "0.6s" }}>🎉</span>
      <span className="absolute -bottom-3 right-6 text-2xl animate-bounce" style={{ animationDuration: "2.2s", animationDelay: "0.9s" }}>✨</span>

      {/* Text */}
      <div className="mb-4 mt-1">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
          <h2 className="text-white font-black text-xl uppercase tracking-wide">
            🤫 It's Quiet Here!
          </h2>
          <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" style={{ animationDelay: "0.5s" }} />
        </div>
        <p className="text-orange-400 font-bold text-sm mb-1 animate-pulse" style={{ animationDuration: "3s" }}>
          🔥 Everyone is on our App! 🔥
        </p>
        <p className="text-neutral-300 text-sm leading-relaxed">
          Get Notified Instantly When A Female/Male is searching!
        </p>
        <p className="text-yellow-400 font-bold text-sm mt-2 animate-pulse" style={{ animationDuration: "2.5s" }}>
          ⚡ Get Our App To Get Notified Instantly for FREE! 🔔
        </p>
      </div>

      {/* App preview image with glow */}
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl overflow-hidden border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.2)] hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-shadow duration-300"
      >
        <img
          src={appPreview}
          alt="C24Club App Preview — Get it on Google Play"
          className="w-full h-auto"
        />
      </a>

      {/* CTA button with glow */}
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-black text-sm uppercase tracking-wide transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] hover:scale-105 duration-300"
      >
        📲 Download Now — It's FREE 🚀
      </a>
    </div>
  </div>
);

export default AppDownloadPopup;