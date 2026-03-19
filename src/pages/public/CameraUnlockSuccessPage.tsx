import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CameraUnlockSuccessPage = () => {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const cancelled = params.get("cancelled");

    if (cancelled) {
      setStatus("error");
      setTimeout(() => window.close(), 2000);
      return;
    }

    if (!sessionId) {
      setStatus("error");
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("camera-unlock", {
          body: { action: "verify", session_id: sessionId },
        });
        if (error) throw error;
        if (data?.success) {
          setStatus("success");
          setTimeout(() => window.close(), 2000);
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };

    verify();
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <div className="text-center p-6">
        {status === "verifying" && (
          <>
            <div className="w-12 h-12 border-4 border-white/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-bold">Verifying payment...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <p className="text-lg font-bold text-emerald-400">Payment verified!</p>
            <p className="text-sm text-neutral-400 mt-2">
              Your partner will now receive the camera request. This tab will close automatically.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <p className="text-lg font-bold text-red-400">Payment cancelled or failed</p>
            <p className="text-sm text-neutral-400 mt-2">
              Go back to your call tab. This tab will close automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraUnlockSuccessPage;
