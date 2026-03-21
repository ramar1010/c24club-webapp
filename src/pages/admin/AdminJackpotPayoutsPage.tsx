import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trophy, CheckCircle, XCircle, DollarSign, Clock } from "lucide-react";

const AdminJackpotPayoutsPage = () => {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState<string | null>(null);

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["jackpot-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jackpot_payouts" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, name, email");
      return data ?? [];
    },
  });

  const getMember = (userId: string) =>
    members?.find((m: any) => m.id === userId);

  const handleAction = async (id: string, action: "paid" | "rejected") => {
    setProcessing(id);
    try {
      const { error } = await supabase
        .from("jackpot_payouts" as any)
        .update({
          status: action,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success(`Payout ${action === "paid" ? "marked as paid" : "rejected"}`);
      queryClient.invalidateQueries({ queryKey: ["jackpot-payouts"] });
    } catch (e: any) {
      toast.error(e.message);
    }
    setProcessing(null);
  };

  const statusColor = (s: string) => {
    if (s === "paid") return "bg-green-600";
    if (s === "rejected") return "bg-red-600";
    return "bg-yellow-600";
  };

  const pendingCount = payouts?.filter((p) => p.status === "pending").length ?? 0;
  const totalPaid = payouts?.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.jackpot_amount), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-400" /> Jackpot Payouts
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Review and process jackpot winner payouts
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#232323] border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-xs text-white/50">Pending</p>
              <p className="text-2xl font-bold text-white">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#232323] border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-xs text-white/50">Total Paid Out</p>
              <p className="text-2xl font-bold text-white">${totalPaid.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#232323] border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-purple-400" />
            <div>
              <p className="text-xs text-white/50">Total Jackpots</p>
              <p className="text-2xl font-bold text-white">{payouts?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payouts List */}
      <Card className="bg-[#232323] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-lg">All Jackpot Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-white/50 text-center py-8">Loading...</p>
          ) : !payouts?.length ? (
            <p className="text-white/50 text-center py-8">No jackpot payouts yet</p>
          ) : (
            <div className="space-y-3">
              {payouts.map((p: any) => {
                const member = getMember(p.user_id);
                return (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-[#1a1a1a] border border-white/5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">
                          {member?.name ?? "Unknown"}
                        </span>
                        <span className="text-xs text-white/40">
                          {member?.email ?? p.user_id}
                        </span>
                        <Badge className={`${statusColor(p.status)} text-white text-xs`}>
                          {p.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-white/60">
                        <span>💰 ${Number(p.jackpot_amount).toFixed(2)}</span>
                        <span>⏱ {p.minutes_credited} mins credited</span>
                        <span>
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {p.paypal_email && (
                        <p className="text-xs text-blue-400 mt-1">
                          PayPal: {p.paypal_email}
                        </p>
                      )}
                    </div>

                    {p.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={processing === p.id}
                          onClick={() => handleAction(p.id, "paid")}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Paid
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={processing === p.id}
                          onClick={() => handleAction(p.id, "rejected")}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminJackpotPayoutsPage;
