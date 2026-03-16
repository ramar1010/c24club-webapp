import { useEffect, useState, useCallback } from "react";
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

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export const isOnlineNow = (lastActive: string | null) => {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < ONLINE_THRESHOLD_MS;
};

export const isNewListing = (createdAt: string) => {
  return Date.now() - new Date(createdAt).getTime() < 48 * 60 * 60 * 1000; // 48 hours
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
  const [members, setMembers] = useState<DiscoverableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [myInterests, setMyInterests] = useState<Map<string, string | null>>(new Map());
  const [interestedInMe, setInterestedInMe] = useState<Set<string>>(new Set());
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [myGender, setMyGender] = useState<string | null>(null);
  const [sendingInterest, setSendingInterest] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoverFilter>({ gender: "all", country: "", onlineOnly: false });
  const [mutualSocials, setMutualSocials] = useState<Map<string, string[]>>(new Map());
  const [countries, setCountries] = useState<string[]>([]);

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

      // Fetch discoverable members
      const { data: membersList } = await supabase
        .from("members")
        .select("id, name, image_url, gender, country, last_active_at, bio, created_at")
        .eq("is_discoverable", true)
        .filter("image_status", "eq", "approved")
        .neq("id", user.id)
        .order("last_active_at", { ascending: false })
        .limit(100);

      const list = (membersList || []) as DiscoverableMember[];
      setMembers(list);

      // Extract unique countries
      const uniqueCountries = [...new Set(list.map(m => m.country).filter(Boolean))] as string[];
      setCountries(uniqueCountries.sort());

      // Fetch my interests (with icebreaker)
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
        .select("user_id")
        .eq("interested_in_user_id", user.id);

      const incomingSet = new Set((incomingInterests || []).map((i: any) => i.user_id));
      setInterestedInMe(incomingSet);

      // For mutual matches, load their pinned socials
      const mutualIds = [...interestsMap.keys()].filter(id => incomingSet.has(id));
      if (mutualIds.length > 0) {
        const { data: socials } = await supabase
          .from("vip_settings")
          .select("user_id, pinned_socials")
          .in("user_id", mutualIds);

        const socialsMap = new Map<string, string[]>();
        (socials || []).forEach((s: any) => {
          if (s.pinned_socials?.length) socialsMap.set(s.user_id, s.pinned_socials);
        });
        setMutualSocials(socialsMap);
      }

      setLoading(false);
    };

    load();
  }, [user]);

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

        // Check for mutual match
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

  const filteredMembers = members.filter(m => {
    if (filters.gender !== "all" && m.gender?.toLowerCase() !== filters.gender) return false;
    if (filters.country && m.country !== filters.country) return false;
    if (filters.onlineOnly && !isOnlineNow(m.last_active_at)) return false;
    return true;
  });

  return {
    user,
    members: filteredMembers,
    allMembers: members,
    loading,
    myInterests,
    interestedInMe,
    isDiscoverable,
    setIsDiscoverable,
    myGender,
    sendingInterest,
    filters,
    setFilters,
    countries,
    mutualSocials,
    isMutualMatch,
    handleInterest,
    handleRemoveListing,
  };
};
