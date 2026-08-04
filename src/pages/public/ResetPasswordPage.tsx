import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key } from "lucide-react";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const search = new URLSearchParams(window.location.search);
    const errCode = params.get("error_code") || search.get("error_code");
    const errDesc = params.get("error_description") || search.get("error_description");

    if (errCode || errDesc) {
      setError(
        errCode === "otp_expired"
          ? "This reset link has expired or was already used. Request a new one below."
          : (errDesc || "").replace(/\+/g, " ") || "This reset link is invalid. Request a new one below."
      );
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      toast.error(updateError.message);
    } else {
      toast.success("Password updated! ✨");
      navigate("/profile");
    }
  };

  const handleResend = async () => {
    if (!resendEmail.trim()) { toast.error("Enter your email"); return; }
    setResending(true);
    const { error: resendError } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResending(false);
    if (resendError) toast.error(resendError.message);
    else toast.success("New reset link sent — open it within 1 hour.");
  };

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Reset Password</h1>
        </div>

        {error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value.trim())}
              placeholder="your@email.com"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
            >
              {resending ? "Sending…" : "Send new reset link"}
            </button>
            <button onClick={() => navigate("/")} className="w-full text-sm text-white/60 hover:underline">
              Back home
            </button>
          </div>
        ) : !ready ? (
          <p className="text-sm text-white/60">Verifying reset link…</p>
        ) : (
          <form onSubmit={handleReset} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              minLength={6}
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              minLength={6}
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
