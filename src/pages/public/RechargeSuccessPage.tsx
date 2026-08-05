import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { broadcastRechargeUpdate } from "@/hooks/useRechargeMinutes";

const RechargeSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const cancelled = searchParams.get("cancelled");
  const [status, setStatus] = useState<"verifying" | "done" | "cancelled">(
    cancelled ? "cancelled" : "verifying",
  );
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    if (cancelled) {
      setTimeout(() => window.close(), 2000);
      return;
    }
    if (!sessionId) return;

    const verify = async () => {
      try {
        const { data } = await supabase.functions.invoke("recharge-minutes", {
          body: { action: "verify", session_id: sessionId },
        });
        setMinutes(data?.minutes ?? 0);
        broadcastRechargeUpdate();
      } catch {
        // fall through
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
            <p className="text-white text-xl font-bold">Purchase cancelled</p>
            <p className="text-white/50 text-sm mt-2">This tab will close automatically…</p>
          </>
        ) : status === "verifying" ? (
          <>
            <p className="text-white text-xl font-bold">Adding your call minutes…</p>
            <p className="text-white/50 text-sm mt-2">Please wait</p>
          </>
        ) : (
          <>
            <p className="text-2xl mb-2">📞</p>
            <p className="text-emerald-400 text-xl font-bold">
              {minutes > 0 ? `${minutes} call minutes added!` : "Call minutes added!"}
            </p>
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

export default RechargeSuccessPage;
