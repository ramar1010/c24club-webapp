import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Heart, Camera, Sparkles, DollarSign, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SelfieCaptureModal from "@/components/discover/SelfieCaptureModal";

interface DiscoverableMember {
  id: string;
  name: string;
  image_url: string | null;
  gender: string | null;
  country: string | null;
  last_active_at: string | null;
}

const DiscoverPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<DiscoverableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [myInterests, setMyInterests] = useState<Set<string>>(new Set());
  const [showSelfie, setShowSelfie] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [sendingInterest, setSendingInterest] = useState<string | null>(null);

  // Check if user is discoverable & load members
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Check own discoverability
      const { data: me } = await supabase
        .from("members")
        .select("is_discoverable, image_url")
        .eq("id", user.id)
        .single();

      setIsDiscoverable(!!me?.is_discoverable && !!me?.image_url);

      // Load discoverable members (excluding self)
      const { data: membersList } = await supabase
        .from("members")
        .select("id, name, image_url, gender, country, last_active_at")
        .eq("is_discoverable", true)
        .filter("image_status", "eq", "approved")
        .neq("id", user.id)
        .order("last_active_at", { ascending: false })
        .limit(50);

      setMembers(membersList || []);

      // Load my existing interests
      const { data: interests } = await supabase
        .from("member_interests")
        .select("interested_in_user_id")
        .eq("user_id", user.id);

      setMyInterests(new Set((interests || []).map((i: any) => i.interested_in_user_id)));
      setLoading(false);
    };

    load();
  }, [user]);

  const handleInterest = useCallback(async (targetId: string) => {
    if (!user) return;
    setSendingInterest(targetId);

    try {
      const { error } = await supabase.from("member_interests").insert({
        user_id: user.id,
        interested_in_user_id: targetId,
      });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already sent!", description: "You've already expressed interest." });
        } else {
          throw error;
        }
      } else {
        setMyInterests((prev) => new Set([...prev, targetId]));

        // Trigger notification email
        supabase.functions.invoke("notify-interest", {
          body: { interested_user_id: user.id, target_user_id: targetId },
        });

        toast({ title: "Interest sent! 💌", description: "We'll let them know you want to connect." });
      }
    } catch (err: any) {
      toast({ title: "Oops", description: err.message, variant: "destructive" });
    } finally {
      setSendingInterest(null);
    }
  }, [user]);

  const handleSelfieComplete = (imageUrl: string) => {
    setShowSelfie(false);
    setIsDiscoverable(true);
  };

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

  const getTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Recently";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 5) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

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

      {/* Not discoverable banner */}
      {!isDiscoverable && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30">
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-pink-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white mb-1">Get discovered!</h3>
              <p className="text-white/70 text-sm mb-3">
                Take a quick selfie to let others find you. We'll email you when someone wants to connect — <span className="text-pink-300 font-semibold">females can earn cash</span> by chatting!
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
            {members.map((member) => {
              const alreadyInterested = myInterests.has(member.id);
              const isFemale = member.gender?.toLowerCase() === "female";
              return (
                <div
                  key={member.id}
                  className="relative group rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                >
                  {/* Photo */}
                  <div className="aspect-[3/4] overflow-hidden">
                    {member.image_url ? (
                      <img
                        src={member.image_url}
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 text-4xl font-bold">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-10">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="font-bold text-white text-sm truncate">{member.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {member.country && (
                            <span className="text-white/50 text-xs">{member.country}</span>
                          )}
                          <span className="text-emerald-400 text-xs">
                            {getTimeAgo(member.last_active_at)}
                          </span>
                        </div>
                        {isFemale && (
                          <div className="flex items-center gap-1 mt-1 text-emerald-400 text-xs">
                            <DollarSign className="w-3 h-3" />
                            <span>Earns by chatting</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => !alreadyInterested && handleInterest(member.id)}
                        disabled={alreadyInterested || sendingInterest === member.id}
                        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          alreadyInterested
                            ? "bg-pink-500 text-white"
                            : "bg-white/15 hover:bg-pink-500 text-white/70 hover:text-white"
                        }`}
                      >
                        {sendingInterest === member.id ? (
                          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Heart
                            className={`w-5 h-5 ${alreadyInterested ? "fill-current" : ""}`}
                          />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SelfieCaptureModal
        open={showSelfie}
        onClose={() => setShowSelfie(false)}
        onComplete={handleSelfieComplete}
      />
    </div>
  );
};

export default DiscoverPage;
