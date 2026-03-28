import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LogOut, User, Clock, Gift, Star } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const { session, profile, minutes, signOut, loading } = useAuth();
  const router = useRouter();
  const [redemptionCount, setRedemptionCount] = useState<number | null>(null);

  useEffect(() => {
    if (profile?.id) {
      supabase
        .from("member_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("member_id", profile.id)
        .then(({ count }) => setRedemptionCount(count ?? 0));
    }
  }, [profile?.id]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#EF4444" />
        </View>
      </SafeAreaView>
    );
  }

  if (!session || !profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <User size={64} color="#71717A" />
          <Text style={styles.title}>My Profile</Text>
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.signInButton}
              activeOpacity={0.85}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createButton}
              activeOpacity={0.85}
              onPress={() => router.push("/(auth)/signup")}
            >
              <Text style={styles.createText}>Create Account</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.linksRow}>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.linkText}>Community Rules</Text>
            </TouchableOpacity>
            <Text style={styles.linkSep}>·</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.linkText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <User size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.profileName}>{profile.name || "C24 Member"}</Text>
          <Text style={styles.profileEmail}>{profile.email}</Text>
          {minutes?.is_vip && (
            <View style={styles.vipBadge}>
              <Star size={12} color="#1A1A2E" fill="#1A1A2E" />
              <Text style={styles.vipText}>VIP Member</Text>
            </View>
          )}
        </View>

        {/* Minutes Balance Card */}
        <View style={styles.minutesCard}>
          <Clock size={24} color="#FACC15" />
          <Text style={styles.minutesNumber}>{minutes?.total_minutes ?? 0}</Text>
          <Text style={styles.minutesLabel}>Available Minutes</Text>
          <View style={styles.minutesDivider} />
          <View style={styles.minutesStatsRow}>
            <View style={styles.minutesStat}>
              <Text style={styles.minutesStatValue}>{minutes?.gifted_minutes ?? 0}</Text>
              <Text style={styles.minutesStatLabel}>Gifted</Text>
            </View>
            <View style={styles.minutesStatDivider} />
            <View style={styles.minutesStat}>
              <Text style={styles.minutesStatValue}>{minutes?.ad_points ?? 0}</Text>
              <Text style={styles.minutesStatLabel}>Ad Points</Text>
            </View>
            <View style={styles.minutesStatDivider} />
            <View style={styles.minutesStat}>
              <Text style={styles.minutesStatValue}>{redemptionCount ?? "—"}</Text>
              <Text style={styles.minutesStatLabel}>Redeemed</Text>
            </View>
          </View>
        </View>

        {/* Rewards shortcut */}
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.8}
          onPress={() => router.push("/(tabs)/rewards")}
        >
          <Gift size={20} color="#EF4444" />
          <Text style={styles.menuItemText}>Reward Store</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutButton}
          activeOpacity={0.8}
          onPress={handleSignOut}
        >
          <LogOut size={18} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Links */}
        <View style={styles.linksRow}>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.linkText}>Community Rules</Text>
          </TouchableOpacity>
          <Text style={styles.linkSep}>·</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1A1A2E" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  // Unauthenticated
  title: { fontSize: 32, fontWeight: "800", color: "#FFFFFF", marginTop: 20, marginBottom: 32 },
  buttonsContainer: { width: "100%", gap: 12, marginBottom: 32 },
  signInButton: { backgroundColor: "#EF4444", borderRadius: 100, paddingVertical: 18, alignItems: "center", width: "100%" },
  signInText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  createButton: { borderRadius: 100, paddingVertical: 17, alignItems: "center", width: "100%", borderWidth: 2, borderColor: "#FFFFFF" },
  createText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  // Profile header
  profileHeader: { alignItems: "center", paddingTop: 32, paddingBottom: 24 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#1E1E38", alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 2, borderColor: "#2A2A4A" },
  profileName: { fontSize: 24, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  profileEmail: { fontSize: 14, color: "#A1A1AA", marginBottom: 8 },
  vipBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#FACC15", borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, gap: 4 },
  vipText: { fontSize: 12, fontWeight: "800", color: "#1A1A2E" },
  // Minutes card
  minutesCard: { backgroundColor: "#1E1E38", borderRadius: 24, padding: 24, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#2A2A4A" },
  minutesNumber: { fontSize: 56, fontWeight: "900", color: "#FACC15", lineHeight: 64, marginTop: 8 },
  minutesLabel: { fontSize: 14, color: "#A1A1AA", marginBottom: 16 },
  minutesDivider: { width: "100%", height: 1, backgroundColor: "#2A2A4A", marginBottom: 16 },
  minutesStatsRow: { flexDirection: "row", width: "100%", justifyContent: "space-around" },
  minutesStat: { alignItems: "center", flex: 1 },
  minutesStatValue: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
  minutesStatLabel: { fontSize: 11, color: "#71717A", marginTop: 2 },
  minutesStatDivider: { width: 1, backgroundColor: "#2A2A4A" },
  // Menu
  menuItem: { backgroundColor: "#1E1E38", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  menuItemText: { flex: 1, fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  menuItemArrow: { fontSize: 22, color: "#71717A" },
  // Sign out
  signOutButton: { borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#EF4444", marginBottom: 32 },
  signOutText: { color: "#EF4444", fontSize: 16, fontWeight: "700" },
  // Links
  linksRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  linkText: { color: "#71717A", fontSize: 13 },
  linkSep: { color: "#71717A", fontSize: 13 },
});