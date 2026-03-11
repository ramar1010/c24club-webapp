import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TopicCategory {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
}

interface PinTopicsOverlayProps {
  userId: string;
  onClose: () => void;
}

const PinTopicsOverlay = ({ userId, onClose }: PinTopicsOverlayProps) => {
  const [categories, setCategories] = useState<TopicCategory[]>([]);
  const [pinnedTopicIds, setPinnedTopicIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Fetch categories with their topics
      const { data: cats } = await supabase
        .from("topic_categories")
        .select("id, name")
        .eq("status", "active")
        .order("name");

      const { data: topics } = await supabase
        .from("topics")
        .select("id, name, category_id")
        .eq("status", "active")
        .order("name");

      const { data: pinned } = await supabase
        .from("pinned_topics")
        .select("topic_id")
        .eq("user_id", userId);

      const grouped: TopicCategory[] = (cats || []).map((cat) => ({
        id: cat.id,
        name: cat.name,
        topics: (topics || []).filter((t: any) => t.category_id === cat.id),
      }));

      setCategories(grouped);
      setPinnedTopicIds(new Set((pinned || []).map((p) => p.topic_id)));
      setLoading(false);
    };
    fetchData();
  }, [userId]);

  const togglePin = async (topicId: string) => {
    const isPinned = pinnedTopicIds.has(topicId);
    if (isPinned) {
      const { error } = await supabase
        .from("pinned_topics")
        .delete()
        .eq("user_id", userId)
        .eq("topic_id", topicId);
      if (error) {
        toast.error("Failed to unpin topic");
        return;
      }
      setPinnedTopicIds((prev) => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    } else {
      const { error } = await supabase
        .from("pinned_topics")
        .insert({ user_id: userId, topic_id: topicId });
      if (error) {
        toast.error("Failed to pin topic");
        return;
      }
      setPinnedTopicIds((prev) => new Set(prev).add(topicId));
    }
  };

  const selectedCat = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <button
          onClick={onClose}
          className="absolute top-3 left-3 z-10"
        >
          <X className="w-7 h-7 text-red-500" />
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-black text-white tracking-tight">Pin Topics</h1>
          <p className="text-sm text-neutral-400 mt-1 leading-tight">
            Encounter less skips &<br />
            less boring chats when topics are pinned!
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      ) : !selectedCategory ? (
        /* Category selector dropdown-style */
        <div className="flex-1 flex flex-col items-center px-6 pt-4">
          <button
            onClick={() => {}}
            className="bg-neutral-800 border border-neutral-600 rounded-full px-8 py-3 flex items-center gap-3 mb-8"
          >
            <span className="text-white font-bold text-lg">Pin Topic</span>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Category list */}
          <div className="w-full space-y-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="w-full text-left bg-neutral-900 border border-neutral-700 rounded-xl px-5 py-4 hover:bg-neutral-800 transition-colors"
              >
                <span className="text-white font-black text-lg">{cat.name}</span>
                {cat.topics.some((t) => pinnedTopicIds.has(t.id)) && (
                  <span className="ml-2 text-red-400 text-sm">📌</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Topics within selected category */
        <div className="flex-1 flex flex-col px-6 pt-2 overflow-y-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-neutral-400 text-sm mb-4 flex items-center gap-1 hover:text-white transition-colors"
          >
            ← Back to categories
          </button>
          <h2 className="text-white font-black text-xl mb-4">{selectedCat?.name}</h2>
          <div className="space-y-2">
            {selectedCat?.topics.map((topic) => {
              const isPinned = pinnedTopicIds.has(topic.id);
              return (
                <button
                  key={topic.id}
                  onClick={() => togglePin(topic.id)}
                  className={`w-full text-left rounded-xl px-5 py-4 transition-colors border ${
                    isPinned
                      ? "bg-red-900/30 border-red-700 text-white"
                      : "bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  <span className="font-bold">{topic.name}</span>
                  {isPinned && <span className="ml-2">📌</span>}
                </button>
              );
            })}
            {selectedCat?.topics.length === 0 && (
              <p className="text-neutral-500 text-sm text-center py-8">No topics in this category yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Bottom - Rules link */}
      <div className="py-4 text-center">
        <span className="text-white font-black text-lg tracking-wide">Rules</span>
      </div>
    </div>
  );
};

export default PinTopicsOverlay;
