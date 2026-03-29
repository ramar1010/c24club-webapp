import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Gift, ArrowRight } from "lucide-react";

const AdminGiftHistoryPage = () => {
  const [search, setSearch] = useState("");

  const { data: gifts = [], isLoading } = useQuery({
    queryKey: ["admin-gift-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gift_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch member names for all unique user ids
  const userIds = [...new Set(gifts.flatMap((g) => [g.sender_id, g.recipient_id]))];
  const { data: members = [] } = useQuery({
    queryKey: ["admin-gift-members", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, email")
        .in("id", userIds);
      return data ?? [];
    },
  });

  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));

  const getName = (id: string) => memberMap[id]?.name || id.slice(0, 8);
  const getEmail = (id: string) => memberMap[id]?.email || "";

  const filtered = gifts.filter((g) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      getName(g.sender_id).toLowerCase().includes(s) ||
      getName(g.recipient_id).toLowerCase().includes(s) ||
      getEmail(g.sender_id).toLowerCase().includes(s) ||
      getEmail(g.recipient_id).toLowerCase().includes(s) ||
      g.status.toLowerCase().includes(s)
    );
  });

  const totalCompleted = gifts.filter((g) => g.status === "completed").reduce((sum, g) => sum + g.price_cents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Gift History</h1>
        <p className="text-white/50 text-sm">Track all gift transactions between users</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-neutral-900 border-white/10">
          <CardContent className="pt-4 pb-4">
            <p className="text-white/50 text-xs">Total Gifts</p>
            <p className="text-2xl font-bold text-white">{gifts.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-white/10">
          <CardContent className="pt-4 pb-4">
            <p className="text-white/50 text-xs">Completed</p>
            <p className="text-2xl font-bold text-emerald-400">{gifts.filter((g) => g.status === "completed").length}</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-white/10">
          <CardContent className="pt-4 pb-4">
            <p className="text-white/50 text-xs">Total Revenue</p>
            <p className="text-2xl font-bold text-amber-400">${(totalCompleted / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          placeholder="Search by name, email, or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-neutral-900 border-white/10 text-white"
        />
      </div>

      {/* Table */}
      <Card className="bg-neutral-900 border-white/10">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-xs">
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Sender</th>
                  <th className="text-center p-3"></th>
                  <th className="text-left p-3">Recipient</th>
                  <th className="text-right p-3">Minutes</th>
                  <th className="text-right p-3">Price</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center text-white/40 py-8">Loading...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-white/40 py-8">No gift transactions found</td>
                  </tr>
                ) : (
                  filtered.map((g) => (
                    <tr key={g.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3 text-white/60 text-xs whitespace-nowrap">
                        {new Date(g.created_at).toLocaleDateString()}{" "}
                        {new Date(g.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-3">
                        <p className="text-white font-medium text-xs">{getName(g.sender_id)}</p>
                        <p className="text-white/40 text-[10px]">{getEmail(g.sender_id)}</p>
                      </td>
                      <td className="p-3 text-center">
                        <ArrowRight className="w-4 h-4 text-emerald-400 mx-auto" />
                      </td>
                      <td className="p-3">
                        <p className="text-white font-medium text-xs">{getName(g.recipient_id)}</p>
                        <p className="text-white/40 text-[10px]">{getEmail(g.recipient_id)}</p>
                      </td>
                      <td className="p-3 text-right text-white font-medium text-xs">{g.minutes_amount}</td>
                      <td className="p-3 text-right text-amber-400 font-bold text-xs">${(g.price_cents / 100).toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            g.status === "completed"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : g.status === "pending"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminGiftHistoryPage;
