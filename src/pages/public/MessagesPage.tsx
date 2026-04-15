import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, MessageCircle, Video, X, Mail, Heart, Gift, DollarSign, Lock, Crown, Sparkles, Shield, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useConversations,
  useConversationMessages,
  useSendMessage,
  type Conversation,
} from "@/hooks/useMessages";
import { useIsMobile } from "@/hooks/use-mobile";
import { isOnlineNow, getTimeAgo } from "@/hooks/useDiscover";
import DirectCallModal from "@/components/discover/DirectCallModal";
import SendGiftOverlay from "@/components/videocall/SendGiftOverlay";
import CashoutModal from "@/components/discover/CashoutModal";
import VipCallGate, { shouldBlockCall } from "@/components/discover/VipCallGate";
import DmPaywall from "@/components/discover/DmPaywall";
import { useVipStatus } from "@/hooks/useVipStatus";
import PinnedSocialsDisplay from "@/components/videocall/PinnedSocialsDisplay";
import { toast } from "sonner";

/* ─── Role badge component matching Discover style ─── */
const RoleBadge = ({ role }: { role: "owner" | "vip" | "mod" }) => {
  if (role === "owner")
    return (
      <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
        <Crown className="w-2.5 h-2.5" /> Owner
      </span>
    );
  if (role === "vip")
    return (
      <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
        <Sparkles className="w-2.5 h-2.5" /> VIP
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
      <Shield className="w-2.5 h-2.5" /> Mod
    </span>
  );
};

