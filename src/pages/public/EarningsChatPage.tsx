import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Lock, Camera, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  user_id: string | null;
  body: string;
  is_system: boolean;
  amount_cents: number | null;
  created_at: string;
}

interface AuthorInfo {
  name: string | null;
  image_thumb_url: string | null;
  image_url: string | null;
}

// Strip links, emails, phone numbers and social handles — keeps earners on-platform.
const BLOCK_PATTERNS: RegExp[] = [
  /https?:\/\/\S+/gi,
  /\bwww\.\S+/gi,
  /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi,
  /\b[\w-]+\.(com|net|org|io|co|me|ly|onlyfans|xyz|link)\b/gi,
  /(?:\+?\d[\s-]?){7,}/g,
  /(?:^|\s)@[A-Za-z0-9_.]{3,}/g,
];

export function sanitizeChatBody(input: string): { clean: string; blocked: boolean } {
  let blocked = false;
  let clean = input;
  for (const re of BLOCK_PATTERNS) {
    if (re.test(clean)) blocked = true;
    clean = clean.replace(re, " [removed] ");
  }
  return { clean: clean.replace(/\s{2,}/g, " ").trim(), blocked };
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const EarningsChatPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [gateReason, setGateReason] = useState<"gender" | "selfie" | "pending" | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorInfo>>({});
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Access gate
  useEffect(() => {
    if (!user) {
      setChecking(false);
      setAllowed(false);
      setGateReason("gender");
      return;
    }
    (async () => {
      const [{ data: me }, { data: roles }] = await Promise.all([
        supabase.from("members").select("gender, image_status, image_url").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const isStaff = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "moderator");
      const isFemale = (me?.gender ?? "").toLowerCase() === "female";
      if (isStaff || (isFemale && me?.image_status === "approved" && me?.image_url)) {
        setAllowed(true);
      } else if (!isFemale) {
        setGateReason("gender");
      } else if (!me?.image_url) {
        setGateReason("selfie");
      } else {
        setGateReason("pending");
      }
      setChecking(false);
    })();
  }, [user]);

  const loadAuthors = async (rows: ChatMessage[]) => {
    const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
    if (!ids.length) return;
    const { data } = await supabase.from("members").select("id, name, image_thumb_url, image_url").in("id", ids);
    if (data) {
      setAuthors((prev) => {
        const next = { ...prev };
        for (const m of data as any[]) next[m.id] = { name: m.name, image_thumb_url: m.image_thumb_url, image_url: m.image_url };
        return next;
      });
    }
  };

  // Initial load + realtime
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("group_chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150);
      if (!active) return;
      const rows = ((data ?? []) as ChatMessage[]).slice().reverse();
      setMessages(rows);
      void loadAuthors(rows);
      setLoading(false);
    })();

    const channel = supabase
      .channel("group-earnings-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_chat_messages" },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          void loadAuthors([row]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "group_chat_messages" },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [allowed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const raw = text.trim();
    if (!raw || !user || sending) return;
    const { clean, blocked } = sanitizeChatBody(raw);
    if (!clean) {
      toast.error("Links, handles and phone numbers aren't allowed here.");
      return;
    }
    if (blocked) toast.warning("Links & contact info were removed from your message.");
    setSending(true);
    const { error } = await supabase.from("group_chat_messages").insert({
      user_id: user.id,
      body: clean.slice(0, 500),
      is_system: false,
    } as any);
    setSending(false);
    if (error) {
      toast.error("Couldn't send — try again.");
      return;
    }
    setText("");
  };

  const totalShown = useMemo(
    () => messages.reduce((sum, m) => sum + (m.amount_cents ?? 0), 0),
    [messages]
  );

  if (checking) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#111] text-white px-5 py-10">
        <button onClick={() => navigate(-1)} className="text-white/60 hover:text-white mb-6 flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="max-w-md mx-auto text-center rounded-2xl border border-pink-500/30 bg-gradient-to-b from-pink-500/10 to-purple-500/10 p-7">
          <Lock className="w-10 h-10 text-pink-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Girls Earnings Chat</h1>
          {gateReason === "gender" && (
            <p className="text-white/70 text-sm">This group chat is for verified female members only.</p>
          )}
          {gateReason === "selfie" && (
            <>
              <p className="text-white/70 text-sm mb-5">
                Take your Discover selfie to get verified and join the earnings chat — see what other girls are making and how they do it.
              </p>
              <button
                onClick={() => navigate("/discover")}
                className="inline-flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-bold px-5 py-2.5 rounded-lg"
              >
                <Camera className="w-4 h-4" /> Get Verified
              </button>
            </>
          )}
          {gateReason === "pending" && (
            <p className="text-white/70 text-sm">
              Your selfie is under review. Once it's approved you'll get instant access to the earnings chat.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col">
      <div className="sticky top-0 z-40 bg-[#111]/95 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-white/60 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">💸 Girls Earnings Chat</h1>
            <p className="text-white/50 text-xs">Verified female members only · no links or contact info</p>
          </div>
          {totalShown > 0 && (
            <div className="text-right">
              <p className="text-emerald-400 font-bold text-sm">${(totalShown / 100).toFixed(2)}</p>
              <p className="text-white/40 text-[10px]">shown here</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-white/40 text-sm py-10">No messages yet — say hi 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === user?.id;
            const author = m.user_id ? authors[m.user_id] : undefined;
            if (m.is_system) {
              return (
                <div key={m.id} className="flex justify-center">
                  <div className="max-w-[92%] rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center">
                    <p className="text-emerald-300 text-sm font-semibold leading-snug">{m.body}</p>
                    <p className="text-white/30 text-[10px] mt-1">{timeAgo(m.created_at)} ago</p>
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (
                  <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden shrink-0">
                    {(author?.image_thumb_url || author?.image_url) && (
                      <img
                        src={(author.image_thumb_url || author.image_url) as string}
                        alt={author?.name ?? "Member"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                )}
                <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                  {!mine && <span className="text-white/50 text-[11px] px-1">{author?.name ?? "Member"}</span>}
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                      mine ? "bg-pink-500 text-white rounded-br-sm" : "bg-white/10 text-white rounded-bl-sm"
                    }`}
                  >
                    {m.body}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-white/30 text-[10px]">{timeAgo(m.created_at)} ago</span>
                    {mine && (
                      <button
                        onClick={async () => {
                          await supabase.from("group_chat_messages").delete().eq("id", m.id);
                          setMessages((prev) => prev.filter((x) => x.id !== m.id));
                        }}
                        className="text-white/30 hover:text-red-400"
                        aria-label="Delete message"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 bg-[#111]/95 backdrop-blur-md border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Share a win or ask the girls…"
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500/50"
          />
          <button
            onClick={() => void handleSend()}
            disabled={sending || !text.trim()}
            className="bg-pink-500 hover:bg-pink-600 disabled:opacity-40 text-white rounded-full p-2.5"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EarningsChatPage;
