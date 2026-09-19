import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { ArrowLeft, Camera, Trash2, MessageSquare, Loader2, DollarSign, Shuffle, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDiscover } from "@/hooks/useDiscover";
import { useUnreadCount } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import SelfieCaptureModal from "@/components/discover/SelfieCaptureModal";
import DiscoverFilters from "@/components/discover/DiscoverFilters";
import DiscoverMemberCard from "@/components/discover/DiscoverMemberCard";
import DiscoverRewardCard, { useDiscoverRewards } from "@/components/discover/DiscoverRewardCard";

import DiscoverProfileEditor from "@/components/discover/DiscoverProfileEditor";
import IncomingInterests from "@/components/discover/IncomingInterests";
import ReadyToChatCard from "@/components/discover/ReadyToChatCard";
import RechargeGate from "@/components/discover/RechargeGate";
import MessagesPage from "@/pages/public/MessagesPage";
import CashoutModal from "@/components/discover/CashoutModal";
import { useRechargeMinutes } from "@/hooks/useRechargeMinutes";
const DiscoverPage = () => {
  const navigate = useNavigate();
  const {
    user, members, allMembers, loading, loadingMore, hasMore, loadMore,
    myInterests, incomingInterestsList, isDiscoverable, setIsDiscoverable,
    myGender, sendingInterest, filters, setFilters, countries, mutualSocials, linkedProfiles, adminUserIds, vipUserIds, modUserIds,
    isMutualMatch, handleInterest, handleRemoveListing,
  } = useDiscover();
  const { data: unreadDmCount = 0 } = useUnreadCount();
  const [showSelfie, setShowSelfie] = useState(false);
  const [showMessages, setShowMessages] = useState<string | null>(null);
  const [showCashout, setShowCashout] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { data: rechargeMinutes = 0 } = useRechargeMinutes(user?.id ?? null);
  const { data: inlineRewards = [] } = useDiscoverRewards(myGender);


  const { user: authUser } = useAuth();
  const { data: minutesData, refetch: refetchMinutes } = useQuery({
    queryKey: ["cashout-minutes-discover", authUser?.id],
    enabled: !!authUser,
    queryFn: async () => {
      const { data } = await supabase
        .from("member_minutes")
        .select("total_minutes, gifted_minutes")
        .eq("user_id", authUser!.id)
        .single();
      return data || { total_minutes: 0, gifted_minutes: 0 };
    },
  });

  const handleSelfieComplete = () => {
    setShowSelfie(false);
    setIsDiscoverable(true);
  };

  const shuffledMembers = useMemo(() => {
    if (shuffleSeed === 0) return members;
    const arr = [...members];
    let seed = shuffleSeed;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 16807) % 2147483647;
      const j = seed % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [members, shuffleSeed]);

  const handleShuffle = useCallback(() => {
    setIsShuffling(true);
    setTimeout(() => {
      setShuffleSeed(Date.now());
      setIsShuffling(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 400);
  }, []);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  if (showMessages !== null) {
    return <MessagesPage onClose={() => setShowMessages(null)} initialPartnerId={showMessages || undefined} />;
  }

  return (
    <div className="min-h-screen bg-[#111] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#111]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          <button onClick={() => navigate(-1)} className="text-white/60 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Discover People</h1>
            <p className="text-white/50 text-xs">Find people who want to video chat</p>
          </div>
        </div>
      </div>

      {/* Compact account actions */}
      <div className="flex items-center gap-2 overflow-x-auto px-3 pt-3 sm:px-4">
        <button
          onClick={() => setShowMessages("")}
          className="relative flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/15 px-3 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/25"
        >
          <MessageSquare className="h-4 w-4" />
          DMs
          {unreadDmCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadDmCount > 9 ? "9+" : unreadDmCount}
            </span>
          )}
        </button>
        {myGender === "male" && (
          <button
            onClick={() => setShowRecharge(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
          >
            <Phone className="h-4 w-4" />
            Refill · {rechargeMinutes}
          </button>
        )}
          {(minutesData?.gifted_minutes ?? 0) > 0 && (
            <button
              onClick={() => setShowCashout(true)}
              className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
            >
              <DollarSign className="h-4 w-4" />
              Cash Out
            </button>
          )}
          {!isDiscoverable ? (
            <button
              onClick={() => setShowSelfie(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-pink-500 px-3 text-xs font-semibold text-white transition-colors hover:bg-pink-600"
            >
              <Camera className="h-4 w-4" />
              Get Listed
            </button>
          ) : (
            <button
              onClick={handleRemoveListing}
              className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          )}
      </div>

      {user && <ReadyToChatCard userId={user.id} enabled={isDiscoverable} />}

      {/* Compact selfie setup for members who are not listed yet */}
      {!isDiscoverable && (
        <div className="mx-3 mt-2 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 sm:mx-4">
          <Camera className="h-4 w-4 shrink-0 text-pink-300" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white">Add your Discover selfie</p>
            <p className="truncate text-[11px] text-white/45">An approved photo lets people find you.</p>
          </div>
          <button onClick={() => setShowSelfie(true)} className="h-8 shrink-0 rounded-md bg-pink-500 px-3 text-xs font-bold text-white hover:bg-pink-600">
            Take selfie
          </button>
        </div>
      )}

      {isDiscoverable && user && <DiscoverProfileEditor userId={user.id} />}

      <IncomingInterests
        interests={incomingInterestsList}
        myInterests={myInterests}
        onInterestBack={handleInterest}
        sendingInterest={sendingInterest}
        onOpenDm={(memberId) => setShowMessages(memberId)}
      />

      {/* Filters */}
      {!loading && allMembers.length > 0 && (
        <DiscoverFilters
          filters={filters}
          onFilterChange={setFilters}
          countries={countries}
          totalCount={allMembers.length}
          filteredCount={members.length}
          linkedCount={linkedProfiles.size}
        />
      )}

      {/* Members grid */}
      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16">
            <Camera className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <h3 className="text-white/60 font-medium mb-1">No one here yet</h3>
            <p className="text-white/40 text-sm">Be the first to get listed!</p>
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 transition-all duration-300 ${isShuffling ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
              {shuffledMembers.map((member, idx) => {
                const rewardIdx = Math.floor(idx / 6);
                const showReward = idx > 0 && idx % 6 === 0 && inlineRewards.length > 0;
                return (
                  <Fragment key={member.id}>
                    {showReward && (
                      <DiscoverRewardCard
                        reward={inlineRewards[(rewardIdx - 1) % inlineRewards.length]}

                      />
                    )}
                    <DiscoverMemberCard
                      key={member.id}
                      member={member}
                      alreadyInterested={myInterests.has(member.id)}
                      isMutualMatch={isMutualMatch(member.id)}
                      sendingInterest={sendingInterest === member.id}
                      mutualSocials={mutualSocials.get(member.id)}
                      onInterest={handleInterest}
                      myGender={myGender}
                      isOwner={adminUserIds.has(member.id)}
                      isVip={vipUserIds.has(member.id)}
                      isModerator={modUserIds.has(member.id)}
                      isSelf={member.id === user?.id}
                      linkedExpiresAt={linkedProfiles.get(member.id) ?? null}
                    />
                  </Fragment>

                );
              })}
            </div>


            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="py-6 flex justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-white/40 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading more...
                </div>
              )}
              {!hasMore && members.length > 0 && (
                <p className="text-white/30 text-xs">You've seen everyone 🎉</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating Shuffle Button */}
      {members.length > 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={handleShuffle}
            disabled={isShuffling}
            className="group relative flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-70"
          >
            <Shuffle className={`w-4 h-4 transition-transform duration-500 ${isShuffling ? 'animate-spin' : 'group-hover:rotate-180'}`} />
            Shuffle
            <span className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      )}

      <SelfieCaptureModal open={showSelfie} onClose={() => setShowSelfie(false)} onComplete={handleSelfieComplete} />

      {showCashout && (
        <CashoutModal
          onClose={() => setShowCashout(false)}
          currentMinutes={minutesData?.total_minutes ?? 0}
          giftedMinutes={minutesData?.gifted_minutes ?? 0}
          onSuccess={() => refetchMinutes()}
        />
      )}
      {showRecharge && <RechargeGate balance={rechargeMinutes} onClose={() => setShowRecharge(false)} />}
    </div>
  );
};

export default DiscoverPage;
