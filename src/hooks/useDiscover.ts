import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface DiscoverableMember {
  id: string;
  name: string;
  image_url: string | null;
  gender: string | null;
  country: string | null;
  last_active_at: string | null;
  bio: string | null;
  created_at: string;
}

export interface IncomingInterest {
  user_id: string;
  icebreaker_message: string | null;
  created_at: string;
  name: string;
  image_url: string | null;
  gender: string | null;
  country: string | null;
}

export type DiscoverFilter = {
  gender: string;
  country: string;
  onlineOnly: boolean;
};

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
const PAGE_SIZE = 50;

export const isOnlineNow = (lastActive: string | null) => {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < ONLINE_THRESHOLD_MS;
};

/** Returns true for ~35% of female profiles (rotates hourly) to show fake "Online" badge */
export const isFakeOnline = (memberId: string, gender: string | null) => {
  if (!gender || gender.toLowerCase() !== "female") return false;
  const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60));
  let hash = 0;
  const str = memberId + String(hourSeed);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100 < 35;
};

export const isEffectivelyOnline = (memberId: string, gender: string | null, lastActive: string | null) => {
  return isOnlineNow(lastActive) || isFakeOnline(memberId, gender);
};

export const isNewListing = (createdAt: string) => {
  return Date.now() - new Date(createdAt).getTime() < 48 * 60 * 60 * 1000;
};

export const getTimeAgo = (dateStr: string | null) => {
  if (!dateStr) return "Recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 5) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const ICEBREAKER_MESSAGES = [
  "Let's chat! 💬",
  "Love your vibe! ✨",
  "You seem cool! 😎",
  "Wanna video chat? 📹",
  "Hey there! 👋",
];

