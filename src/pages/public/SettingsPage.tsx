import { useNavigate } from "react-router-dom";
import { ChevronLeft, X, Send, Mail, Key, Calendar, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountInfoOpen, setAccountInfoOpen] = useState(false);
  const [helpSubject, setHelpSubject] = useState("");
  const [helpMessage, setHelpMessage] = useState("");
  const [helpSending, setHelpSending] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  const handleResetPassword = async () => {
    if (!user?.email) {
      toast.error("No email found on your account.");
      return;
    }
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/settings`,
      });
      if (error) throw error;
      toast.success("Password reset link sent to your email!");
    } catch {
      toast.error("Failed to send reset link. Try again later.");
    } finally {
      setResetSending(false);
    }
  };

  const handleSendHelp = async () => {
    if (!helpSubject.trim() || !helpMessage.trim()) {
      toast.error("Please fill in both subject and message.");
      return;
    }
    setHelpSending(true);
    try {
      const { error } = await supabase.from("user_reports").insert({
        reporter_id: user?.id ?? "anonymous",
        reported_user_id: user?.id ?? "anonymous",
        reason: `[HELP] ${helpSubject.trim()}`,
        details: helpMessage.trim(),
      });
      if (error) throw error;
      toast.success("Your message has been sent! We'll get back to you soon.");
      setHelpSubject("");
      setHelpMessage("");
      setHelpOpen(false);
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setHelpSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-8">
      {/* Back button */}
      <div className="w-full flex items-center pt-3 pb-2">
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-black tracking-wide mt-2 mb-6">SETTINGS</h1>

      {/* Earn History */}
      <button
        onClick={() => navigate("/earn-history")}
        className="w-64 bg-gradient-to-r from-green-500 to-green-600 text-white font-black text-lg py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg mb-4 tracking-wide border border-green-400/40"
      >
        EARN HISTORY
      </button>







      {/* Referrals & Get Help */}
      <div className="flex gap-4 mb-6">
        <button className="bg-gradient-to-r from-red-500 to-red-600 text-white font-black text-base py-2.5 px-6 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide border border-red-400/40">
          Referrals
        </button>
        <button
          onClick={() => setHelpOpen(true)}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white font-black text-base py-2.5 px-6 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide border border-green-400/40"
        >
          Get Help
        </button>
      </div>

      {/* Get Help Overlay */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-neutral-900 rounded-2xl w-full max-w-md p-6 relative border border-neutral-700">
            <button
              onClick={() => setHelpOpen(false)}
              className="absolute top-3 right-3 bg-neutral-800 hover:bg-neutral-700 rounded-full p-1.5 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-xl font-black tracking-wide mb-1">GET HELP</h2>
            <p className="text-neutral-400 text-sm mb-4">Send us a message and we'll get back to you.</p>

            <label className="block text-sm font-bold mb-1">Subject</label>
            <input
              value={helpSubject}
              onChange={(e) => setHelpSubject(e.target.value)}
              placeholder="What do you need help with?"
              maxLength={150}
              className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500 mb-3 focus:outline-none focus:ring-1 focus:ring-green-500"
            />

            <label className="block text-sm font-bold mb-1">Message</label>
            <textarea
              value={helpMessage}
              onChange={(e) => setHelpMessage(e.target.value)}
              placeholder="Describe your issue or question..."
              maxLength={1000}
              rows={4}
              className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500 mb-4 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
            />

            <button
              onClick={handleSendHelp}
              disabled={helpSending}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-black text-base py-2.5 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide border border-green-400/40 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {helpSending ? "SENDING..." : "SEND MESSAGE"}
            </button>
          </div>
        </div>
      )}

      {/* Account Info */}
      <button
        onClick={() => setAccountInfoOpen(true)}
        className="w-48 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-black text-base py-2.5 rounded-full hover:opacity-90 transition-opacity shadow-lg mb-8 tracking-wide border border-orange-400/40"
      >
        Account Info
      </button>

      {/* Account Info Overlay */}
      {accountInfoOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-neutral-900 rounded-2xl w-full max-w-md p-6 relative border border-neutral-700">
            <button
              onClick={() => setAccountInfoOpen(false)}
              className="absolute top-3 right-3 bg-neutral-800 hover:bg-neutral-700 rounded-full p-1.5 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-xl font-black tracking-wide mb-4">ACCOUNT INFO</h2>

            {/* Email */}
            <div className="flex items-center gap-3 bg-neutral-800 rounded-xl p-3 mb-3 border border-neutral-700">
              <Mail className="w-5 h-5 text-yellow-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-neutral-400 font-bold">Email</p>
                <p className="text-sm font-bold truncate">{user?.email || "Not set"}</p>
              </div>
            </div>

            {/* User ID */}
            <div className="flex items-center gap-3 bg-neutral-800 rounded-xl p-3 mb-3 border border-neutral-700">
              <Shield className="w-5 h-5 text-blue-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-neutral-400 font-bold">User ID</p>
                <p className="text-sm font-bold truncate">{user?.id ? `${user.id.slice(0, 8)}...` : "N/A"}</p>
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-center gap-3 bg-neutral-800 rounded-xl p-3 mb-3 border border-neutral-700">
              <Calendar className="w-5 h-5 text-green-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-neutral-400 font-bold">Member Since</p>
                <p className="text-sm font-bold">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                    : "N/A"}
                </p>
              </div>
            </div>

            {/* Auth Provider */}
            <div className="flex items-center gap-3 bg-neutral-800 rounded-xl p-3 mb-4 border border-neutral-700">
              <Key className="w-5 h-5 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-neutral-400 font-bold">Sign-in Method</p>
                <p className="text-sm font-bold capitalize">
                  {user?.app_metadata?.provider || "email"}
                </p>
              </div>
            </div>

            {/* Reset Password */}
            <button
              onClick={handleResetPassword}
              disabled={resetSending}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white font-black text-base py-2.5 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide border border-red-400/40 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Key className="w-4 h-4" />
              {resetSending ? "SENDING..." : "RESET PASSWORD"}
            </button>
          </div>
        </div>
      )}

      {/* Change Email Notifications */}
      <p className="text-base font-bold mb-8 underline underline-offset-4 decoration-2 cursor-pointer hover:opacity-80 transition-opacity">
        Change Email Notifications
      </p>

      {/* Footer Links */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 font-bold">
        <a href="/terms" className="hover:text-white transition-colors underline">Terms</a>
        <span>|</span>
        <a href="/privacy" className="hover:text-white transition-colors underline">Privacy</a>
        <span>|</span>
        <a href="/rules" className="hover:text-white transition-colors underline">Rules</a>
        <span>|</span>
        <a href="/faq" className="hover:text-white transition-colors underline">FAQ</a>
      </div>
    </div>
  );
};

export default SettingsPage;
