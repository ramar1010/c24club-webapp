import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { redeemReward } from "@/lib/chat-utils";

const CATEGORY_COLORS: Record<string, string> = {
  Fashion: "#EC4899",
  "Gift Cards": "#F59E0B",
  Tech: "#3B82F6",
  default: "#6B7280",
};

interface Category {
  id: string;
  name: string;
}

interface RewardItem {
  id: string;
  title: string;
  brief: string | null;
  image_url: string | null;
  minutes_cost: number;
  rarity: string | null;
  type: string | null;
  visible: boolean;
  reward_categories: { name: string } | null;
}

export default function RewardsScreen() {
  const { user, minutes, refreshProfile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const userMinutes = minutes?.total_minutes ?? 0;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: cats }, { data: rwds }] = await Promise.all([
        supabase
          .from("reward_categories")
          .select("id, name")
          .eq("status", "active")
          .order("name"),
        supabase
          .from("rewards")
          .select("*, reward_categories(name)")
          .eq("visible", true)
          .order("minutes_cost", { ascending: true }),
      ]);
      if (cats) setCategories(cats);
      if (rwds) setRewards(rwds as RewardItem[]);
    } catch (e) {
      console.error("Error fetching rewards:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (item: RewardItem) => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to redeem rewards.");
      return;
    }
    if (userMinutes < item.minutes_cost) {
      Alert.alert(
        "Not Enough Minutes",
        `You need ${item.minutes_cost} minutes but only have ${userMinutes}.`,
      );
      return;
    }

    setRedeeming(item.id);
    try {
      // Insert redemption record
      const { error: redeemError } = await redeemReward(user.id, {
        id: item.id,
        title: item.title,
        minutes_cost: item.minutes_cost,
        image_url: item.image_url,
        rarity: item.rarity ?? undefined,
        type: item.type ?? undefined,
      });

      if (redeemError) {
        Alert.alert("Error", redeemError.message || "Failed to redeem. Try again.");
        return;
      }

      // Deduct minutes using the atomic RPC (negative amount)
      const { error: minutesError } = await supabase.rpc("atomic_increment_minutes", {
        p_amount: -item.minutes_cost,
        p_user_id: user.id,
      });

      if (minutesError) {
        console.error("[rewards] minutes deduction error:", minutesError);
      }

      // Refresh profile to show updated balance
      await refreshProfile();

      Alert.alert(
        "Redeemed!",
        `"${item.title}" has been redeemed. Check your email for details.`,
      );
    } catch (e: unknown) {
      console.error("[rewards] handleRedeem error:", e);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setRedeeming(null);
    }
  };

  const filtered =
    activeCategory === "All"
      ? rewards
      : rewards.filter((r) => r.reward_categories?.name === activeCategory);

  const renderItem = ({ item }: { item: RewardItem }) => {
    const canRedeem = !!user && userMinutes >= item.minutes_cost;
    const catName = item.reward_categories?.name ?? "default";
    const placeholderColor =
      CATEGORY_COLORS[catName] ?? CATEGORY_COLORS.default;
    const isRedeeming = redeeming === item.id;

    return (
      <View style={styles.card}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.cardImage,
              {
                backgroundColor: placeholderColor,
                alignItems: "center",
                justifyContent: "flex-end",
                paddingBottom: 8,
              },
            ]}
          >
            <Text style={styles.categoryLabel}>{catName}</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.cardMins}>{item.minutes_cost} mins</Text>
          {item.rarity === "rare" || item.rarity === "legendary" ? (
            <Text style={styles.rarityBadge}>
              {item.rarity === "legendary" ? "Legendary" : "Rare"}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[
              styles.redeemButton,
              (!canRedeem || isRedeeming) && styles.redeemButtonDisabled,
            ]}
            disabled={!canRedeem || isRedeeming}
            onPress={() => handleRedeem(item)}
            activeOpacity={0.8}
          >
            {isRedeeming ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.redeemText,
                  !canRedeem && styles.redeemTextDisabled,
                ]}
              >
                {!user
                  ? "Sign In"
                  : canRedeem
                  ? "Redeem"
                  : "Not enough mins"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reward Store</Text>
        <Text style={styles.headerSubtitle}>
          You have{" "}
          <Text style={styles.minutesHighlight}>{userMinutes} minutes</Text>
        </Text>
      </View>

      {/* Category Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContainer}
        style={styles.pillsScroll}
      >
        {["All", ...categories.map((c) => c.name)].map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setActiveCategory(cat)}
            style={[
              styles.pill,
              activeCategory === cat ? styles.pillActive : styles.pillInactive,
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.pillText,
                activeCategory === cat
                  ? styles.pillTextActive
                  : styles.pillTextInactive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={styles.loadingText}>Loading rewards...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No rewards in this category</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.columnWrapper}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1A1A2E" },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  headerSubtitle: { fontSize: 15, color: "#A1A1AA", fontWeight: "500" },
  minutesHighlight: { color: "#FACC15", fontWeight: "700" },
  pillsScroll: { flexGrow: 0, marginBottom: 12 },
  pillsContainer: { paddingHorizontal: 20, gap: 8 },
  pill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 100 },
  pillActive: { backgroundColor: "#EF4444" },
  pillInactive: { backgroundColor: "#1E1E38" },
  pillText: { fontSize: 14, fontWeight: "700" },
  pillTextActive: { color: "#FFFFFF" },
  pillTextInactive: { color: "#71717A" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: "#A1A1AA", fontSize: 14 },
  emptyText: { color: "#71717A", fontSize: 15 },
  grid: { paddingHorizontal: 12, paddingBottom: 24 },
  columnWrapper: { justifyContent: "space-between" },
  card: {
    backgroundColor: "#1E1E38",
    borderRadius: 24,
    marginBottom: 12,
    overflow: "hidden",
    width: "48.5%",
  },
  cardImage: { width: "100%", height: 120 },
  categoryLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  cardBody: { padding: 12 },
  cardName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
    minHeight: 36,
  },
  cardMins: { fontSize: 12, color: "#FACC15", fontWeight: "600", marginBottom: 4 },
  rarityBadge: { fontSize: 11, color: "#FACC15", marginBottom: 6 },
  redeemButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 4,
  },
  redeemButtonDisabled: { backgroundColor: "#3F3F46" },
  redeemText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  redeemTextDisabled: { color: "#71717A" },
});