import { useState } from "react";
import { Camera, Sparkles, Users, Trash2 } from "lucide-react";
import { useDiscover } from "@/hooks/useDiscover";
import SelfieCaptureModal from "@/components/discover/SelfieCaptureModal";
import DiscoverFilters from "@/components/discover/DiscoverFilters";
import DiscoverMemberCard from "@/components/discover/DiscoverMemberCard";
import DiscoverProfileEditor from "@/components/discover/DiscoverProfileEditor";

interface DiscoverOverlayContentProps {
  onClose?: () => void;
}

const DiscoverOverlayContent = ({ onClose }: DiscoverOverlayContentProps) => {
  const {
    members, allMembers, loading, myInterests, isDiscoverable, setIsDiscoverable,
    myGender, sendingInterest, filters, setFilters, countries, mutualSocials,
    isMutualMatch, handleInterest, handleRemoveListing,
  } = useDiscover();
  const [showSelfie, setShowSelfie] = useState(false);

  const handleSelfieComplete = () => {
    setShowSelfie(false);
    setIsDiscoverable(true);
  };

  return (
    <div className="min-h-full bg-[#111] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#111]/95 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-pink-400" />
          <div className="flex-1">
            <h1 className="font-bold text-lg">Discover People</h1>
            <p className="text-white/50 text-xs">Browse while you wait for a match</p>
          </div>
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
