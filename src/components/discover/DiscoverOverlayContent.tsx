import { useState, useMemo, useCallback } from "react";
import { Camera, Sparkles, Users, Trash2, MessageSquare, Shuffle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDiscover } from "@/hooks/useDiscover";
import { useUnreadCount } from "@/hooks/useMessages";
import SelfieCaptureModal from "@/components/discover/SelfieCaptureModal";
import DiscoverFilters from "@/components/discover/DiscoverFilters";
import DiscoverMemberCard from "@/components/discover/DiscoverMemberCard";
import DiscoverProfileEditor from "@/components/discover/DiscoverProfileEditor";
import IncomingInterests from "@/components/discover/IncomingInterests";
import MessagesPage from "@/pages/public/MessagesPage";

interface DiscoverOverlayContentProps {
  onClose?: () => void;
}

const DiscoverOverlayContent = ({ onClose }: DiscoverOverlayContentProps) => {
  const {
    user, members, allMembers, loading, myInterests, incomingInterestsList, isDiscoverable, setIsDiscoverable,
    myGender, sendingInterest, filters, setFilters, countries, mutualSocials,
    isMutualMatch, handleInterest, handleRemoveListing,
  } = useDiscover();
  const { data: unreadDmCount = 0 } = useUnreadCount();
  const [showSelfie, setShowSelfie] = useState(false);
  const [showMessages, setShowMessages] = useState<string | null>(null);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);

  const shuffledMembers = useMemo(() => {
    if (shuffleSeed === 0) return members;
    const arr = [...members];
    // Fisher-Yates shuffle with deterministic seed
    let seed = shuffleSeed;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 16807 + 0) % 2147483647;
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
    }, 400);
  }, []);

  const handleSelfieComplete = () => {
    setShowSelfie(false);
    setIsDiscoverable(true);
  };

  if (showMessages !== null) {
    return <MessagesPage onClose={() => setShowMessages(null)} initialPartnerId={showMessages || undefined} />;
  }

  return (
    <div className="min-h-full bg-[#111] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#111]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base sm:text-lg">Discover</h1>
            <p className="text-white/50 text-[10px] sm:text-xs hidden sm:block">Browse while you wait for a match</p>
          </div>
          {/* DMs button */}
          <button
            onClick={() => setShowMessages("")}
            className="relative flex items-center gap-1 sm:gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors border border-blue-500/30"
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">DMs</span>
            {unreadDmCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadDmCount > 9 ? "9+" : unreadDmCount}
              </span>
            )}
          </button>
          {!isDiscoverable ? (
            <button
              onClick={() => setShowSelfie(true)}
              className="flex items-center gap-1 sm:gap-1.5 bg-pink-500 hover:bg-pink-600 text-white text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors"
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Get Listed</span>
              <span className="sm:hidden">List</span>
            </button>
          ) : (
            <button
              onClick={handleRemoveListing}
              className="flex items-center gap-1 sm:gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors border border-red-500/30"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Remove</span>
            </button>
          )}
        </div>
      </div>

      {/* Searching indicator */}
      <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <p className="text-emerald-300 text-sm font-medium">Still searching for a match — browse while you wait!</p>
      </div>

      {/* Not discoverable banner */}
      {!isDiscoverable && (
        <div className="mx-4 mt-3 p-4 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30">
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
        onOpenDm={(userId) => setShowMessages(userId)}
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
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 transition-opacity duration-300 ${isShuffling ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            {shuffledMembers.map((member) => (
              <DiscoverMemberCard
                key={member.id}
                member={member}
                alreadyInterested={myInterests.has(member.id)}
                isMutualMatch={isMutualMatch(member.id)}
                sendingInterest={sendingInterest === member.id}
                mutualSocials={mutualSocials.get(member.id)}
                onInterest={handleInterest}
                myGender={myGender}
                isSelf={member.id === user?.id}
              />
            ))}
          </div>
        )}
      </div>

      <SelfieCaptureModal open={showSelfie} onClose={() => setShowSelfie(false)} onComplete={handleSelfieComplete} />
    </div>
  );
};

export default DiscoverOverlayContent;
