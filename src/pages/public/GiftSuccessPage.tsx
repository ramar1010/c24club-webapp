import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const GiftSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const cancelled = searchParams.get("cancelled");
  const [status, setStatus] = useState<"verifying" | "done" | "cancelled">(
    cancelled ? "cancelled" : "verifying"
  );

  useEffect(() => {
    if (cancelled) {
      setTimeout(() => window.close(), 2000);
      return;
    }

    if (!sessionId) return;

    const verify = async () => {
      try {
        await supabase.functions.invoke("gift-minutes", {
          body: { action: "verify", session_id: sessionId },
        });
      } catch {
        // still close
      }
      setStatus("done");
      setTimeout(() => window.close(), 2500);
    };

    verify();
  }, [sessionId, cancelled]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="text-center">
        {status === "cancelled" ? (
          <>
            <p className="text-white text-xl font-bold">Gift cancelled</p>
            <p className="text-white/50 text-sm mt-2">This tab will close automatically…</p>
          </>
        ) : status === "verifying" ? (
          <>
            <p className="text-white text-xl font-bold">Processing your gift…</p>
            <p className="text-white/50 text-sm mt-2">Please wait</p>
          </>
        ) : (
          <>
            <p className="text-2xl mb-2">🎁</p>
            <p className="text-emerald-400 text-xl font-bold">Gift sent successfully!</p>
            <p className="text-white/50 text-sm mt-2">This tab will close automatically…</p>
            <p className="text-white/30 text-xs mt-4">
              If it doesn't close,{" "}
              <button onClick={() => window.close()} className="underline text-white/50">
                click here
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default GiftSuccessPage;
