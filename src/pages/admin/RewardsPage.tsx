import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { useRewards, useDeleteReward } from "@/hooks/useCrud";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import DeleteDialog from "@/components/admin/DeleteDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Reward = {
  id: string;
  title: string;
  type: string;
  rarity: string;
  minutes_cost: number;
  delivery: string;
  visible: boolean;
  info: string | null;
  target_gender: string | null;
  reward_categories: { name: string } | null;
};

const RARITY_COLORS: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  rare: "bg-blue-500/10 text-blue-500",
  legendary: "bg-amber-500/10 text-amber-500",
};

const rewardColumns: DataTableColumn<Reward>[] = [
  { key: "id", header: "ID", className: "w-20", render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span> },
  { key: "title", header: "Title" },
  { key: "type", header: "Type" },
  {
    key: "rarity",
    header: "Rarity",
    render: (row) => <Badge className={`text-xs ${RARITY_COLORS[row.rarity] || ""}`}>{row.rarity}</Badge>,
  },
  {
    key: "minutes_cost",
    header: "Cost (min)",
    render: (row) => <span className="font-bold">{row.minutes_cost}</span>,
  },
  { key: "delivery", header: "Delivery" },
  {
    key: "visible",
    header: "Visible",
    render: (row) => row.visible ? <Badge className="bg-green-500/10 text-green-600">Yes</Badge> : <Badge className="bg-muted text-muted-foreground">Hidden</Badge>,
  },
  {
    key: "reward_categories",
    header: "Category",
    render: (row) => row.reward_categories?.name || <span className="text-muted-foreground">—</span>,
  },
  {
    key: "target_gender",
    header: "Gender",
    render: (row) => row.target_gender
      ? <Badge className={row.target_gender === "female" ? "bg-pink-500/10 text-pink-500" : "bg-blue-500/10 text-blue-500"}>{row.target_gender}</Badge>
      : <span className="text-muted-foreground">Both</span>,
  },
];

const RewardsPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useRewards();
  const deleteMutation = useDeleteReward();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const toggleVisibility = async (reward: Reward) => {
    const { error } = await supabase
      .from("rewards")
      .update({ visible: !reward.visible })
      .eq("id", reward.id);
    if (error) {
      toast.error("Failed to update visibility");
    } else {
      toast.success(reward.visible ? "Product hidden from store" : "Product visible in store");
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Rewards</h2>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${data?.length ?? 0} rewards total.`}
          </p>
        </div>
        <Button onClick={() => navigate("/admin/rewards/new")}>
          <Gift className="mr-2 h-4 w-4" />
          Add New Reward
        </Button>
      </div>

      <DataTable
        data={(data as Reward[]) ?? []}
        columns={rewardColumns}
        searchKeys={["title", "type", "rarity"]}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={row.visible ? "Hide from store" : "Show in store"}
              onClick={() => toggleVisibility(row)}
            >
              {row.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/rewards/${row.id}/edit`)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(row.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      <DeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
        title="this reward"
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default RewardsPage;
