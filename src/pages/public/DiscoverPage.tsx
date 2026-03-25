import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Camera, Sparkles, Trash2, MessageSquare, Loader2, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDiscover } from "@/hooks/useDiscover";
import { useUnreadCount } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import SelfieCaptureModal from "@/components/discover/SelfieCaptureModal";
import DiscoverFilters from "@/components/discover/DiscoverFilters";
import DiscoverMemberCard from "@/components/discover/DiscoverMemberCard";
import DiscoverProfileEditor from "@/components/discover/DiscoverProfileEditor";
import IncomingInterests from "@/components/discover/IncomingInterests";
import MessagesPage from "@/pages/public/MessagesPage";
import CashoutModal from "@/components/discover/CashoutModal";
import { useVipStatus } from "@/hooks/useVipStatus";
const DiscoverPage = () => {
  const navigate = useNavigate();
  const {
    user, members, allMembers, loading, loadingMore, hasMore, loadMore,
    myInterests, incomingInterestsList, isDiscoverable, setIsDiscoverable,
    myGender, sendingInterest, filters, setFilters, countries, mutualSocials, adminUserIds, vipUserIds, modUserIds,
    isMutualMatch, handleInterest, handleRemoveListing,
  } = useDiscover();
  const { data: unreadDmCount = 0 } = useUnreadCount();
  const [showSelfie, setShowSelfie] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showCashout, setShowCashout] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { startCheckout } = useVipStatus(user?.id ?? null);

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

  if (showMessages) {
    return <MessagesPage onClose={() => setShowMessages(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#111] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#111]/95 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-white/60 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Discover People</h1>
            <p className="text-white/50 text-xs">Find people who want to video chat</p>
          </div>
          {/* Cash Out button */}
          {(minutesData?.gifted_minutes ?? 0) > 0 && (
            <button
              onClick={() => setShowCashout(true)}
              className="flex items-center gap-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-semibold px-2.5 py-2 rounded-lg transition-colors border border-emerald-500/30"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cash Out</span>
            </button>
          )}
          {/* DMs button */}
          <button
            onClick={() => setShowMessages(true)}
            className="relative flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-semibold px-3 py-2 rounded-lg transition-colors border border-blue-500/30"
          >
            <MessageSquare className="w-4 h-4" />
            DMs
            {unreadDmCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadDmCount > 9 ? "9+" : unreadDmCount}
              </span>
            )}
          </button>
          {!isDiscoverable ? (
            <button
              onClick={() => setShowSelfie(true)}
              className="flex items-center gap-1.5 bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <Camera className="w-4 h-4" />
              Get Listed
            </button>
          ) : (
            <button
              onClick={handleRemoveListing}
              className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-semibold px-3 py-2 rounded-lg transition-colors border border-red-500/30"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Female VIP promo banner */}
      {myGender === "female" && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 shadow-lg shadow-pink-500/20 animate-pulse-slow">
          <div className="flex items-center gap-2">
            <span className="text-lg">👑</span>
            <p className="text-white text-sm font-bold leading-snug">
              Get noticed & gifted by thousands of guys — stay at the top of the Discover page with{" "}
              <span className="text-yellow-200 underline underline-offset-2">VIP starting at $2.49/week!</span>
            </p>
            <Sparkles className="w-5 h-5 text-yellow-200 shrink-0" />
          </div>
        </div>
      )}

      {/* Not discoverable banner */}
      {!isDiscoverable && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30">
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-pink-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white mb-1">Get discovered!</h3>
              <p className="text-white/70 text-sm mb-3">
                Take a quick selfie to let others find you. We'll email you when someone wants to connect
                {myGender === "female" ? <> — <span className="text-pink-300 font-semibold">earn cash</span> by chatting!</> : <>!</>}
              </p>
              <button
                onClick={() => setShowSelfie(true)}
                className="bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
              >
                📸 Take Selfie & Get Listed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {!loading && allMembers.length > 0 && (
        <DiscoverFilters
          filters={filters}
          onFilterChange={setFilters}
          countries={countries}
          totalCount={allMembers.length}
          filteredCount={members.length}
        />
      )}

      {/* Profile editor (for discoverable users) */}
      {isDiscoverable && user && <DiscoverProfileEditor userId={user.id} />}

      {/* Incoming interests */}
      <IncomingInterests
        interests={incomingInterestsList}
        myInterests={myInterests}
        onInterestBack={(id) => handleInterest(id)}
        sendingInterest={sendingInterest}
      />

      {/* Members grid */}
      <div className="p-4">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {members.map((member) => (
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
                />
              ))}
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

      <SelfieCaptureModal open={showSelfie} onClose={() => setShowSelfie(false)} onComplete={handleSelfieComplete} />

      {showCashout && (
        <CashoutModal
          onClose={() => setShowCashout(false)}
          currentMinutes={minutesData?.total_minutes ?? 0}
          giftedMinutes={minutesData?.gifted_minutes ?? 0}
          onSuccess={() => refetchMinutes()}
        />
      )}
    </div>
  );
};

export default DiscoverPage;
