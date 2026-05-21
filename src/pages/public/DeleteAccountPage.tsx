import { useEffect, useState } from "react";
import { Trash2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";

const schema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  reason: z.string().trim().max(1000).optional(),
});

const DeleteAccountPage = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirm, setConfirm] = useState(false);

  usePageMeta({
    title: "Delete Your Account - C24 Club",
    description:
      "Request deletion of your C24 Club account and associated data. Learn what data is removed, what is retained, and how to submit a request.",
  });

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  const handleImmediateDelete = async () => {
    if (!user) return;
    if (!confirm) {
      toast.error("Please confirm you understand this is permanent.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", { body: {} });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || "Failed to delete");
      await supabase.auth.signOut();
      setSent(true);
      toast.success("Your account has been deleted.");
    } catch (err: any) {
      console.error("delete-account error:", err);
      toast.error(err?.message || "Could not delete account. Please submit a request below.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, reason });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("contact_messages").insert({
        name: "Account Deletion Request",
        email: parsed.data.email,
        subject: "Account Deletion Request",
        message:
          `The user with email ${parsed.data.email} has requested account deletion.\n\n` +
          `Reason: ${parsed.data.reason || "(not provided)"}`,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
      setSent(true);
      setReason("");
      toast.success("Your deletion request has been submitted.");
    } catch (err) {
      console.error("delete request error:", err);
      toast.error("Failed to submit. Please email support@c24club.com directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">Delete Your Account</h1>
          <p className="text-white/60">
            Request that your C24 Club account and associated data be permanently deleted.
          </p>
        </div>

        {/* What gets deleted */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-white font-bold text-lg mb-3">What we delete</h2>
          <ul className="text-white/70 text-sm space-y-2 list-disc list-inside">
            <li>Your profile, photos, and Discover listing</li>
            <li>Your messages, gifts, and call history</li>
            <li>Your minute balance, rewards, and referral data</li>
            <li>Your authentication account (email/password, Google, etc.)</li>
          </ul>

          <h2 className="text-white font-bold text-lg mt-6 mb-3">What we retain</h2>
          <ul className="text-white/70 text-sm space-y-2 list-disc list-inside">
            <li>
              Records required by law (e.g. payment/transaction receipts) for up to 7 years
              for tax and accounting purposes
            </li>
            <li>
              Safety records (e.g. ban history, abuse reports) retained indefinitely to
              prevent re-registration of banned users
            </li>
            <li>Anonymized, aggregated analytics that cannot identify you</li>
          </ul>
        </div>

        {/* How to request */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-white font-bold text-lg mb-3">How to request deletion</h2>
          <ol className="text-white/70 text-sm space-y-2 list-decimal list-inside">
            <li>
              <span className="font-semibold text-white">In-app (fastest):</span> Open the app,
              go to <span className="text-white">Settings → Account → Delete Account</span>.
              Your account is deleted immediately.
            </li>
            <li>
              <span className="font-semibold text-white">On this page:</span> If you're signed in
              below, you can delete your account with one click. Otherwise, submit a request
              using the form below and we'll process it within 30 days.
            </li>
          </ol>
        </div>

        {sent ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-white font-bold text-xl mb-1">Request received</h3>
            <p className="text-white/60 text-sm">
              We've recorded your deletion request. You'll receive a confirmation email when it's processed.
            </p>
          </div>
        ) : user ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-white/80 text-sm">
                You're signed in as <span className="font-bold text-white">{user.email}</span>.
                Deleting your account is permanent and cannot be undone.
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
                className="mt-1 w-4 h-4 accent-red-500"
              />
              <span className="text-white/70 text-sm">
                I understand my account, profile, messages, rewards, and minute balance will be
                permanently deleted.
              </span>
            </label>
            <button
              onClick={handleImmediateDelete}
              disabled={submitting || !confirm}
              className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              {submitting ? "Deleting..." : "Permanently Delete My Account"}
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmitRequest}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-white font-bold text-lg">Submit a deletion request</h2>
            <p className="text-white/50 text-sm">
              Enter the email address of the account you'd like to delete. We'll verify and process
              your request within 30 days.
            </p>
            <div>
              <label className="text-white/60 text-sm block mb-1.5">Account Email</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-1.5">Reason (optional)</label>
              <textarea
                rows={3}
                placeholder="Help us improve — why are you leaving?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              {submitting ? "Submitting..." : "Submit Deletion Request"}
            </button>
            <p className="text-white/30 text-xs text-center">
              Or email us directly at{" "}
              <a href="mailto:support@c24club.com" className="text-red-400 hover:underline">
                support@c24club.com
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default DeleteAccountPage;