import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  DollarSign,
  Gift,
  Heart,
  Link2,
  Lock,
  MessageCircle,
  MessageSquare,
  Pencil,
  Shield,
  Sparkles,
  Trash2,
  User,
  Video,
  Wifi,
} from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { flattenStyle } from "@/utils/flatten-style";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2;
const CARD_HEIGHT = CARD_WIDTH * (4 / 3);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTimeAgo = (dateStr: string | null): string => {
  if (!dateStr) return "Recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 5) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const isFakeOnline = (memberId: string, gender: string | null): boolean => {
  if (!gender || gender.toLowerCase() !== "female") return false;
  const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60));
  let hash = 0;
  const str = memberId + String(hourSeed);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100 < 35;
};

const isEffectivelyOnline = (
  id: string,
  gender: string | null,
  lastActive: string | null
): boolean => {
  const realOnline =
    !!lastActive &&
    Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000;
  return realOnline || isFakeOnline(id, gender);
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscoverMember {
  id: string;
  name: string;
  bio: string | null;
  gender: string | null;
  image_url: string | null;
  image_thumb_url: string | null;
  image_status: string | null;
  is_discoverable: boolean;
  last_active_at: string | null;
  country: string | null;
  created_at: string;
  membership: string | null;
  is_test_account: boolean;
}

interface InterestedMember {
  user_id: string;
  icebreaker_message: string | null;
  created_at: string;
  member?: {
    id: string;
    name: string;
    image_thumb_url: string | null;
  };
}

type FilterType = "All" | "Male" | "Female" | "Online Now";

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const { user, profile, minutes, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();

  // Data state
  const [members, setMembers] = useState<DiscoverMember[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [vipIds, setVipIds] = useState<Set<string>>(new Set());
  const [modIds, setModIds] = useState<Set<string>>(new Set());
  const [myInterests, setMyInterests] = useState<Set<string>>(new Set());
  const [interestedInMe, setInterestedInMe] = useState<InterestedMember[]>([]);
  const [vipSettings, setVipSettings] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // UI state
  const [filter, setFilter] = useState<FilterType>("All");
  const [selfieExpanded, setSelfieExpanded] = useState(false);
  const [editExpanded, setEditExpanded] = useState(false);
  const [interestsExpanded, setInterestsExpanded] = useState(false);
  const [bioText, setBioText] = useState(profile?.bio ?? "");
  const [savingBio, setSavingBio] = useState(false);

  // My profile state
  const [isDiscoverable, setIsDiscoverable] = useState(profile?.is_discoverable ?? false);
  const [myImageUrl, setMyImageUrl] = useState(profile?.image_url ?? null);
  const [myImageStatus, setMyImageStatus] = useState<string | null>(null);

  const gifted = minutes?.gifted_minutes ?? 0;

  // ─── Data Loading ────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [
        membersRes,
        adminRes,
        vipRes,
        modRes,
        myInterestsRes,
        interestedRes,
      ] = await Promise.all([
        supabase
          .from("members")
          .select(
            "id, name, bio, gender, image_url, image_thumb_url, image_status, is_discoverable, last_active_at, country, created_at, membership, is_test_account"
          )
          .eq("is_discoverable", true)
          .eq("image_status", "approved")
          .order("last_active_at", { ascending: false })
          .limit(50),
        supabase.rpc("get_admin_user_ids"),
        supabase.rpc("get_vip_user_ids"),
        supabase.rpc("get_moderator_user_ids"),
        supabase
          .from("member_interests")
          .select("interested_in_user_id")
          .eq("user_id", user.id),
        supabase
          .from("member_interests")
          .select("user_id, icebreaker_message, created_at")
          .eq("interested_in_user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const rawAdmins: string[] = Array.isArray(adminRes.data) ? adminRes.data : [];
      const rawVips: string[] = Array.isArray(vipRes.data) ? vipRes.data : [];
      const rawMods: string[] = Array.isArray(modRes.data) ? modRes.data : [];

      const adminSet = new Set<string>(rawAdmins);
      const vipSet = new Set<string>(rawVips);
      const modSet = new Set<string>(rawMods);

      setAdminIds(adminSet);
      setVipIds(vipSet);
      setModIds(modSet);

      const interestSet = new Set<string>(
        (myInterestsRes.data ?? []).map(
          (i: { interested_in_user_id: string }) => i.interested_in_user_id
        )
      );
      setMyInterests(interestSet);

      setInterestedInMe(
        (interestedRes.data ?? []) as InterestedMember[]
      );

      // Sort: admins first, VIP second, mods third, rest by last_active_at desc
      const raw: DiscoverMember[] = membersRes.data ?? [];
      const sorted = [...raw].sort((a, b) => {
        const rankA = adminSet.has(a.id) ? 3 : vipSet.has(a.id) ? 2 : modSet.has(a.id) ? 1 : 0;
        const rankB = adminSet.has(b.id) ? 3 : vipSet.has(b.id) ? 2 : modSet.has(b.id) ? 1 : 0;
        return rankB - rankA;
      });
      setMembers(sorted);

      // Fetch VIP settings for pinned socials
      const vipMemberIds = sorted.filter((m) => vipSet.has(m.id)).map((m) => m.id);
      if (vipMemberIds.length > 0) {
        const { data: vipData } = await supabase
          .from("vip_settings")
          .select("user_id, pinned_socials")
          .in("user_id", vipMemberIds);
        const vipMap = new Map<string, string[]>();
        (vipData ?? []).forEach((v: { user_id: string; pinned_socials: string[] | null }) => {
          if (v.pinned_socials && v.pinned_socials.length > 0) {
            vipMap.set(v.user_id, v.pinned_socials);
          }
        });
        setVipSettings(vipMap);
      }

      // My profile
      if (profile) {
        setIsDiscoverable(profile.is_discoverable);
        setMyImageUrl(profile.image_url);
        setBioText(profile.bio ?? "");
      }

      // Fetch my image_status
      const { data: myMember } = await supabase
        .from("members")
        .select("image_status, is_discoverable, image_url, image_thumb_url, bio")
        .eq("id", user.id)
        .maybeSingle();
      if (myMember) {
        setMyImageStatus(myMember.image_status ?? null);
        setIsDiscoverable(myMember.is_discoverable ?? false);
        setMyImageUrl(myMember.image_url ?? null);
        setBioText(myMember.bio ?? "");
      }
    } catch (err) {
      console.error("Error fetching discover data:", err);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (user) {
      fetchAll();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, fetchAll]);

  // ─── Filter logic ────────────────────────────────────────────────────────

  const filteredMembers = members.filter((m) => {
    if (filter === "Male") return m.gender?.toLowerCase() === "male";
    if (filter === "Female") return m.gender?.toLowerCase() === "female";
    if (filter === "Online Now")
      return isEffectivelyOnline(m.id, m.gender, m.last_active_at);
    return true;
  });

  // ─── Interest handling ───────────────────────────────────────────────────

  const handleInterest = useCallback(
    async (memberId: string) => {
      if (!user) return;
      if (myInterests.has(memberId)) return; // Already interested
      try {
        await supabase.from("member_interests").insert({
          user_id: user.id,
          interested_in_user_id: memberId,
        });
        setMyInterests((prev) => new Set([...prev, memberId]));
        Alert.alert("Interest sent! 💚");
      } catch (err) {
        console.error("Error sending interest:", err);
      }
    },
    [user, myInterests]
  );

  const trackView = useCallback(
    (memberId: string) => {
      if (!user) return;
      supabase
        .from("discover_profile_views")
        .insert({ viewer_id: user.id, viewed_member_id: memberId })
        .then(() => {});
    },
    [user]
  );

  // ─── Remove listing ──────────────────────────────────────────────────────

  const handleRemoveListing = useCallback(async () => {
    if (!user) return;
    Alert.alert(
      "Remove Listing",
      "Are you sure you want to remove yourself from Discover?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase
                .from("members")
                .update({
                  is_discoverable: false,
                  image_url: null,
                  image_thumb_url: null,
                })
                .eq("id", user.id);
              setIsDiscoverable(false);
              setMyImageUrl(null);
              Alert.alert("Listing removed");
              await refreshProfile();
            } catch (err) {
              console.error("Error removing listing:", err);
            }
          },
        },
      ]
    );
  }, [user, refreshProfile]);

  // ─── Save bio ────────────────────────────────────────────────────────────

  const handleSaveBio = useCallback(async () => {
    if (!user) return;
    setSavingBio(true);
    try {
      await supabase
        .from("members")
        .update({ bio: bioText.trim() })
        .eq("id", user.id);
      Alert.alert("Bio saved!");
      setEditExpanded(false);
    } catch (err) {
      console.error("Error saving bio:", err);
    } finally {
      setSavingBio(false);
    }
  }, [user, bioText]);

  // ─── Not logged in ───────────────────────────────────────────────────────

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

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#EF4444" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render helpers ──────────────────────────────────────────────────────

  const renderHeader = () => (
    <View>
      {/* Selfie Card */}
      {isDiscoverable && (
        <View style={styles.selfieCard}>
          <View style={styles.selfieRow}>
            {/* Image */}
            {myImageUrl ? (
              <Image
                source={{ uri: myImageUrl }}
                style={styles.selfieImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.selfieImagePlaceholder}>
                <User size={28} color="#71717A" />
              </View>
            )}

            {/* Info */}
            <View style={styles.selfieInfo}>
              <Text style={styles.selfieName}>Your Discover Selfie</Text>
              {myImageStatus === "approved" && (
                <View style={styles.statusBadge}>
                  <CheckCircle size={12} color="#22C55E" />
                  <Text style={[styles.statusText, { color: "#22C55E" }]}>
                    Approved
                  </Text>
                </View>
              )}
              {myImageStatus === "denied" && (
                <View style={styles.statusBadge}>
                  <AlertCircle size={12} color="#EF4444" />
                  <Text style={[styles.statusText, { color: "#EF4444" }]}>
                    Denied
                  </Text>
                </View>
              )}
              {myImageStatus === "pending" && (
                <View style={styles.statusBadge}>
                  <Clock size={12} color="#FACC15" />
                  <Text style={[styles.statusText, { color: "#FACC15" }]}>
                    Pending
                  </Text>
                </View>
              )}
            </View>

            {/* Retake */}
            <TouchableOpacity style={styles.retakeButton} activeOpacity={0.8}>
              <Camera size={14} color="#EC4899" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Edit My Profile Accordion */}
      {isDiscoverable && (
        <View style={styles.accordion}>
          <TouchableOpacity
            style={styles.accordionHeader}
            activeOpacity={0.8}
            onPress={() => setEditExpanded((v) => !v)}
          >
            <Pencil size={16} color="#EC4899" />
            <Text style={styles.accordionTitle}>Edit My Profile</Text>
            <Text style={styles.accordionSub}>Bio · 2 socials</Text>
            <View style={{ flex: 1 }} />
            {editExpanded ? (
              <ChevronUp size={18} color="#71717A" />
            ) : (
              <ChevronDown size={18} color="#71717A" />
            )}
          </TouchableOpacity>
          {editExpanded && (
            <View style={styles.accordionBody}>
              <TextInput
                style={styles.bioInput}
                value={bioText}
                onChangeText={setBioText}
                placeholder="Tell people about yourself..."
                placeholderTextColor="#71717A"
                multiline
                maxLength={120}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={styles.saveButton}
                activeOpacity={0.8}
                onPress={handleSaveBio}
                disabled={savingBio}
              >
                <Text style={styles.saveButtonText}>
                  {savingBio ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Interested in You */}
      <View style={styles.accordion}>
        <TouchableOpacity
          style={styles.accordionHeader}
          activeOpacity={0.8}
          onPress={() => setInterestsExpanded((v) => !v)}
        >
          <Heart size={16} color="#EC4899" fill="#EC4899" />
          <Text style={styles.accordionTitle}>Interested in You</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{interestedInMe.length}</Text>
          </View>
          <Text style={styles.accordionSub}>{interestedInMe.length} total</Text>
          <View style={{ flex: 1 }} />
          {interestsExpanded ? (
            <ChevronUp size={18} color="#71717A" />
          ) : (
            <ChevronDown size={18} color="#71717A" />
          )}
        </TouchableOpacity>
        {interestsExpanded && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.interestedScroll}
            contentContainerStyle={styles.interestedScrollContent}
          >
            {interestedInMe.length === 0 ? (
              <Text style={styles.noInterestsText}>No interests yet</Text>
            ) : (
              interestedInMe.map((item) => (
                <View key={item.user_id} style={styles.interestedCard}>
                  {item.member?.image_thumb_url ? (
                    <Image
                      source={{ uri: item.member.image_thumb_url }}
                      style={styles.interestedAvatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.interestedAvatarPlaceholder}>
                      <Text style={styles.interestedInitial}>
                        {item.member?.name?.[0]?.toUpperCase() ?? "?"}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.interestedName} numberOfLines={1}>
                    {item.member?.name ?? "Member"}
                  </Text>
                  {item.icebreaker_message ? (
                    <Text style={styles.interestedMsg} numberOfLines={1}>
                      {item.icebreaker_message}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        {(["All", "Male", "Female", "Online Now"] as FilterType[]).map(
          (pill) => (
            <TouchableOpacity
              key={pill}
              style={flattenStyle([
                styles.filterPill,
                filter === pill && styles.filterPillActive,
              ])}
              activeOpacity={0.8}
              onPress={() => setFilter(pill)}
            >
              {pill === "Online Now" && (
                <Wifi
                  size={12}
                  color={filter === pill ? "#FFFFFF" : "#71717A"}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                style={flattenStyle([
                  styles.filterPillText,
                  filter === pill && styles.filterPillTextActive,
                ])}
              >
                {pill}
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* ── Sticky Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
          activeOpacity={0.8}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Discover People</Text>
          <Text style={styles.headerSubtitle}>
            Find people who want to video chat
          </Text>
        </View>

        <View style={styles.headerButtons}>
          {gifted > 0 && (
            <TouchableOpacity style={styles.giftedButton} activeOpacity={0.8}>
              <Text style={styles.giftedButtonText}>$</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.dmsButton} activeOpacity={0.8} onPress={() => router.push("/(tabs)/messages")}>
            <MessageSquare size={14} color="#3B82F6" />
            <Text style={styles.dmsButtonText}>DMs</Text>
          </TouchableOpacity>
          {isDiscoverable ? (
            <TouchableOpacity
              style={styles.removeButton}
              activeOpacity={0.8}
              onPress={handleRemoveListing}
            >
              <Trash2 size={14} color="#EF4444" />
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.getListedButton}
              activeOpacity={0.8}
            >
              <Text style={styles.getListedText}>Get Listed</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── FlatList with header sections ── */}
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => (
          <MemberCard
            member={item}
            isAdmin={adminIds.has(item.id)}
            isVip={vipIds.has(item.id)}
            isMod={modIds.has(item.id)}
            isSelf={user?.id === item.id}
            isInterested={myInterests.has(item.id)}
            isMutualInterest={
              myInterests.has(item.id) &&
              interestedInMe.some((i) => i.user_id === item.id)
            }
            pinnedSocials={vipSettings.get(item.id) ?? null}
            onInterest={() => handleInterest(item.id)}
            onView={() => trackView(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyGridText}>No members found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────

interface MemberCardProps {
  member: DiscoverMember;
  isAdmin: boolean;
  isVip: boolean;
  isMod: boolean;
  isSelf: boolean;
  isInterested: boolean;
  isMutualInterest: boolean;
  pinnedSocials: string[] | null;
  onInterest: () => void;
  onView: () => void;
}

const MemberCard = React.memo(function MemberCard({
  member,
  isAdmin,
  isVip,
  isMod,
  isSelf,
  isInterested,
  isMutualInterest,
  pinnedSocials,
  onInterest,
  onView,
}: MemberCardProps) {
  const viewTracked = useRef(false);
  const router = useRouter();
  const online = isEffectivelyOnline(member.id, member.gender, member.last_active_at);
  const isFemale = member.gender?.toLowerCase() === "female";

  const placeholderBg = isFemale
    ? "rgba(236,72,153,0.15)"
    : member.gender?.toLowerCase() === "male"
    ? "rgba(59,130,246,0.15)"
    : "rgba(139,92,246,0.15)";

  const initial = member.name?.[0]?.toUpperCase() ?? "?";

  useEffect(() => {
    if (!viewTracked.current) {
      viewTracked.current = true;
      onView();
    }
  }, [onView]);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => {}} // view only, no navigation for now
    >
      {/* Photo / Placeholder */}
      {member.image_url ? (
        <Image
          source={{ uri: member.image_url }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <View
          style={flattenStyle([
            StyleSheet.absoluteFillObject,
            { backgroundColor: placeholderBg, alignItems: "center", justifyContent: "center" },
          ])}
        >
          <Text style={styles.placeholderInitial}>{initial}</Text>
        </View>
      )}

      {/* Top-left badges */}
      <View style={styles.badgeStack}>
        {online && (
          <View style={styles.badgeOnline}>
            <View style={styles.pulseDot} />
            <Text style={styles.badgeText}>Online</Text>
          </View>
        )}
        {isMutualInterest && (
          <View style={styles.badgeMatch}>
            <Text style={styles.badgeText}>Match!</Text>
          </View>
        )}
        {isAdmin && (
          <View style={styles.badgeOwner}>
            <Crown size={9} color="#FFFFFF" />
            <Text style={styles.badgeText}> Owner</Text>
          </View>
        )}
        {isVip && !isAdmin && (
          <View style={styles.badgeVip}>
            <Sparkles size={9} color="#FFFFFF" />
            <Text style={styles.badgeText}> VIP</Text>
          </View>
        )}
        {isMod && !isAdmin && (
          <View style={styles.badgeMod}>
            <Shield size={9} color="#FFFFFF" />
            <Text style={styles.badgeText}> Mod</Text>
          </View>
        )}
        {isSelf && (
          <View style={styles.badgeSelf}>
            <Text style={styles.badgeText}>You</Text>
          </View>
        )}
      </View>

      {/* Bottom overlay */}
      <View style={styles.cardOverlay}>
        {member.bio ? (
          <Text style={styles.cardBio} numberOfLines={2}>
            &ldquo;{member.bio}&rdquo;
          </Text>
        ) : null}
        <Text style={styles.cardName}>{member.name}</Text>
        <Text
          style={flattenStyle([
            styles.cardTime,
            online && { color: "#22C55E" },
          ])}
        >
          {online ? "Online" : getTimeAgo(member.last_active_at)}
        </Text>
        {isFemale && (
          <View style={styles.earnsRow}>
            <DollarSign size={10} color="#22C55E" />
            <Text style={styles.earnsText}>Earns by chatting</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtnGreen} activeOpacity={0.8}>
            <Video size={12} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtnBlue} activeOpacity={0.8} onPress={() => router.push({ pathname: "/messages/[id]", params: { id: "new", partnerId: member.id, partnerName: member.name, partnerImage: member.image_url ?? "" } })}>
            <MessageCircle size={12} color="#FFFFFF" />
          </TouchableOpacity>
          {pinnedSocials && pinnedSocials.length > 0 && (
            <TouchableOpacity style={styles.actionBtnPurple} activeOpacity={0.8}>
              <Link2 size={12} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtnAmber} activeOpacity={0.8}>
            <Gift size={12} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={flattenStyle([
              styles.actionBtnHeart,
              isInterested && styles.actionBtnHeartActive,
            ])}
            activeOpacity={0.8}
            onPress={onInterest}
          >
            <Heart
              size={12}
              color={isInterested ? "#FFFFFF" : "#EC4899"}
              fill={isInterested ? "#EC4899" : "transparent"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

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
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#A1A1AA",
    textAlign: "center",
  },
  redFullButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
  },
  redFullButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(17,17,17,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E38",
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#71717A",
    marginTop: 1,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  giftedButton: {
    backgroundColor: "rgba(16,185,129,0.2)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  giftedButtonText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "700",
  },
  dmsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(59,130,246,0.2)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.3)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dmsButtonText: {
    color: "#3B82F6",
    fontSize: 13,
    fontWeight: "600",
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239,68,68,0.2)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
  },
  getListedButton: {
    backgroundColor: "#EC4899",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  getListedText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Selfie Card ───────────────────────────────────────────────────────────
  selfieCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "#1E1E38",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    padding: 12,
  },
  selfieRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selfieImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  selfieImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#2A2A4A",
    alignItems: "center",
    justifyContent: "center",
  },
  selfieInfo: {
    flex: 1,
    gap: 6,
  },
  selfieName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#EC4899",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  retakeText: {
    color: "#EC4899",
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Accordion ─────────────────────────────────────────────────────────────
  accordion: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#1E1E38",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  accordionSub: {
    fontSize: 12,
    color: "#71717A",
  },
  countBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  bioInput: {
    backgroundColor: "#111111",
    borderRadius: 10,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // ── Interested in You ─────────────────────────────────────────────────────
  interestedScroll: {
    paddingBottom: 14,
  },
  interestedScrollContent: {
    paddingHorizontal: 14,
    gap: 10,
  },
  interestedCard: {
    width: 60,
    alignItems: "center",
    gap: 4,
  },
  interestedAvatar: {
    width: 60,
    height: 80,
    borderRadius: 12,
  },
  interestedAvatarPlaceholder: {
    width: 60,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#2A2A4A",
    alignItems: "center",
    justifyContent: "center",
  },
  interestedInitial: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  interestedName: {
    fontSize: 11,
    color: "#A1A1AA",
    textAlign: "center",
  },
  interestedMsg: {
    fontSize: 10,
    color: "#71717A",
    textAlign: "center",
  },
  noInterestsText: {
    color: "#71717A",
    fontSize: 13,
    paddingVertical: 8,
  },

  // ── Filter Pills ──────────────────────────────────────────────────────────
  filterScroll: {
    marginBottom: 8,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E38",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterPillActive: {
    backgroundColor: "#EF4444",
  },
  filterPillText: {
    color: "#71717A",
    fontSize: 13,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },

  // ── Grid ──────────────────────────────────────────────────────────────────
  gridContent: {
    paddingBottom: 24,
  },
  columnWrapper: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  emptyGrid: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyGridText: {
    color: "#71717A",
    fontSize: 14,
  },

  // ── Member Card ───────────────────────────────────────────────────────────
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1E1E38",
  },
  placeholderInitial: {
    fontSize: 48,
    fontWeight: "800",
    color: "rgba(255,255,255,0.6)",
  },

  // Badges
  badgeStack: {
    position: "absolute",
    top: 8,
    left: 8,
    gap: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  badgeOnline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16,185,129,0.9)",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  badgeMatch: {
    backgroundColor: "rgba(236,72,153,0.9)",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeOwner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#B45309",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeVip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeMod: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1D4ED8",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeSelf: {
    backgroundColor: "#06B6D4",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  // Bottom overlay
  cardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 8,
  },
  cardBio: {
    fontSize: 10,
    color: "#A1A1AA",
    fontStyle: "italic",
    marginBottom: 2,
  },
  cardName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cardTime: {
    fontSize: 10,
    color: "#71717A",
    marginTop: 1,
  },
  earnsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  earnsText: {
    color: "#22C55E",
    fontSize: 10,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  actionBtnGreen: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(16,185,129,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnBlue: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(59,130,246,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnPurple: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(139,92,246,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnAmber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(245,158,11,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnHeart: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "#EC4899",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnHeartActive: {
    backgroundColor: "rgba(236,72,153,0.8)",
    borderColor: "#EC4899",
  },
});