export const useDiscover = () => {
  const { user } = useAuth();
  const [allFetchedMembers, setAllFetchedMembers] = useState<DiscoverableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [myInterests, setMyInterests] = useState<Map<string, string | null>>(new Map());
  const [interestedInMe, setInterestedInMe] = useState<Set<string>>(new Set());
  const [incomingInterestsList, setIncomingInterestsList] = useState<IncomingInterest[]>([]);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [myGender, setMyGender] = useState<string | null>(null);
  const [sendingInterest, setSendingInterest] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoverFilter>({ gender: "all", country: "", onlineOnly: false });
  const [mutualSocials, setMutualSocials] = useState<Map<string, string[]>>(new Map());
  const [countries, setCountries] = useState<string[]>([]);
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());
  const [vipUserIds, setVipUserIds] = useState<Set<string>>(new Set());
  const [modUserIds, setModUserIds] = useState<Set<string>>(new Set());
  const pageRef = useRef(0);
  const adminMembersFetchedRef = useRef(false);

  // Fetch a page of members from the DB
  const fetchMembersPage = useCallback(async (page: number, userId: string) => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data } = await supabase
      .from("members")
      .select("id, name, image_url, gender, country, last_active_at, bio, created_at")
      .eq("is_discoverable", true)
      .filter("image_status", "eq", "approved")
      .order("last_active_at", { ascending: false })
      .range(from, to);

    return (data ?? []) as DiscoverableMember[];
  }, []);

  // Sort members: admins first, VIP second, mods third, rest by order
  const sortMembers = useCallback((list: DiscoverableMember[], adminIds: Set<string>, vipIds: Set<string>, modIds?: Set<string>) => {
    return [...list].sort((a, b) => {
      const aAdmin = adminIds.has(a.id) ? 0 : 1;
      const bAdmin = adminIds.has(b.id) ? 0 : 1;
      if (aAdmin !== bAdmin) return aAdmin - bAdmin;
      const aVip = vipIds.has(a.id) ? 0 : 1;
      const bVip = vipIds.has(b.id) ? 0 : 1;
      if (aVip !== bVip) return aVip - bVip;
      const amod = modIds?.has(a.id) ? 0 : 1;
      const bmod = modIds?.has(b.id) ? 0 : 1;
      if (amod !== bmod) return amod - bmod;
      return 0;
    });
  }, []);

  // Load more members (next page)
  const loadMore = useCallback(async () => {
    if (!user || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    const newMembers = await fetchMembersPage(nextPage, user.id);
    
    if (newMembers.length < PAGE_SIZE) {
      setHasMore(false);
    }

    if (newMembers.length > 0) {
      pageRef.current = nextPage;
      setAllFetchedMembers(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const unique = newMembers.filter(m => !existingIds.has(m.id));
        const combined = [...prev, ...unique];
        return sortMembers(combined, adminUserIds, vipUserIds, modUserIds);
      });

      // Load socials for new members
      const newIds = newMembers.map(m => m.id);
      const { data: socials } = await supabase
        .from("vip_settings")
        .select("user_id, pinned_socials")
        .in("user_id", newIds);

      if (socials?.length) {
        setMutualSocials(prev => {
          const next = new Map(prev);
          socials.forEach((s: any) => {
            if (s.pinned_socials?.length) next.set(s.user_id, s.pinned_socials);
          });
          return next;
        });
      }
    }

    setLoadingMore(false);
  }, [user, loadingMore, hasMore, adminUserIds, vipUserIds, modUserIds, fetchMembersPage, sortMembers]);

  // Initial load
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Fetch own profile
      const { data: me } = await supabase
        .from("members")
        .select("is_discoverable, image_url, gender")
        .eq("id", user.id)
        .single();

      setIsDiscoverable(!!me?.is_discoverable && !!me?.image_url);
      setMyGender(me?.gender?.toLowerCase() || null);

      // Fetch first page of members
      const membersList = await fetchMembersPage(0, user.id);
      pageRef.current = 0;
      setHasMore(membersList.length >= PAGE_SIZE);

      // Fetch all admin user IDs
      const { data: allAdminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const adminIds = new Set((allAdminRoles || []).map((r: any) => r.user_id as string));
      setAdminUserIds(adminIds);

      // Fetch moderator user IDs
      const { data: allModRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "moderator");
      const modIds = new Set((allModRoles || []).map((r: any) => r.user_id as string));
      setModUserIds(modIds);

      // Fetch VIP user IDs
      const { data: vipRows } = await supabase
        .from("member_minutes")
        .select("user_id")
        .eq("is_vip", true);
      const vipIds = new Set((vipRows || []).map((r: any) => r.user_id as string));
      setVipUserIds(vipIds);

      // Fetch admin, VIP & mod members who aren't already in the discoverable list
      const discoverableIds = new Set(membersList.map(m => m.id));
      const missingAdminIds = [...adminIds].filter(id => !discoverableIds.has(id));
      const missingVipIds = [...vipIds].filter(id => !discoverableIds.has(id) && !adminIds.has(id));
      const missingModIds = [...modIds].filter(id => !discoverableIds.has(id) && !adminIds.has(id) && !vipIds.has(id));

      let priorityMembers: DiscoverableMember[] = [];
      const missingPriorityIds = [...missingAdminIds, ...missingVipIds, ...missingModIds];
      if (missingPriorityIds.length > 0) {
        const { data: priorityProfiles } = await supabase
          .from("members")
          .select("id, name, image_url, gender, country, last_active_at, bio, created_at")
          .in("id", missingPriorityIds);
        priorityMembers = ((priorityProfiles || []) as DiscoverableMember[]).filter(
          m => m.image_url // Only include members with photos
        );
      }
      adminMembersFetchedRef.current = true;

      const combined = [...membersList, ...priorityMembers];
      const sorted = sortMembers(combined, adminIds, vipIds, modIds);
      setAllFetchedMembers(sorted);

      // Extract unique countries
      const uniqueCountries = [...new Set(sorted.map(m => m.country).filter(Boolean))] as string[];
      setCountries(uniqueCountries.sort());

      // Fetch my interests
      const { data: interests } = await supabase
        .from("member_interests")
        .select("interested_in_user_id, icebreaker_message")
        .eq("user_id", user.id);

      const interestsMap = new Map<string, string | null>();
      (interests || []).forEach((i: any) => interestsMap.set(i.interested_in_user_id, i.icebreaker_message));
      setMyInterests(interestsMap);

      // Fetch who is interested in me
      const { data: incomingInterests } = await supabase
        .from("member_interests")
        .select("user_id, icebreaker_message, created_at")
        .eq("interested_in_user_id", user.id)
        .order("created_at", { ascending: false });

      const incomingUserIds = (incomingInterests || []).map((i: any) => i.user_id);
      const incomingSet = new Set(incomingUserIds);
      setInterestedInMe(incomingSet);

      if (incomingUserIds.length > 0) {
        const { data: incomingMembers } = await supabase
          .from("members")
          .select("id, name, image_url, gender, country")
          .in("id", incomingUserIds);

        const memberMap = new Map<string, any>();
        (incomingMembers || []).forEach((m: any) => memberMap.set(m.id, m));

        const enriched: IncomingInterest[] = (incomingInterests || []).map((i: any) => {
          const m = memberMap.get(i.user_id);
          return {
            user_id: i.user_id,
            icebreaker_message: i.icebreaker_message,
            created_at: i.created_at,
            name: m?.name || "Someone",
            image_url: m?.image_url || null,
            gender: m?.gender || null,
            country: m?.country || null,
          };
        });
        setIncomingInterestsList(enriched);
      } else {
        setIncomingInterestsList([]);
      }

      // Load pinned socials
      const allMemberIds = sorted.map(m => m.id);
      if (allMemberIds.length > 0) {
        const { data: socials } = await supabase
          .from("vip_settings")
          .select("user_id, pinned_socials")
          .in("user_id", allMemberIds);

        const socialsMap = new Map<string, string[]>();
        (socials || []).forEach((s: any) => {
          if (s.pinned_socials?.length) socialsMap.set(s.user_id, s.pinned_socials);
        });
        setMutualSocials(socialsMap);
      }

      setLoading(false);
    };

    load();
  }, [user, fetchMembersPage, sortMembers]);

  const isMutualMatch = useCallback((memberId: string) => {
    return myInterests.has(memberId) && interestedInMe.has(memberId);
  }, [myInterests, interestedInMe]);

  const handleInterest = useCallback(async (targetId: string, icebreaker?: string) => {
    if (!user) return;
    setSendingInterest(targetId);

    try {
      const insertData: any = {
        user_id: user.id,
        interested_in_user_id: targetId,
      };
      if (icebreaker) insertData.icebreaker_message = icebreaker;

      const { error } = await supabase.from("member_interests").insert(insertData);

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already sent!", description: "You've already expressed interest." });
        } else {
          throw error;
        }
      } else {
        setMyInterests(prev => new Map([...prev, [targetId, icebreaker || null]]));

        if (interestedInMe.has(targetId)) {
          toast({ title: "It's a match! 🎉", description: "You both expressed interest! Check their profile for socials." });
        } else {
          toast({ title: "Interest sent! 💌", description: icebreaker || "We'll let them know you want to connect." });
        }

        supabase.functions.invoke("notify-interest", {
          body: { interested_user_id: user.id, target_user_id: targetId },
        });
      }
    } catch (err: any) {
      toast({ title: "Oops", description: err.message, variant: "destructive" });
    } finally {
      setSendingInterest(null);
    }
  }, [user, interestedInMe]);

  const handleRemoveListing = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase
      .from("members")
      .update({ is_discoverable: false, image_url: null, image_thumb_url: null } as any)
      .eq("id", user.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.storage.from("member-photos").remove([`${user.id}/selfie.jpg`]);
    setIsDiscoverable(false);
    toast({ title: "Listing removed 👋", description: "Your selfie has been deleted and you're no longer discoverable." });
  }, [user]);

  const filteredMembers = allFetchedMembers
    .filter(m => {
      if (filters.gender !== "all" && m.gender?.toLowerCase() !== filters.gender) return false;
      if (filters.country && m.country !== filters.country) return false;
      if (filters.onlineOnly && !isEffectivelyOnline(m.id, m.gender, m.last_active_at)) return false;
      return true;
    });

  return {
    user,
    members: filteredMembers,
    allMembers: allFetchedMembers,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    myInterests,
    interestedInMe,
    incomingInterestsList,
    isDiscoverable,
    setIsDiscoverable,
    myGender,
    sendingInterest,
    filters,
    setFilters,
    countries,
    mutualSocials,
    adminUserIds,
    vipUserIds,
    modUserIds,
    isMutualMatch,
    handleInterest,
    handleRemoveListing,
  };
};
