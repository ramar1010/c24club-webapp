import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, DollarSign, MessageCircle, Search } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, type Conversation } from "@/hooks/useMessages";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTimeAgo = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

const isOnline = (lastActive: string | null | undefined): boolean => {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000;
};

// ─── Conversation Row ─────────────────────────────────────────────────────────

interface ConversationRowProps {
  item: Conversation;
  onPress: () => void;
}

const ConversationRow = React.memo(function ConversationRow({
  item,
  onPress,
}: ConversationRowProps) {
  const online = isOnline(item.other_user?.last_active_at);
  const initial = item.other_user?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {item.other_user?.image_url ? (
          <Image
            source={{ uri: item.other_user.image_url }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        {online && <View style={styles.onlineDot} />}
      </View>

      {/* Info */}
      <View style={styles.rowInfo}>
        <View style={styles.rowTopRow}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.other_user?.name ?? "Unknown"}
          </Text>
          <Text style={styles.rowTime}>
            {getTimeAgo(item.last_message_at)}
          </Text>
        </View>
        <View style={styles.rowBottomRow}>
          <Text style={styles.rowPreview} numberOfLines={1}>
            {item.last_message ?? "No messages yet"}
          </Text>
          {(item.unread_count ?? 0) > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const router = useRouter();
  const { minutes } = useAuth();
  const { data: conversations, isLoading } = useConversations();
  const [search, setSearch] = useState("");

  const gifted = minutes?.gifted_minutes ?? 0;

  const filtered = useMemo(() => {
    if (!conversations) return [];
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      c.other_user?.name?.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        {gifted > 0 && (
          <TouchableOpacity style={styles.cashOutBtn} activeOpacity={0.8}>
            <DollarSign size={14} color="#22C55E" />
            <Text style={styles.cashOutText}>Cash Out</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={16} color="#71717A" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations..."
          placeholderTextColor="#71717A"
        />
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#EF4444" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              onPress={() =>
                router.push({
                  pathname: "/messages/[id]",
                  params: {
                    id: item.id,
                    partnerId: item.other_user?.id ?? "",
                    partnerName: item.other_user?.name ?? "",
                    partnerImage: item.other_user?.image_url ?? "",
                  },
                })
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <MessageCircle size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>
                Message someone from Discover to start chatting
              </Text>
            </View>
          }
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyContent : undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#111111",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyContent: {
    flex: 1,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cashOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34,197,94,0.2)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cashOutText: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    height: 44,
  },

  // ── Conversation Row ───────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    gap: 12,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#111111",
  },
  rowInfo: {
    flex: 1,
  },
  rowTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  rowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginRight: 8,
  },
  rowTime: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
  },
  rowBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowPreview: {
    flex: 1,
    fontSize: 12,
    color: "#A1A1AA",
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: "#3B82F6",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  // ── Empty ──────────────────────────────────────────────────────────────────
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#A1A1AA",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#71717A",
    textAlign: "center",
  },
});