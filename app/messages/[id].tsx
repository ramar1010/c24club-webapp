import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  DollarSign,
  Gift,
  Send,
  Video,
} from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import {
  useConversationMessages,
  useSendMessage,
  type DmMessage,
} from "@/hooks/useMessages";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isOnline = (lastActive: string | null | undefined): boolean => {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000;
};

const formatMsgTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  message: DmMessage;
  isMine: boolean;
}

const MessageBubble = React.memo(function MessageBubble({
  message,
  isMine,
}: BubbleProps) {
  return (
    <View
      style={[
        styles.bubbleWrapper,
        isMine ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs,
          ]}
        >
          {message.content}
        </Text>
        <Text
          style={[
            styles.bubbleTime,
            isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs,
          ]}
        >
          {formatMsgTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatThreadScreen() {
  const router = useRouter();
  const { user, profile, minutes } = useAuth();
  const params = useLocalSearchParams<{
    id: string;
    partnerId: string;
    partnerName: string;
    partnerImage?: string;
  }>();

  const conversationId = params.id === "new" ? null : params.id;
  const partnerId = params.partnerId ?? "";
  const partnerName = params.partnerName ?? "User";
  const partnerImage = params.partnerImage ?? null;

  // Track the actual conversation id (may be set after first send)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId
  );

  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList<DmMessage>>(null);

  const gifted = minutes?.gifted_minutes ?? 0;

  const { data: messages, isLoading } = useConversationMessages(
    activeConversationId
  );
  const sendMessage = useSendMessage();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Determine if partner is online (we don't have their profile here, just use name for now)
  const partnerOnline = false; // We'd need to fetch partner's last_active_at separately

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || !user) return;

    setInputText("");

    try {
      const result = await sendMessage.mutateAsync({
        conversationId: activeConversationId ?? "new",
        partnerId,
        content,
      });

      // Update active conversation id if it was new
      if (!activeConversationId) {
        setActiveConversationId(result.conversationId);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Partner avatar */}
          <View style={styles.partnerAvatarContainer}>
            {partnerImage ? (
              <Image
                source={{ uri: partnerImage }}
                style={styles.partnerAvatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.partnerAvatarPlaceholder}>
                <Text style={styles.partnerAvatarInitial}>
                  {partnerName[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
            )}
            {partnerOnline && <View style={styles.partnerOnlineDot} />}
          </View>

          <Text style={styles.partnerName} numberOfLines={1}>
            {partnerName}
          </Text>

          <View style={styles.headerActions}>
            {gifted > 0 && (
              <TouchableOpacity style={styles.headerBtnGreen} activeOpacity={0.8}>
                <DollarSign size={14} color="#22C55E" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.headerBtnAmber} activeOpacity={0.8}>
              <Gift size={14} color="#FACC15" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtnGreen} activeOpacity={0.8}>
              <Video size={14} color="#22C55E" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Banners */}
        <View style={styles.bannerGift}>
          <Gift size={14} color="#D97706" />
          <Text style={styles.bannerGiftText}>
            Did you know? Users can send you cash gifts in DMs! Earned gifts can be cashed out via PayPal.
          </Text>
        </View>

        <View style={styles.bannerPrivacy}>
          <Text style={styles.bannerPrivacyText}>
            All video chats are encrypted and private — not even C24Club can see them. DM text messages are monitored. No solicitation for gifts.{" "}
            <Text style={styles.bannerPrivacyLink}>Rules</Text>
          </Text>
        </View>

        {/* Messages */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#EF4444" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isMine={item.sender_id === user?.id}
              />
            )}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#71717A"
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              !inputText.trim() && styles.sendBtnDisabled,
            ]}
            activeOpacity={0.8}
            onPress={handleSend}
            disabled={!inputText.trim() || sendMessage.isPending}
          >
            <Send size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#111111",
  },
  flex: {
    flex: 1,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  partnerAvatarContainer: {
    position: "relative",
  },
  partnerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  partnerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  partnerAvatarInitial: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
  },
  partnerOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    borderWidth: 1.5,
    borderColor: "#111111",
  },
  partnerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerBtnGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(34,197,94,0.2)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnAmber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(250,204,21,0.2)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Banners ────────────────────────────────────────────────────────────────
  bannerGift: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    margin: 12,
    marginBottom: 6,
    backgroundColor: "rgba(234,179,8,0.1)",
    borderWidth: 1,
    borderColor: "rgba(234,179,8,0.15)",
    borderRadius: 10,
    padding: 10,
  },
  bannerGiftText: {
    flex: 1,
    fontSize: 12,
    color: "rgba(250,204,21,0.8)",
    lineHeight: 17,
  },
  bannerPrivacy: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 10,
  },
  bannerPrivacyText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 16,
  },
  bannerPrivacyLink: {
    color: "#3B82F6",
    textDecorationLine: "underline",
  },

  // ── Messages ───────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleWrapper: {
    marginVertical: 3,
  },
  bubbleWrapperRight: {
    alignItems: "flex-end",
  },
  bubbleWrapperLeft: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleMine: {
    backgroundColor: "#2563EB",
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  bubbleTextMine: {
    color: "#FFFFFF",
  },
  bubbleTextTheirs: {
    color: "rgba(255,255,255,0.9)",
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 3,
  },
  bubbleTimeMine: {
    color: "rgba(191,219,254,0.6)",
    textAlign: "right",
  },
  bubbleTimeTheirs: {
    color: "rgba(255,255,255,0.25)",
  },

  // ── Input Bar ─────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 12 : 10,
    backgroundColor: "#1A1A1A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 22,
    paddingHorizontal: 16,
    color: "#FFFFFF",
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});