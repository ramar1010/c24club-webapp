import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  useConversations,
  useConversationMessages,
  useSendMessage,
  type Conversation,
} from "@/hooks/useMessages";
import { useIsMobile } from "@/hooks/use-mobile";

const MessagesPage = ({ onClose }: { onClose?: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toUserId = searchParams.get("to");

  const { data: conversations = [], isLoading: loadingConvos } = useConversations();
  const { data: messages = [], isLoading: loadingMessages } = useConversationMessages(
    selectedConvo?.id || null
  );
  const sendMessage = useSendMessage();

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
        .select("id, name, image_url, gender")
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

  const handleSend = () => {
    if (!messageText.trim() || !selectedConvo) return;
    const otherId = selectedConvo.other_user?.id;
    if (!otherId) return;

    sendMessage.mutate(
      {
        recipientId: otherId,
        content: messageText.trim(),
        conversationId: selectedConvo.id,
      },
      { onSuccess: () => setMessageText("") }
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

  const showList = !selectedConvo || !isMobile;
  const showThread = !!selectedConvo;

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-neutral-900 border-b border-white/10 shrink-0">
        <button onClick={handleBack} className="text-white/70 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg">
          {selectedConvo && isMobile
            ? selectedConvo.other_user?.name || "Chat"
            : "Messages"}
        </h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation List */}
        {showList && (
          <div
            className={`${
              isMobile ? "w-full" : "w-80 border-r border-white/10"
            } flex flex-col overflow-y-auto`}
          >
            {loadingConvos ? (
              <div className="flex items-center justify-center py-20 text-white/40">
                Loading...
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <MessageCircle className="w-12 h-12 text-white/20 mb-3" />
                <p className="text-white/40 text-sm">No messages yet</p>
                <p className="text-white/25 text-xs mt-1">
                  Message someone from Discover to start chatting
                </p>
              </div>
            ) : (
              conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelectedConvo(convo)}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${
                    selectedConvo?.id === convo.id ? "bg-white/10" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden shrink-0">
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

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm truncate">
                        {convo.other_user?.name || "Unknown"}
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
              ))
            )}
          </div>
        )}

        {/* Chat Thread */}
        {showThread && (
          <div className={`flex flex-col flex-1 ${isMobile ? "w-full" : ""}`}>
            {/* Desktop header for selected convo */}
            {!isMobile && selectedConvo && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-neutral-900/50 border-b border-white/10">
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
                <span className="font-semibold text-sm">
                  {selectedConvo.other_user?.name}
                </span>
              </div>
            )}

            {/* Messages */}
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

            {/* Input */}
            <div className="px-3 py-2 bg-neutral-900 border-t border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
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
    </div>
  );
};

export default MessagesPage;
