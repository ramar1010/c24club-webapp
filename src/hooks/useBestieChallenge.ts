import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useBestieChallenge() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch user's active bestie pair (as inviter or invitee)
  const { data: bestiePair, isLoading } = useQuery({
    queryKey: ["bestie_pair", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bestie_pairs")
        .select("*")
        .or(`inviter_id.eq.${user!.id},invitee_id.eq.${user!.id}`)
        .in("status", ["pending", "active", "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Fetch daily logs for the active pair
  const { data: dailyLogs = [] } = useQuery({
    queryKey: ["bestie_daily_logs", bestiePair?.id],
    enabled: !!bestiePair?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("bestie_daily_logs")
        .select("*")
        .eq("pair_id", bestiePair!.id)
        .order("day_number", { ascending: true });
      return data || [];
    },
  });

  const generateInviteCode = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const code = `bestie-${crypto.randomUUID().slice(0, 8)}`;
      const { error } = await supabase.from("bestie_pairs").insert({
        inviter_id: user.id,
        invite_code: code,
        status: "pending",
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["bestie_pair"] });
      toast.success("Bestie invite link created!");
    } catch (err: any) {
      toast.error("Failed to create invite", { description: err.message });
    }
    setGenerating(false);
  };

  const bestieLink = bestiePair?.invite_code
    ? `${window.location.origin}/?bestie=${bestiePair.invite_code}`
    : null;

  const copyLink = () => {
    if (!bestieLink) return;
    navigator.clipboard.writeText(bestieLink);
    setCopied(true);
    toast.success("Bestie link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const isInviter = bestiePair?.inviter_id === user?.id;
  const hasPair = !!bestiePair;
  const pairActive = bestiePair?.status === "active";
  const pairCompleted = bestiePair?.status === "completed";
  const waitingForBestie = bestiePair?.status === "pending" && !bestiePair?.invitee_id;

  return {
    bestiePair,
    dailyLogs,
    isLoading,
    generating,
    copied,
    bestieLink,
    isInviter,
    hasPair,
    pairActive,
    pairCompleted,
    waitingForBestie,
    generateInviteCode,
    copyLink,
  };
}
