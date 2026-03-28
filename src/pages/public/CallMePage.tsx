import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Phone, MessageCircle, ArrowLeft } from "lucide-react";

interface CallMeProfile {
  id: string;
  name: string;
  bio: string | null;
  image_url: string | null;
  last_active_at: string | null;
  gender: string | null;
}

function getOnlineStatus(lastActive: string | null): { label: string; color: string } {
  if (!lastActive) return { label: "Offline", color: "bg-zinc-500" };
  const diff = Date.now() - new Date(lastActive).getTime();
  if (diff < 10 * 60 * 1000) return { label: "Online", color: "bg-emerald-500" };
  if (diff < 60 * 60 * 1000) return { label: "Away", color: "bg-yellow-500" };
  return { label: "Offline", color: "bg-zinc-500" };
}

export default function CallMePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CallMeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, name, bio, image_url, last_active_at, gender")
        .eq("call_slug", slug)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setProfile(data as CallMeProfile);
      }
      setLoading(false);
    })();
  }, [slug]);

  const handleCall = async () => {
    if (!user) {
      navigate(`/?returnTo=/call/${slug}`);
      return;
    }
    if (!profile) return;
    if (user.id === profile.id) {
      toast.error("You can't call yourself!");
      return;
    }

    setCalling(true);

    // Create a direct call invite
    const { error } = await supabase.from("direct_call_invites").insert({
      inviter_id: user.id,
      invitee_id: profile.id,
    });

    if (error) {
      toast.error("Failed to send call invite", { description: error.message });
      setCalling(false);
      return;
    }

    // Send push notification
    supabase.functions
      .invoke("notify-direct-call", {
        body: { inviterId: user.id, inviteeId: profile.id },
      })
      .catch(() => {});

    toast.success(`📹 Call invite sent to ${profile.name}!`, {
      description: "They'll be notified. Head to the video call page to connect.",
    });

    // Navigate to videocall page
    navigate("/videocall");
  };

  const handleDm = async () => {
    if (!user) {
      navigate(`/?returnTo=/call/${slug}`);
      return;
    }
    if (!profile) return;
    navigate(`/messages?dm=${profile.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center text-white px-4">
        <p className="text-xl font-bold mb-2">User not found</p>
        <p className="text-white/60 text-sm mb-6">This Call Me link doesn't exist or has been removed.</p>
        <button onClick={() => navigate("/")} className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors">
          Go Home
        </button>
      </div>
    );
  }

  const status = getOnlineStatus(profile.last_active_at);

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center px-4">
      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 text-white/60 hover:text-white transition-colors flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Home
      </button>

      {/* Profile Card */}
      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden">
        {/* Header gradient */}
        <div className="h-20 bg-gradient-to-r from-emerald-600/40 to-teal-600/40" />

        {/* Avatar */}
        <div className="flex flex-col items-center -mt-10 px-6 pb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-zinc-900 overflow-hidden bg-zinc-800">
              {profile.image_url ? (
                <img src={profile.image_url} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-emerald-400">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {/* Online indicator */}
            <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-zinc-900 ${status.color}`} />
          </div>

          <h1 className="text-white text-xl font-bold mt-3">{profile.name}</h1>
          <span className={`text-xs font-medium mt-1 ${status.label === "Online" ? "text-emerald-400" : status.label === "Away" ? "text-yellow-400" : "text-white/40"}`}>
            {status.label}
          </span>

          {profile.bio && (
            <p className="text-white/60 text-sm text-center mt-3 line-clamp-3">{profile.bio}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-6 w-full">
            <button
              onClick={handleCall}
              disabled={calling}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-70 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              <Phone className="w-5 h-5" />
              {calling ? "Sending..." : "Call Now"}
            </button>
            <button
              onClick={handleDm}
              className="flex items-center justify-center px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>

          {!user && (
            <p className="text-white/40 text-xs text-center mt-3">
              You'll need to sign in to call or message
            </p>
          )}
        </div>
      </div>

      {/* Branding */}
      <p className="text-white/30 text-xs mt-6">
        Powered by <span className="text-white/50 font-medium">C24 Club</span>
      </p>
    </div>
  );
}
