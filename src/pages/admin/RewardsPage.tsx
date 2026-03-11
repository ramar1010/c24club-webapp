import { useState } from "react";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { useRewards, useDeleteReward } from "@/hooks/useCrud";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Pencil, Trash2 } from "lucide-react";
import DeleteDialog from "@/components/admin/DeleteDialog";

type Reward = {
  id: string;
  title: string;
  type: string;
  info: string | null;
};

const rewardColumns: DataTableColumn<Reward>[] = [
  { key: "id", header: "ID", className: "w-20", render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span> },
  { key: "title", header: "Title" },
  {
    key: "type",
    header: "Type",
    render: (row) => {
      const colors: Record<string, string> = {
        Badge: "bg-primary/10 text-primary",
        Trophy: "bg-warning/10 text-warning",
        Certificate: "bg-accent/10 text-accent",
        "Points Bonus": "bg-success/10 text-success",
        "Gift Card": "bg-destructive/10 text-destructive",
      };
      return <Badge className={`text-xs font-medium ${colors[row.type] || ""}`}>{row.type}</Badge>;
    },
  },
  { key: "info", header: "Info" },
];

const RewardsPage = () => {
  const { data, isLoading } = useRewards();
  const deleteMutation = useDeleteReward();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Rewards</h2>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${data?.length ?? 0} rewards total.`}
          </p>
        </div>
        <Button>
          <Gift className="mr-2 h-4 w-4" />
          Add New Reward
        </Button>
      </div>

      <DataTable
        data={(data as Reward[]) ?? []}
        columns={rewardColumns}
        searchKeys={["title", "type", "info"]}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
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
