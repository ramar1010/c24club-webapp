import { useState } from "react";
import { Mail, Send, Loader2, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, "Message is required").max(2000, "Message must be under 2000 characters"),
});

const ContactPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse({ name, email, subject, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("contact_messages").insert({
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject || null,
        message: parsed.data.message,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
      setSent(true);
      setName(""); setEmail(""); setSubject(""); setMessage("");
      toast.success("Message sent! We'll get back to you soon.");
    } catch (err) {
      console.error("Contact submit error:", err);
      toast.error("Failed to send message. Please email us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">Contact Us</h1>
          <p className="text-white/60">We'd love to hear from you. Questions, feedback, or support — send us a message.</p>
        </div>

        {/* Direct email card */}
        <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/5 border border-orange-400/30 rounded-2xl p-5 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-orange-300" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Prefer email?</p>
            <a href="mailto:business@c24club.com" className="text-orange-300 hover:text-orange-200 font-bold text-base">
              business@c24club.com
            </a>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/70 text-xs font-bold uppercase tracking-wide mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                className="w-full bg-black/40 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-orange-400/60"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-white/70 text-xs font-bold uppercase tracking-wide mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                required
                className="w-full bg-black/40 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-orange-400/60"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-white/70 text-xs font-bold uppercase tracking-wide mb-2">Subject (optional)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className="w-full bg-black/40 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-orange-400/60"
              placeholder="What's this about?"
            />
          </div>

          <div>
            <label className="block text-white/70 text-xs font-bold uppercase tracking-wide mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              required
              rows={6}
              className="w-full bg-black/40 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-orange-400/60 resize-none"
              placeholder="How can we help?"
            />
            <p className="text-right text-white/40 text-xs mt-1">{message.length}/2000</p>
          </div>

          <button
            type="submit"
            disabled={submitting || sent}
            className="w-full py-3.5 rounded-xl font-black text-sm tracking-wider text-white bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-400 hover:to-yellow-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : sent ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> SENT!
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> SEND MESSAGE
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactPage;