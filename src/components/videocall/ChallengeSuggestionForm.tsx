import { useState } from "react";
import { Lightbulb, Send, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const ChallengeSuggestionForm = () => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!user || !title.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("challenge_suggestions" as any).insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
      } as any);
      if (error) throw error;
      setSubmitted(true);
      setTitle("");
      setDescription("");
      toast.success("Suggestion submitted! 🎉");
      setTimeout(() => setSubmitted(false), 4000);
    } catch {
      toast.error("Failed to submit suggestion");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="w-full max-w-md mx-auto mt-6">
      <div className="bg-gradient-to-br from-violet-600/20 via-purple-700/15 to-indigo-900/30 border border-violet-400/30 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-violet-300" />
          <h3 className="font-black text-sm tracking-wider text-violet-200">SUGGEST A CHALLENGE</h3>
        </div>
        <p className="text-xs text-neutral-400 mb-4">
          Have a cool challenge idea? Let us know and we might add it!
        </p>

        <input
          type="text"
          placeholder="Challenge name..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          className="w-full bg-black/40 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-violet-400/60 mb-3"
        />
        <textarea
          placeholder="Describe how it works (optional)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full bg-black/40 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-violet-400/60 resize-none mb-3"
        />

        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || submitted}
          className="w-full py-2.5 rounded-xl font-black text-sm tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : submitted ? (
            <>
              <CheckCircle className="w-4 h-4" />
              SUBMITTED!
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              SUBMIT IDEA
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ChallengeSuggestionForm;
