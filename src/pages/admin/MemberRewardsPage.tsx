import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

type MemberRedemption = {
  id: string;
  user_id: string;
  reward_title: string;
  reward_rarity: string;
  reward_type: string;
  minutes_cost: number;
  status: string;
  shipping_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  shipping_tracking_url: string | null;
  address_exists: string | null;
  notes: string | null;
  created_at: string;
  members: { name: string; email: string | null } | null;
};

const STATUS_COLORS: Record<string, string> = {
  "pending_shipping": "bg-yellow-500/10 text-yellow-600",
  "pending_payment": "bg-orange-500/10 text-orange-600",
  "processing": "bg-blue-500/10 text-blue-600",
  "Redeemed Milestone Reward": "bg-purple-500/10 text-purple-600",
  "Order placed": "bg-cyan-500/10 text-cyan-600",
  "Order shipped": "bg-green-500/10 text-green-600",
  "Item Out of stock": "bg-red-500/10 text-red-600",
  "Gift Card Form Filled by user": "bg-indigo-500/10 text-indigo-600",
  "Gift Card Sent on Email": "bg-emerald-500/10 text-emerald-600",
  "Redeemed Product Point Reward": "bg-violet-500/10 text-violet-600",
  "Redeemed VIP Gift Reward": "bg-amber-500/10 text-amber-600",
  "Redeemed as Anchor User Reward": "bg-teal-500/10 text-teal-600",
};

const columns: DataTableColumn<MemberRedemption>[] = [
  {
    key: "id",
    header: "ID",
    className: "w-20",
    render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span>,
  },
  {
    key: "members",
    header: "Member",
    render: (row) => (
      <div>
        <div className="font-medium">{row.members?.name || "Unknown"}</div>
        <div className="text-xs text-muted-foreground">{row.members?.email || row.user_id.slice(0, 8)}</div>
      </div>
    ),
  },
  { key: "reward_title", header: "Reward" },
  {
    key: "minutes_cost",
    header: "Cost",
    render: (row) => <span className="font-bold">{row.minutes_cost} min</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <Badge className={`text-xs ${STATUS_COLORS[row.status] || "bg-muted text-muted-foreground"}`}>
        {row.status}
      </Badge>
    ),
  },
  {
    key: "shipping_country",
    header: "Country",
    render: (row) => row.shipping_country || <span className="text-muted-foreground">—</span>,
  },
  {
    key: "created_at",
    header: "Date",
    render: (row) => new Date(row.created_at).toLocaleDateString(),
  },
];

const MemberRewardsPage = () => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["admin_member_redemptions"],
    queryFn: async () => {
      // member_redemptions.user_id references auth.users, not members table directly
      // So we fetch redemptions first, then enrich with member data
      const { data: redemptions, error } = await supabase
        .from("member_redemptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get unique user_ids and fetch member info
      const userIds = [...new Set((redemptions || []).map(r => r.user_id))];
      const { data: members } = await supabase
        .from("members")
        .select("id, name, email")
        .in("id", userIds);

      const memberMap = new Map((members || []).map(m => [m.id, m]));
      return (redemptions || []).map(r => ({
        ...r,
        members: memberMap.get(r.user_id) || null,
      })) as MemberRedemption[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">All Member Rewards</h2>
        <p className="text-muted-foreground mt-1">
          {isLoading ? "Loading..." : `${data?.length ?? 0} redemptions total.`}
        </p>
      </div>

      <DataTable
        data={data ?? []}
        columns={columns}
        searchKeys={["reward_title", "status"]}
        actions={(row) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(`/admin/member-rewards/${row.id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      />
    </div>
  );
};

export default MemberRewardsPage;
