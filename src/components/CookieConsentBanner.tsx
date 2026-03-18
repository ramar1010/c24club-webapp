import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const COOKIE_CONSENT_KEY = "cookie_consent";

const CookieConsentBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] animate-in slide-in-from-bottom duration-500">
      <div className="mx-auto max-w-3xl px-4 pb-4">
        <div className="relative rounded-2xl border border-neutral-700 bg-neutral-900/95 backdrop-blur-md p-4 shadow-2xl">
          <button
            onClick={handleDecline}
            className="absolute top-3 right-3 text-neutral-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pr-6">
            <span className="text-xl flex-shrink-0">🍪</span>
            <p className="text-xs text-neutral-300 leading-relaxed">
              We use cookies and similar technologies to improve your experience, analyze traffic, and personalize content.
              By continuing, you agree to our{" "}
              <Link to="/privacy" className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
            <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
              <button
                onClick={handleDecline}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-black text-neutral-900 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 rounded-lg transition-colors"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
