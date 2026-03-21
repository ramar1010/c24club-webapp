import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useBoyfriendChallenge() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: boyfriendPair, isLoading } = useQuery({
    queryKey: ["boyfriend_pair", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("boyfriend_pairs" as any)
        .select("*")
        .or(`inviter_id.eq.${user!.id},invitee_id.eq.${user!.id}`)
        .in("status", ["pending", "active", "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: dailyLogs = [] } = useQuery({
    queryKey: ["boyfriend_daily_logs", boyfriendPair?.id],
    enabled: !!boyfriendPair?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("boyfriend_daily_logs" as any)
        .select("*")
        .eq("pair_id", boyfriendPair!.id)
        .order("day_number", { ascending: true });
      return (data || []) as any[];
    },
  });

  const generateInviteCode = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const code = `bf-${crypto.randomUUID().slice(0, 8)}`;
      const { error } = await supabase.from("boyfriend_pairs" as any).insert({
        inviter_id: user.id,
        invite_code: code,
        status: "pending",
      } as any);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["boyfriend_pair"] });
      toast.success("Boyfriend invite link created!");
    } catch (err: any) {
      toast.error("Failed to create invite", { description: err.message });
    }
    setGenerating(false);
  };

  const boyfriendLink = boyfriendPair?.invite_code
    ? `${window.location.origin}/?boyfriend=${boyfriendPair.invite_code}`
    : null;

  const copyLink = () => {
    if (!boyfriendLink) return;
    navigator.clipboard.writeText(boyfriendLink);
    setCopied(true);
    toast.success("Boyfriend invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const uploadProofSelfie = async (file: File) => {
    if (!user || !boyfriendPair) return;
    try {
      const path = `${user.id}/bf_proof_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("member-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("member-photos").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("boyfriend_pairs" as any)
        .update({ proof_selfie_url: urlData.publicUrl } as any)
        .eq("id", boyfriendPair.id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["boyfriend_pair"] });
      toast.success("Dating proof selfie uploaded!");
    } catch (err: any) {
      toast.error("Failed to upload selfie", { description: err.message });
    }
  };

  const hasPair = !!boyfriendPair;
  const pairActive = boyfriendPair?.status === "active";
  const pairCompleted = boyfriendPair?.status === "completed";
  const waitingForBoyfriend = boyfriendPair?.status === "pending" && !boyfriendPair?.invitee_id;
  const hasProofSelfie = !!boyfriendPair?.proof_selfie_url;

  return {
    boyfriendPair,
    dailyLogs,
    isLoading,
    generating,
    copied,
    boyfriendLink,
    hasPair,
    pairActive,
    pairCompleted,
    waitingForBoyfriend,
    hasProofSelfie,
    generateInviteCode,
    copyLink,
    uploadProofSelfie,
  };
}