const MessagesPage = ({ onClose, initialPartnerId }: { onClose?: () => void; initialPartnerId?: string }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Redirect unauthenticated users to home with returnTo param
  useEffect(() => {
    if (!loading && !user) {
      navigate("/?returnTo=/messages", { replace: true });
    }
  }, [loading, user, navigate]);
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const CONVOS_PER_PAGE = 20;
  const [visibleCount, setVisibleCount] = useState(CONVOS_PER_PAGE);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toUserId = initialPartnerId || searchParams.get("to");
  const [profileCard, setProfileCard] = useState<Conversation["other_user"] | null>(null);
  const [profileSocials, setProfileSocials] = useState<string[]>([]);

  // Direct call state
  const [activeCall, setActiveCall] = useState<{
    inviteId: string;
    partnerId: string;
    partnerName: string;
    isInitiator: boolean;
  } | null>(null);
  const [startingCall, setStartingCall] = useState(false);
  const [showGiftOverlay, setShowGiftOverlay] = useState(false);
  const [showCashout, setShowCashout] = useState(false);
  const [showVipGate, setShowVipGate] = useState(false);
  const [showDmPaywall, setShowDmPaywall] = useState(false);

  const { vipTier, startCheckout } = useVipStatus(user?.id ?? null);

  const { data: minutesData, refetch: refetchMinutes } = useQuery({
    queryKey: ["cashout-minutes-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("member_minutes")
        .select("total_minutes, gifted_minutes")
        .eq("user_id", user!.id)
        .single();
      return data || { total_minutes: 0, gifted_minutes: 0 };
    },
  });

  // Fetch current user's gender
  const { data: myGender } = useQuery({
    queryKey: ["my-gender-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("gender")
        .eq("id", user!.id)
        .maybeSingle();
      return data?.gender?.toLowerCase() || null;
    },
  });
  const { data: conversations = [], isLoading: loadingConvos } = useConversations();
  const { data: messages = [], isLoading: loadingMessages } = useConversationMessages(
    selectedConvo?.id || null
  );
  const sendMessage = useSendMessage();

  // Fetch roles & VIP status for all conversation partners
  const otherUserIds = useMemo(
    () => conversations.map((c) => c.other_user?.id).filter(Boolean) as string[],
    [conversations]
  );

  const { data: userBadges = {} } = useQuery({
    queryKey: ["dm-user-badges", otherUserIds],
    enabled: otherUserIds.length > 0,
    queryFn: async () => {
      const badges: Record<string, "owner" | "vip" | "mod" | null> = {};

      // Fetch roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", otherUserIds);

      const roleMap = new Map<string, Set<string>>();
      (roles || []).forEach((r: any) => {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, new Set());
        roleMap.get(r.user_id)!.add(r.role);
      });

      // Fetch VIP status using security definer function (member_minutes is restricted to own row)
      const { data: vipIds } = await supabase.rpc("get_vip_user_ids");
      const vipSet = new Set((vipIds || []).map((v: any) => v));

      for (const uid of otherUserIds) {
        const userRoles = roleMap.get(uid);
        if (userRoles?.has("admin")) badges[uid] = "owner";
        else if (vipSet.has(uid)) badges[uid] = "vip";
        else if (userRoles?.has("moderator")) badges[uid] = "mod";
        else badges[uid] = null;
      }
      return badges;
    },
  });


  const otherUserId = selectedConvo?.other_user?.id || null;
  const { data: giftedFromUser = 0 } = useQuery({
    queryKey: ["gifted_from_user", user?.id, otherUserId],
    enabled: !!user && !!otherUserId,
    queryFn: async () => {
      if (!user || !otherUserId) return 0;
      const { data } = await supabase
        .from("gift_transactions")
        .select("minutes_amount")
        .eq("sender_id", otherUserId)
        .eq("recipient_id", user.id)
        .eq("status", "completed");
      if (!data || data.length === 0) return 0;
      return data.reduce((sum, row) => sum + (row.minutes_amount || 0), 0);
    },
  });

  // Fetch socials when profile card opens
  useEffect(() => {
    if (!profileCard?.id) { setProfileSocials([]); return; }
    supabase
      .from("vip_settings")
      .select("pinned_socials")
      .eq("user_id", profileCard.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfileSocials(data?.pinned_socials || []);
      });
  }, [profileCard?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle ?to= query param to open/create conversation with a specific user
  useEffect(() => {
    if (!toUserId || !user || loadingConvos) return;

    // Check if we already have a conversation with this user
    const existing = conversations.find(
      (c) => c.other_user?.id === toUserId
    );
    if (existing) {
      setSelectedConvo(existing);
      return;
    }

    // Create a placeholder conversation for the UI (will be created on first message send)
    const loadNewConvo = async () => {
      const { data: member } = await supabase
        .from("members")
        .select("id, name, image_url, gender, last_active_at")
        .eq("id", toUserId)
        .single();

      if (member) {
        setSelectedConvo({
          id: "",  // Empty = new conversation
          participant_1: user.id,
          participant_2: toUserId,
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          other_user: member,
          last_message: "",
          unread_count: 0,
        });
      }
    };
    loadNewConvo();
  }, [toUserId, user, conversations, loadingConvos]);

  const handleStartCall = async () => {
    if (!user || !selectedConvo?.other_user?.id || startingCall) return;
    const partnerId = selectedConvo.other_user.id;
    const partnerGender = selectedConvo.other_user.gender ?? null;

    // Block non-premium males from calling females
    if (shouldBlockCall(myGender ?? null, partnerGender, vipTier)) {
      setShowVipGate(true);
      return;
    }

    setStartingCall(true);

    try {
      const { data, error } = await supabase
        .from("direct_call_invites")
        .insert({
          inviter_id: user.id,
          invitee_id: partnerId,
        })
        .select("id")
        .single();

      if (error) throw error;

      setActiveCall({
        inviteId: data.id,
        partnerId,
        partnerName: selectedConvo.other_user.name || "User",
        isInitiator: true,
      });
    } catch (err: any) {
      toast.error("Failed to start call", { description: err.message });
    } finally {
      setStartingCall(false);
    }
  };

  // DM paywall: GLOBAL limit — 3 total messages to ANY female, then must upgrade
  const DM_FREE_LIMIT = 3;
  const partnerGender = selectedConvo?.other_user?.gender?.toLowerCase() ?? null;
  const isMaleToFemale = myGender === "male" && partnerGender === "female";
  const hasBasicVip = vipTier === "basic" || vipTier === "premium";

  // Global count: all DMs this male user sent to any female partner
  const { data: globalMaleDmCount = 0 } = useQuery({
    queryKey: ["global-male-dm-count", user?.id, myGender],
    enabled: !!user && myGender === "male" && !hasBasicVip,
    staleTime: 10_000,
    queryFn: async () => {
      if (!user) return 0;
      // Get all conversations where user is a participant
      const { data: convos } = await supabase
        .from("conversations")
        .select("id, participant_1, participant_2")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);
      if (!convos || convos.length === 0) return 0;

      // Find partner IDs
      const partnerIds = convos.map((c: any) =>
        c.participant_1 === user.id ? c.participant_2 : c.participant_1
      );

      // Get female partners
      const { data: femalePartners } = await supabase
        .from("members")
        .select("id")
        .in("id", partnerIds)
        .ilike("gender", "female");

      if (!femalePartners || femalePartners.length === 0) return 0;

      // Get conversation IDs with female partners
      const femaleIds = new Set(femalePartners.map((f: any) => f.id));
      const femaleConvoIds = convos
        .filter((c: any) => {
          const partnerId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;
          return femaleIds.has(partnerId);
        })
        .map((c: any) => c.id);

      if (femaleConvoIds.length === 0) return 0;

      // Count all messages sent by this user in those conversations
      const { count } = await supabase
        .from("dm_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", femaleConvoIds)
        .eq("sender_id", user.id);

      return count || 0;
    },
  });

  const dmBlocked = isMaleToFemale && !hasBasicVip && globalMaleDmCount >= DM_FREE_LIMIT;
  const freeLeft = Math.max(0, DM_FREE_LIMIT - globalMaleDmCount);

  // Female-side: detect if male partner is likely blocked
  const isFemaleFromMale = myGender === "female" && selectedConvo?.other_user?.gender?.toLowerCase() === "male";

  const handleSend = () => {
    if (!messageText.trim() || !selectedConvo) return;
    const otherId = selectedConvo.other_user?.id;
    if (!otherId) return;

    // Block if limit reached
    if (dmBlocked) {
      setShowDmPaywall(true);
      return;
    }

    sendMessage.mutate(
      {
        recipientId: otherId,
        content: messageText.trim(),
        conversationId: selectedConvo.id || undefined,
      },
      {
        onSuccess: (convoId) => {
          setMessageText("");
          // Refresh global DM count for paywall
          queryClient.invalidateQueries({ queryKey: ["global-male-dm-count"] });
          if (!selectedConvo.id && convoId) {
            setSelectedConvo((prev) => prev ? { ...prev, id: convoId } : prev);
          }
        },
      }
    );
  };

  const handleBack = () => {
    if (selectedConvo) {
      setSelectedConvo(null);
    } else if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString();
  };

  const OWNER_ID = "6f8bb0e2-a36a-4bc0-920f-312c340f7921";

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) =>
        c.other_user?.name?.toLowerCase().includes(q)
      );
    }
    // Pin owner conversation to the top
    const ownerConvo = list.find((c) => c.other_user?.id === OWNER_ID);
    const rest = list.filter((c) => c.other_user?.id !== OWNER_ID);
    return ownerConvo ? [ownerConvo, ...rest] : rest;
  }, [conversations, searchQuery]);

  const paginatedConversations = useMemo(
    () => filteredConversations.slice(0, visibleCount),
    [filteredConversations, visibleCount]
  );
  const hasMore = filteredConversations.length > visibleCount;

  const showList = !selectedConvo || !isMobile;
  const showThread = !!selectedConvo;

  return (
    <div className="flex flex-col h-screen max-h-screen bg-neutral-950 text-white overflow-hidden">
      {/* Active call overlay */}
      {activeCall && user && (
        <DirectCallModal
          myUserId={user.id}
          partnerId={activeCall.partnerId}
          partnerName={activeCall.partnerName}
          inviteId={activeCall.inviteId}
          isInitiator={activeCall.isInitiator}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-neutral-900 border-b border-white/10 shrink-0">
        <button onClick={handleBack} className="text-white/70 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {selectedConvo && isMobile && (
          <div
            className="relative cursor-pointer"
            onClick={() => selectedConvo.other_user && setProfileCard(selectedConvo.other_user)}
          >
            <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
              {selectedConvo.other_user?.image_url ? (
                <img src={selectedConvo.other_user.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30 font-bold text-xs">
                  {selectedConvo.other_user?.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
            </div>
            {selectedConvo.other_user?.last_active_at && isOnlineNow(selectedConvo.other_user.last_active_at) && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-neutral-900 rounded-full" />
            )}
          </div>
        )}
        <h1 className="font-bold text-lg flex-1 flex items-center gap-2">
          {selectedConvo && isMobile ? (
            <>
              {selectedConvo.other_user?.name || "Chat"}
              {selectedConvo.other_user?.id && userBadges[selectedConvo.other_user.id] && (
                <RoleBadge role={userBadges[selectedConvo.other_user.id]!} />
              )}
            </>
          ) : "Messages"}
        </h1>
        {/* Cash Out button - show when not in a convo thread */}
        {!selectedConvo && (minutesData?.gifted_minutes ?? 0) > 0 && (
          <button
            onClick={() => setShowCashout(true)}
            className="flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-semibold px-3 py-2 rounded-lg transition-colors border border-emerald-500/30"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Cash Out
          </button>
        )}
        {/* Video call button in mobile header */}
        {selectedConvo && isMobile && (
          <>
            {(minutesData?.gifted_minutes ?? 0) > 0 && (
              <button
                onClick={() => setShowCashout(true)}
                className="w-9 h-9 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center transition-colors"
                title="Cash Out"
              >
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </button>
            )}
            <button
              onClick={() => setShowGiftOverlay(true)}
              className="w-9 h-9 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 flex items-center justify-center transition-colors"
            >
              <Gift className="w-4 h-4 text-yellow-400" />
            </button>
            <button
              onClick={handleStartCall}
              disabled={startingCall}
              className="w-9 h-9 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <Video className="w-4.5 h-4.5 text-emerald-400" />
            </button>
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation List */}
        {showList && (
          <div
            className={`${
              isMobile ? "w-full" : "w-80 border-r border-white/10"
            } flex flex-col overflow-hidden`}
          >
            {/* Search bar */}
            <div className="px-3 py-2 border-b border-white/10 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleCount(CONVOS_PER_PAGE);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
            {loadingConvos ? (
              <div className="flex items-center justify-center py-20 text-white/40">
                Loading...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <MessageCircle className="w-12 h-12 text-white/20 mb-3" />
                <p className="text-white/40 text-sm">{searchQuery ? "No matches found" : "No messages yet"}</p>
                <p className="text-white/25 text-xs mt-1">
                  {searchQuery ? "Try a different search" : "Message someone from Discover to start chatting"}
                </p>
              </div>
            ) : (
              <>
              {paginatedConversations.map((convo, index) => (
                <div key={convo.id}>
                  {/* Female VIP promo banner after 3rd contact */}
                  {index === 3 && myGender === "female" && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const { VIP_TIERS } = await import("@/config/vip-tiers");
                        void startCheckout(VIP_TIERS.basic.price_id);
                      }}
                      className="mx-3 my-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 shadow-lg shadow-pink-500/20 text-left w-[calc(100%-1.5rem)] cursor-pointer hover:brightness-110 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">👑</span>
                        <p className="text-white text-[11px] font-bold leading-snug">
                          Get noticed & gifted by thousands of guys — stay at the top of the Discover page with{" "}
                          <span className="text-yellow-200 underline underline-offset-2">VIP starting at $2.49/week!</span>
                        </p>
                        <Sparkles className="w-4 h-4 text-yellow-200 shrink-0" />
                      </div>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedConvo(convo)}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left w-full ${
                      selectedConvo?.id === convo.id ? "bg-white/10" : ""
                    }`}
                  >
                    {/* Avatar with online dot */}
                    <div
                      className="relative shrink-0 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (convo.other_user) setProfileCard(convo.other_user);
                      }}
                    >
                      <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden">
                        {convo.other_user?.image_url ? (
                          <img
                            src={convo.other_user.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/30 font-bold text-lg">
                            {convo.other_user?.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                        )}
                      </div>
                      {convo.other_user?.last_active_at && isOnlineNow(convo.other_user.last_active_at) && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-neutral-950 rounded-full" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-1">
                        <span className="font-semibold text-sm truncate flex items-center gap-1.5">
                          {convo.other_user?.name || "Unknown"}
                          {convo.other_user?.id && userBadges[convo.other_user.id] && (
                            <RoleBadge role={userBadges[convo.other_user.id]!} />
                          )}
                        </span>
                        <span className="text-[10px] text-white/30 shrink-0 ml-2">
                          {formatTime(convo.last_message_at)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <p className="text-xs text-white/40 truncate">
                          {convo.last_message || "Start chatting..."}
                        </p>
                        {(convo.unread_count || 0) > 0 && (
                          <span className="bg-blue-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-2">
                            {convo.unread_count! > 9 ? "9+" : convo.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              ))}
              {hasMore && (
                <button
                  onClick={() => setVisibleCount((v) => v + CONVOS_PER_PAGE)}
                  className="w-full py-3 text-sm text-blue-400 hover:text-blue-300 hover:bg-white/5 transition-colors font-medium"
                >
                  Load More ({filteredConversations.length - visibleCount} remaining)
                </button>
              )}
              </>
            )}
            </div>
          </div>
        )}

        {/* Chat Thread */}
        {showThread && (
          <div className={`flex flex-col flex-1 ${isMobile ? "w-full" : ""}`}>
            {/* Desktop header for selected convo */}
            {!isMobile && selectedConvo && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-neutral-900/50 border-b border-white/10">
                <div
                  className="relative cursor-pointer"
                  onClick={() => selectedConvo.other_user && setProfileCard(selectedConvo.other_user)}
                >
                  <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                    {selectedConvo.other_user?.image_url ? (
                      <img
                        src={selectedConvo.other_user.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30 font-bold text-sm">
                        {selectedConvo.other_user?.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  {selectedConvo.other_user?.last_active_at && isOnlineNow(selectedConvo.other_user.last_active_at) && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-neutral-900 rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm flex items-center gap-1.5">
                    {selectedConvo.other_user?.name}
                    {selectedConvo.other_user?.id && userBadges[selectedConvo.other_user.id] && (
                      <RoleBadge role={userBadges[selectedConvo.other_user.id]!} />
                    )}
                  </span>
                  <p className="text-[10px] text-white/40">
                    {selectedConvo.other_user?.last_active_at && isOnlineNow(selectedConvo.other_user.last_active_at)
                      ? "Online now"
                      : selectedConvo.other_user?.last_active_at
                        ? getTimeAgo(selectedConvo.other_user.last_active_at)
                        : ""}
                  </p>
                </div>
                {/* Gift button in desktop header */}
                <button
                  onClick={() => setShowGiftOverlay(true)}
                  className="w-8 h-8 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 flex items-center justify-center transition-colors"
                  title="Send gift"
                >
                  <Gift className="w-4 h-4 text-yellow-400" />
                </button>
                {/* Video call button in desktop header */}
                <button
                  onClick={handleStartCall}
                  disabled={startingCall}
                  className="w-8 h-8 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center transition-colors disabled:opacity-40"
                  title="Start video call"
                >
                  <Video className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            )}

            {/* Gifted minutes banner */}
            {giftedFromUser > 0 ? (
              <div className="mx-4 mt-3 mb-1 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-300">
                    <span className="font-bold">{giftedFromUser}</span> mins earned from {selectedConvo?.other_user?.name || "this user"}
                  </span>
                </div>
                <button
                  onClick={() => navigate("/my-rewards")}
                  className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <DollarSign className="w-3 h-3" />
                  Cash Out
                </button>
              </div>
            ) : myGender === "female" && selectedConvo?.other_user?.gender?.toLowerCase() === "male" ? (
              <div className="mx-4 mt-3 mb-1 flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 rounded-xl px-4 py-2.5">
                <Video className="w-4 h-4 text-pink-400 shrink-0" />
                <span className="text-xs text-pink-300/90 flex-1">
                  💡 Start a <strong>private video call</strong> — gifts received in private calls give you a <strong className="text-pink-300">20% bonus</strong>!
                </span>
                <button
                  onClick={handleStartCall}
                  disabled={startingCall}
                  className="shrink-0 bg-pink-500 hover:bg-pink-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  Call Now
                </button>
              </div>
            ) : (
              <div className="mx-4 mt-3 mb-1 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/15 rounded-xl px-4 py-2.5">
                <Gift className="w-4 h-4 text-yellow-400 shrink-0" />
                <span className="text-xs text-yellow-300/80">
                  💡 Did you know? Users can send you cash gifts in DMs! Earned gifts can be cashed out via PayPal.
                </span>
              </div>
            )}

            {/* Privacy & monitoring notice */}
            <div className="mx-4 mt-2 mb-1 flex items-start gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
              <span className="text-[11px] text-white/40 leading-relaxed">
                🔒 All video chats are encrypted and private — not even C24Club can see them. DM text messages are monitored. No solicitation for gifts.{" "}
                <button onClick={() => navigate("/rules")} className="text-white/60 underline hover:text-white/80">Rules</button>
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-20 text-white/40">
                  Loading...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-20 text-white/30 text-sm">
                  Say hello! 👋
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                          isMine
                            ? "bg-blue-600 text-white rounded-br-md"
                            : "bg-white/10 text-white/90 rounded-bl-md"
                        }`}
                      >
                        <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            isMine ? "text-blue-200/60" : "text-white/25"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Female-side notice: male partner may have hit DM limit */}
            {isFemaleFromMale && (() => {
              const partnerSentCount = messages.filter((m) => m.sender_id === selectedConvo?.other_user?.id).length;
              const partnerLastMsg = messages.filter((m) => m.sender_id === selectedConvo?.other_user?.id).at(-1);
              const myLastMsg = messages.filter((m) => m.sender_id === user?.id).at(-1);
              // Show notice if partner sent exactly 3 msgs and hasn't replied after our last message
              const partnerStopped = partnerSentCount >= 3 && myLastMsg && (!partnerLastMsg || new Date(partnerLastMsg.created_at) < new Date(myLastMsg.created_at));
              if (!partnerStopped) return null;
              return (
                <div className="mx-3 mb-1 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-300/90">
                    {selectedConvo?.other_user?.name} may have reached their free message limit. They'll need to subscribe to VIP to continue chatting with you.
                  </span>
                </div>
              );
            })()}

            {/* Input or DM paywall */}
            {dmBlocked ? (
              <div className="px-3 py-3 bg-neutral-900 border-t border-white/10 shrink-0">
                <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                  <Lock className="w-5 h-5 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-semibold">Free messages used up</p>
                    <p className="text-xs text-white/50">Subscribe to Basic VIP to send unlimited messages</p>
                  </div>
                  <button
                    onClick={() => setShowDmPaywall(true)}
                    className="shrink-0 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:from-blue-400 hover:to-cyan-400 transition-all"
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-3 py-2 bg-neutral-900 border-t border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value.slice(0, 500))}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder={isMaleToFemale && !hasBasicVip ? `Type a message... (${freeLeft} free left)` : "Type a message..."}
                    className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                    maxLength={500}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!messageText.trim() || sendMessage.isPending}
                    className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state for desktop when no convo selected */}
        {!isMobile && !selectedConvo && (
          <div className="flex-1 flex items-center justify-center text-white/20">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* Profile Card Modal */}
      {profileCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setProfileCard(null)}
        >
          <div
            className="relative w-80 max-w-[90vw] bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setProfileCard(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Photo */}
            <div className="aspect-square bg-white/5 overflow-hidden">
              {profileCard.image_url ? (
                <img
                  src={profileCard.image_url}
                  alt={profileCard.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 text-6xl font-bold">
                  {profileCard.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-white">{profileCard.name}</h3>
                  {profileCard.last_active_at && isOnlineNow(profileCard.last_active_at) && (
                    <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Online
                    </span>
                  )}
                </div>
                <p className="text-white/40 text-xs mt-0.5">
                  {profileCard.gender && <span className="capitalize">{profileCard.gender}</span>}
                  {profileCard.last_active_at && !isOnlineNow(profileCard.last_active_at) && (
                    <span> · Last seen {getTimeAgo(profileCard.last_active_at)}</span>
                  )}
                </p>
              </div>

              {/* Socials */}
              {profileSocials.length > 0 && (
                <PinnedSocialsDisplay pinnedSocials={profileSocials} />
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setProfileCard(null);
                    navigate(`/messages?to=${profileCard.id}`);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Message
                </button>
                <button
                  onClick={() => {
                    setProfileCard(null);
                    if (selectedConvo?.other_user?.id === profileCard.id) {
                      handleStartCall();
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <Video className="w-4 h-4" />
                  Video Call
                </button>
              </div>
              <button
                onClick={() => {
                  setProfileCard(null);
                  navigate(`/discover`);
                }}
                className="w-full text-center text-white/40 hover:text-white/60 text-xs py-1 transition-colors"
              >
                View on Discover →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Gift Overlay */}
      {showGiftOverlay && selectedConvo?.other_user?.id && (
        <SendGiftOverlay
          recipientId={selectedConvo.other_user.id}
          onClose={() => setShowGiftOverlay(false)}
        />
      )}

      {/* Cashout Modal */}
      {showCashout && (
        <CashoutModal
          onClose={() => setShowCashout(false)}
          currentMinutes={minutesData?.total_minutes ?? 0}
          giftedMinutes={minutesData?.gifted_minutes ?? 0}
          onSuccess={() => refetchMinutes()}
        />
      )}

      {/* VIP call gate modal */}
      {showVipGate && (
        <VipCallGate
          onClose={() => setShowVipGate(false)}
          onSubscribe={async () => {
            setShowVipGate(false);
            const { VIP_TIERS } = await import("@/config/vip-tiers");
            void startCheckout(VIP_TIERS.premium.price_id);
          }}
        />
      )}

      {/* DM paywall modal */}
      {showDmPaywall && selectedConvo?.other_user && (
        <DmPaywall
          partnerName={selectedConvo.other_user.name || "this user"}
          onClose={() => setShowDmPaywall(false)}
          onSubscribe={async () => {
            setShowDmPaywall(false);
            const { VIP_TIERS } = await import("@/config/vip-tiers");
            void startCheckout(VIP_TIERS.basic.price_id);
          }}
        />
      )}
    </div>
  );
};

export default MessagesPage;
