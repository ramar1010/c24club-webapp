import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Compass,
  Heart,
  Lock,
  MapPin,
  Star,
  User,
  X,
} from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { flattenStyle } from "@/utils/flatten-style";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface DiscoverMember {
  id: string;
  name: string;
  bio: string | null;
  gender: string | null;
  image_url: string | null;
  image_thumb_url: string | null;
  title: string | null;
  profession: string | null;
  city: string | null;
  country: string | null;
  birthdate: string | null;
  membership: string | null;
  last_active_at: string | null;
}

function calcAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  return Math.floor(
    (Date.now() - new Date(birthdate).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000)
  );
}

function getGenderColor(gender: string | null): string {
  if (gender === "female") return "#EC4899";
  if (gender === "male") return "#3B82F6";
  return "#8B5CF6";
}

function formatLastActive(lastActiveAt: string | null): string | null {
  if (!lastActiveAt) return null;
  const diff = Date.now() - new Date(lastActiveAt).getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours > 24) return null;
  if (hours < 1) {
    const mins = Math.floor(diff / (1000 * 60));
    return `Active ${mins}m ago`;
  }
  return `Active ${Math.floor(hours)}h ago`;
}

export default function DiscoverScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [members, setMembers] = useState<DiscoverMember[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Icebreaker panel
  const [icebreakerVisible, setIcebreakerVisible] = useState(false);
  const [icebreakerMessage, setIcebreakerMessage] = useState("");
  const [pendingProfile, setPendingProfile] = useState<DiscoverMember | null>(null);

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Card animation
  const translateX = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  const fetchMembers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch existing interests to exclude already-seen profiles
      const { data: interests } = await supabase
        .from("member_interests")
        .select("interested_in_user_id")
        .eq("user_id", user.id);

      const excludedIds = new Set<string>(
        (interests ?? []).map((i: { interested_in_user_id: string }) => i.interested_in_user_id)
      );

      const { data: memberData } = await supabase
        .from("members")
        .select(
          "id, name, bio, gender, image_url, image_thumb_url, title, profession, city, country, birthdate, membership, last_active_at"
        )
        .eq("is_discoverable", true)
        .eq("is_test_account", false)
        .neq("id", user.id)
        .limit(20);

      const filtered = (memberData ?? []).filter(
        (m: DiscoverMember) => !excludedIds.has(m.id)
      );

      setMembers(filtered);
      setCurrentIndex(0);

      // Reset animation
      translateX.setValue(0);
      cardOpacity.setValue(1);
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setLoading(false);
    }
  }, [user, translateX, cardOpacity]);

  useEffect(() => {
    if (user) {
      fetchMembers();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, fetchMembers]);

  const showToast = useCallback(() => {
    setToastVisible(true);
    toastOpacity.setValue(1);
    Animated.sequence([
      Animated.delay(1500),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => setToastVisible(false));
  }, [toastOpacity]);

  const advanceCard = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -SCREEN_WIDTH * 1.2,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentIndex((prev) => prev + 1);
      translateX.setValue(0);
      cardOpacity.setValue(1);
    });
  }, [translateX, cardOpacity]);

  const handleSkip = useCallback(async () => {
    if (!user || currentIndex >= members.length) return;
    const profile = members[currentIndex];
    // Log view
    supabase
      .from("discover_profile_views")
      .insert({ viewer_id: user.id, viewed_member_id: profile.id })
      .then(() => {});
    advanceCard();
  }, [user, currentIndex, members, advanceCard]);

  const handleInterested = useCallback((profile: DiscoverMember) => {
    setPendingProfile(profile);
    setIcebreakerMessage("");
    setIcebreakerVisible(true);
  }, []);

  const handleSendInterest = useCallback(async () => {
    if (!user || !pendingProfile) return;
    setIcebreakerVisible(false);
    try {
      await supabase.from("member_interests").insert({
        user_id: user.id,
        interested_in_user_id: pendingProfile.id,
        icebreaker_message: icebreakerMessage.trim() || null,
      });
      showToast();
    } catch (err) {
      console.error("Error sending interest:", err);
    }
    advanceCard();
  }, [user, pendingProfile, icebreakerMessage, showToast, advanceCard]);

  const handleSkipIcebreaker = useCallback(() => {
    setIcebreakerVisible(false);
    handleSendInterest();
  }, [handleSendInterest]);

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!authLoading && !user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Lock size={64} color="#71717A" />
          <Text style={styles.emptyTitle}>Sign in to Discover</Text>
          <Text style={styles.emptySubtitle}>
            Find and connect with other C24 Club members
          </Text>
          <TouchableOpacity
            style={styles.redFullButton}
            activeOpacity={0.8}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.redFullButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#EF4444" />
        </View>
      </SafeAreaView>
    );
  }

  const currentProfile = members[currentIndex];
  const nextProfile = members[currentIndex + 1];
  const age = currentProfile ? calcAge(currentProfile.birthdate) : null;
  const lastActiveStr = currentProfile
    ? formatLastActive(currentProfile.last_active_at)
    : null;
  const isVip =
    currentProfile?.membership &&
    currentProfile.membership.toLowerCase() !== "free";

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!currentProfile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Compass size={72} color="#EF4444" />
          <Text style={styles.emptyTitle}>You've seen everyone!</Text>
          <Text style={styles.emptySubtitle}>
            Check back later for new members
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            activeOpacity={0.8}
            onPress={fetchMembers}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const genderColor = getGenderColor(currentProfile.gender);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Compass size={22} color="#EF4444" />
        <Text style={styles.headerTitle}>Discover</Text>
      </View>

      {/* Card Stack */}
      <View style={styles.cardStackArea}>
        {/* Next card (behind) */}
        {nextProfile && (
          <View style={styles.nextCardWrapper}>
            <View style={styles.card}>
              {nextProfile.image_url ? (
                <Image
                  source={{ uri: nextProfile.image_url }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={flattenStyle([
                    styles.cardImagePlaceholder,
                    { backgroundColor: getGenderColor(nextProfile.gender) + "33" },
                  ])}
                >
                  <User size={64} color={getGenderColor(nextProfile.gender)} />
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{nextProfile.name}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Current card (front) */}
        <Animated.View
          style={flattenStyle([
            styles.cardAnimatedWrapper,
            { transform: [{ translateX }], opacity: cardOpacity },
          ])}
        >
          <View style={styles.card}>
            {/* Image */}
            {currentProfile.image_url ? (
              <Image
                source={{ uri: currentProfile.image_url }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            ) : (
              <View
                style={flattenStyle([
                  styles.cardImagePlaceholder,
                  { backgroundColor: genderColor + "33" },
                ])}
              >
                <User size={72} color={genderColor} />
              </View>
            )}

            {/* VIP Badge */}
            {isVip && (
              <View style={styles.vipBadge}>
                <Text style={styles.vipBadgeText}>⭐ VIP</Text>
              </View>
            )}

            {/* Info */}
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>
                {currentProfile.name}
                {age ? (
                  <Text style={styles.cardAge}>, {age}</Text>
                ) : null}
              </Text>

              {(currentProfile.title || currentProfile.profession) && (
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {currentProfile.title || currentProfile.profession}
                </Text>
              )}

              {(currentProfile.city || currentProfile.country) && (
                <View style={styles.locationRow}>
                  <MapPin size={14} color="#71717A" />
                  <Text style={styles.locationText}>
                    {[currentProfile.city, currentProfile.country]
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                </View>
              )}

              {currentProfile.bio ? (
                <Text style={styles.cardBio} numberOfLines={2}>
                  {currentProfile.bio}
                </Text>
              ) : null}

              {lastActiveStr && (
                <Text style={styles.lastActive}>{lastActiveStr}</Text>
              )}
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        {/* Skip */}
        <TouchableOpacity
          style={styles.skipButton}
          activeOpacity={0.8}
          onPress={handleSkip}
        >
          <X size={26} color="#71717A" />
        </TouchableOpacity>

        {/* Interested */}
        <TouchableOpacity
          style={styles.interestedButton}
          activeOpacity={0.8}
          onPress={() => handleInterested(currentProfile)}
        >
          <Heart size={30} color="#FFFFFF" fill="#FFFFFF" />
        </TouchableOpacity>

        {/* Super Interest */}
        <TouchableOpacity
          style={styles.superButton}
          activeOpacity={0.8}
          onPress={() => handleInterested(currentProfile)}
        >
          <Star size={26} color="#FACC15" fill="#FACC15" />
        </TouchableOpacity>
      </View>

      {/* Counter */}
      <Text style={styles.counter}>
        {currentIndex + 1} / {members.length}
      </Text>

      {/* Icebreaker Modal */}
      <Modal
        visible={icebreakerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIcebreakerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKAV}
          >
            <View style={styles.icebreakerPanel}>
              <Text style={styles.icebreakerLabel}>
                Send an icebreaker? (optional)
              </Text>
              <TextInput
                style={styles.icebreakerInput}
                value={icebreakerMessage}
                onChangeText={setIcebreakerMessage}
                placeholder="Say something nice..."
                placeholderTextColor="#71717A"
                multiline
                numberOfLines={3}
                maxLength={300}
              />
              <TouchableOpacity
                style={styles.sendButton}
                activeOpacity={0.8}
                onPress={handleSendInterest}
              >
                <Text style={styles.sendButtonText}>Send Interest</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skipLink}
                activeOpacity={0.7}
                onPress={handleSkipIcebreaker}
              >
                <Text style={styles.skipLinkText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Toast */}
      {toastVisible && (
        <Animated.View style={flattenStyle([styles.toast, { opacity: toastOpacity }])}>
          <Text style={styles.toastText}>Interest sent! 💚</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const CARD_HEIGHT = Dimensions.get("window").height * 0.62;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1A1A2E" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Card stack
  cardStackArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nextCardWrapper: {
    position: "absolute",
    left: 20,
    right: 20,
    transform: [{ scale: 0.95 }, { translateY: 16 }],
    height: CARD_HEIGHT,
    borderRadius: 28,
    overflow: "hidden",
  },
  cardAnimatedWrapper: {
    position: "absolute",
    left: 20,
    right: 20,
    height: CARD_HEIGHT,
    borderRadius: 28,
  },
  card: {
    flex: 1,
    backgroundColor: "#1E1E38",
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  cardImage: {
    width: "100%",
    height: "55%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cardImagePlaceholder: {
    width: "100%",
    height: "55%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  vipBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "#FACC15",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  vipBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1A1A2E",
  },
  cardInfo: {
    padding: 16,
    flex: 1,
    gap: 6,
  },
  cardName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cardAge: {
    fontSize: 20,
    fontWeight: "600",
    color: "#A1A1AA",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#A1A1AA",
    fontWeight: "500",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: "#71717A",
  },
  cardBio: {
    fontSize: 14,
    color: "#A1A1AA",
    lineHeight: 20,
  },
  lastActive: {
    fontSize: 12,
    color: "#22C55E",
    fontWeight: "600",
  },

  // Action buttons
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 20,
  },
  skipButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  interestedButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  superButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#FACC15",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },

  // Counter
  counter: {
    textAlign: "center",
    color: "#71717A",
    fontSize: 12,
    paddingBottom: 8,
  },

  // Empty / not logged in states
  emptyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#A1A1AA",
    textAlign: "center",
    lineHeight: 22,
  },
  refreshButton: {
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: "#EF4444",
    marginTop: 8,
  },
  refreshButtonText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "700",
  },
  redFullButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
    width: "100%",
    marginTop: 8,
  },
  redFullButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  // Icebreaker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalKAV: {
    width: "100%",
  },
  icebreakerPanel: {
    backgroundColor: "#1E1E38",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
    borderTopWidth: 1,
    borderColor: "#2A2A4A",
  },
  icebreakerLabel: {
    fontSize: 15,
    color: "#A1A1AA",
    fontWeight: "600",
  },
  icebreakerInput: {
    backgroundColor: "#1A1A2E",
    borderRadius: 14,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    minHeight: 80,
    textAlignVertical: "top",
  },
  sendButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  skipLink: {
    alignItems: "center",
    paddingVertical: 4,
  },
  skipLinkText: {
    color: "#71717A",
    fontSize: 15,
    fontWeight: "600",
  },

  // Toast
  toast: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: "#22C55E",
    borderRadius: 100,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});