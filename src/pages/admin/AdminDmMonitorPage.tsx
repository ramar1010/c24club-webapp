import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, ArrowLeft, User, Clock } from "lucide-react";
import { format } from "date-fns";

interface ConversationRow {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string | null;
  created_at: string;
}

interface MemberInfo {
  id: string;
  name: string;
  email: string | null;
  image_thumb_url: string | null;
}

interface DmMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

const PAGE_SIZE = 30;
const ADMIN_USER_ID = "6f8bb0e2-a36a-4bc0-920f-312c340f7921";

const AdminDmMonitorPage = () => {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [members, setMembers] = useState<Map<string, MemberInfo>>(new Map());
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  // conversation_id -> { initiator, replied }
  const [replyMap, setReplyMap] = useState<Map<string, { initiator: string; replied: boolean }>>(new Map());
  const [overallStats, setOverallStats] = useState<{ total: number; replied: number } | null>(null);
  const [replyFilter, setReplyFilter] = useState<"all" | "replied" | "no_reply">("all");

  // Fetch reply status for a batch of conversations
  const fetchReplyStatus = async (convoIds: string[]) => {
    if (convoIds.length === 0) return new Map();
    const { data } = await supabase
      .from("dm_messages")
      .select("conversation_id, sender_id, created_at")
      .in("conversation_id", convoIds)
      .order("created_at", { ascending: true });

    const map = new Map<string, { initiator: string; replied: boolean; senders: Set<string> }>();
    (data || []).forEach((m: any) => {
      const cur = map.get(m.conversation_id);
      if (!cur) {
        map.set(m.conversation_id, { initiator: m.sender_id, replied: false, senders: new Set([m.sender_id]) });
      } else {
        cur.senders.add(m.sender_id);
        if (cur.senders.size > 1) cur.replied = true;
      }
    });
    return map;
  };

  // Fetch overall response rate across ALL non-admin conversations
  useEffect(() => {
    const loadOverall = async () => {
      // Get all conversation IDs (excluding admin ones)
      const { data: allConvos } = await supabase
        .from("conversations")
        .select("id")
        .neq("participant_1", ADMIN_USER_ID)
        .neq("participant_2", ADMIN_USER_ID);

      if (!allConvos) return;
      const ids = allConvos.map((c: any) => c.id);
      const total = ids.length;

      // Fetch in chunks to avoid URL limits
      const chunkSize = 200;
      let replied = 0;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const map = await fetchReplyStatus(chunk);
        map.forEach((v) => { if (v.replied) replied += 1; });
      }
      setOverallStats({ total, replied });
    };
    loadOverall();
  }, []);

  const fetchMemberInfo = async (convos: ConversationRow[], existingMap: Map<string, MemberInfo>) => {
    const userIds = new Set<string>();
    convos.forEach((c) => {
      if (!existingMap.has(c.participant_1)) userIds.add(c.participant_1);
      if (!existingMap.has(c.participant_2)) userIds.add(c.participant_2);
    });
    if (userIds.size === 0) return existingMap;

    const { data: memberData } = await supabase
      .from("members")
      .select("id, name, email, image_thumb_url")
      .in("id", Array.from(userIds));

    const map = new Map(existingMap);
    memberData?.forEach((m) => map.set(m.id, m));
    return map;
  };

  // Load initial conversations
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: convos } = await supabase
        .from("conversations")
        .select("*")
        .neq("participant_1", ADMIN_USER_ID)
        .neq("participant_2", ADMIN_USER_ID)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .range(0, PAGE_SIZE - 1);

      if (convos) {
        setConversations(convos);
        setHasMore(convos.length === PAGE_SIZE);
        const map = await fetchMemberInfo(convos, new Map());
        setMembers(map);
        const rMap = await fetchReplyStatus(convos.map((c: any) => c.id));
        const simplified = new Map<string, { initiator: string; replied: boolean }>();
        rMap.forEach((v, k) => simplified.set(k, { initiator: v.initiator, replied: v.replied }));
        setReplyMap(simplified);
      }
      setLoading(false);
    };
    load();
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    const { data: convos } = await supabase
      .from("conversations")
      .select("*")
      .neq("participant_1", ADMIN_USER_ID)
      .neq("participant_2", ADMIN_USER_ID)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(conversations.length, conversations.length + PAGE_SIZE - 1);

    if (convos) {
      setConversations((prev) => [...prev, ...convos]);
      setHasMore(convos.length === PAGE_SIZE);
      const map = await fetchMemberInfo(convos, members);
      setMembers(map);
      const rMap = await fetchReplyStatus(convos.map((c: any) => c.id));
      setReplyMap((prev) => {
        const next = new Map(prev);
        rMap.forEach((v, k) => next.set(k, { initiator: v.initiator, replied: v.replied }));
        return next;
      });
    }
    setLoadingMore(false);
  };

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConvo) return;
    const loadMessages = async () => {
      setMsgLoading(true);
      const { data } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("conversation_id", selectedConvo)
        .order("created_at", { ascending: true });

      if (data) setMessages(data);
      setMsgLoading(false);
    };
    loadMessages();
  }, [selectedConvo]);

  const getMemberName = (id: string) => members.get(id)?.name || id.slice(0, 8);
  const getMemberEmail = (id: string) => members.get(id)?.email || "";
  const getMemberThumb = (id: string) => members.get(id)?.image_thumb_url;

  const filteredConvos = conversations.filter((c) => {
    if (replyFilter !== "all") {
      const r = replyMap.get(c.id);
      const replied = !!r?.replied;
      if (replyFilter === "replied" && !replied) return false;
      if (replyFilter === "no_reply" && replied) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    const n1 = getMemberName(c.participant_1).toLowerCase();
    const n2 = getMemberName(c.participant_2).toLowerCase();
    const e1 = getMemberEmail(c.participant_1).toLowerCase();
    const e2 = getMemberEmail(c.participant_2).toLowerCase();
    return n1.includes(q) || n2.includes(q) || e1.includes(q) || e2.includes(q);
  });

  const selectedConvoData = conversations.find((c) => c.id === selectedConvo);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">DM Monitor</h1>
        <Badge variant="secondary">{conversations.length} conversations</Badge>
        {overallStats && overallStats.total > 0 && (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
            Response rate: {Math.round((overallStats.replied / overallStats.total) * 100)}%
            <span className="ml-1 opacity-70">({overallStats.replied}/{overallStats.total})</span>
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
        {/* Conversation list */}
        <div className="lg:col-span-1 border border-border rounded-lg bg-card flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 mt-2">
              {(["all", "replied", "no_reply"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={replyFilter === f ? "default" : "outline"}
                  className="h-7 text-xs flex-1"
                  onClick={() => setReplyFilter(f)}
                >
                  {f === "all" ? "All" : f === "replied" ? "Replied" : "No reply"}
                </Button>
              ))}
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Loading conversations...</div>
            ) : filteredConvos.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No conversations found</div>
            ) : (
              <div className="divide-y divide-border">
                {filteredConvos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConvo(c.id)}
                    className={`w-full text-left p-3 hover:bg-accent/50 transition-colors ${
                      selectedConvo === c.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {[c.participant_1, c.participant_2].map((pid) => {
                          const thumb = getMemberThumb(pid);
                          return thumb ? (
                            <img
                              key={pid}
                              src={thumb}
                              alt=""
                              className="h-8 w-8 rounded-full border-2 border-card object-cover"
                            />
                          ) : (
                            <div
                              key={pid}
                              className="h-8 w-8 rounded-full border-2 border-card bg-muted flex items-center justify-center"
                            >
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {getMemberName(c.participant_1)} ↔ {getMemberName(c.participant_2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.last_message_at
                            ? format(new Date(c.last_message_at), "MMM d, h:mm a")
                            : "No messages"}
                        </p>
                      </div>
                      {replyMap.get(c.id) && (
                        <Badge
                          variant="outline"
                          className={
                            replyMap.get(c.id)!.replied
                              ? "border-emerald-500/40 text-emerald-500 text-[10px] px-1.5 py-0"
                              : "border-amber-500/40 text-amber-500 text-[10px] px-1.5 py-0"
                          }
                        >
                          {replyMap.get(c.id)!.replied ? "Replied" : "No reply"}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
                {hasMore && !search && (
                  <div className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="w-full text-muted-foreground"
                    >
                      {loadingMore ? "Loading..." : "Load More"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Message viewer */}
        <div className="lg:col-span-2 border border-border rounded-lg bg-card flex flex-col">
          {!selectedConvo ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-3 border-b border-border flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSelectedConvo(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {selectedConvoData && (
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {getMemberName(selectedConvoData.participant_1)} ↔{" "}
                      {getMemberName(selectedConvoData.participant_2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getMemberEmail(selectedConvoData.participant_1)} •{" "}
                      {getMemberEmail(selectedConvoData.participant_2)}
                    </p>
                  </div>
                )}
                <Badge variant="outline">{messages.length} messages</Badge>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {msgLoading ? (
                  <div className="text-center text-muted-foreground">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground">No messages in this conversation</div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isP1 = selectedConvoData && msg.sender_id === selectedConvoData.participant_1;
                      return (
                        <div key={msg.id} className={`flex ${isP1 ? "justify-start" : "justify-end"}`}>
                          <div
                            className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                              isP1
                                ? "bg-muted text-foreground rounded-tl-sm"
                                : "bg-primary text-primary-foreground rounded-tr-sm"
                            }`}
                          >
                            <p className="text-xs font-semibold mb-1 opacity-70">
                              {getMemberName(msg.sender_id)}
                            </p>
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Clock className="h-3 w-3 opacity-50" />
                              <span className="text-[10px] opacity-50">
                                {format(new Date(msg.created_at), "MMM d, h:mm a")}
                              </span>
                              {msg.read_at && (
                                <span className="text-[10px] opacity-50">• Read</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDmMonitorPage;
