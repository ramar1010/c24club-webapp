import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const APP_SCHEME = "c24club://";
const IOS_STORE = "https://apps.apple.com/us/app/c24-club/id6766305883";
const ANDROID_STORE = "https://play.google.com/store/apps/details?id=com.c24club.app";

/** Smart link: opens the native app if installed, otherwise the store (mobile) or the web app (desktop). */
const OpenAppPage = () => {
  const [params] = useSearchParams();
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    const rawPath = params.get("p") || "/messages";
    const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
    const isAndroid = /Android/.test(ua);
    const webUrl = `${window.location.origin}${path}`;

    if (!isIOS && !isAndroid) {
      window.location.replace(webUrl);
      return;
    }

    const store = isIOS ? IOS_STORE : ANDROID_STORE;
    setFallbackUrl(store);

    let done = false;
    const onHide = () => { if (document.hidden) done = true; };
    document.addEventListener("visibilitychange", onHide);

    // Attempt the deep link
    window.location.href = `${APP_SCHEME}${path.replace(/^\//, "")}`;

    const timer = window.setTimeout(() => {
      if (!done && !document.hidden) window.location.replace(store);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [params]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
      <h1 className="text-lg font-semibold text-foreground">Opening C24 Club…</h1>
      <p className="text-sm text-muted-foreground">
        If nothing happens, we'll send you to the app store.
      </p>
      {fallbackUrl && (
        <a href={fallbackUrl} className="text-sm font-medium text-primary underline">
          Continue manually
        </a>
      )}
    </div>
  );
};

export default OpenAppPage;
