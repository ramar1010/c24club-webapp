import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { useMilestones, useDeleteMilestone } from "@/hooks/useCrud";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Pencil, Trash2 } from "lucide-react";
import DeleteDialog from "@/components/admin/DeleteDialog";

type Milestone = {
  id: string;
  title: string;
  unlock_minutes: number;
  enable_shipping: boolean;
  vip_only: boolean;
};

const columns: DataTableColumn<Milestone>[] = [
  { key: "id", header: "ID", className: "w-20", render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span> },
  { key: "title", header: "Title" },
  { key: "unlock_minutes", header: "Unlock at (min)", render: (row) => <span className="font-bold">{row.unlock_minutes}</span> },
  {
    key: "enable_shipping",
    header: "Shipping",
    render: (row) => <Badge className={row.enable_shipping ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}>{row.enable_shipping ? "On" : "Off"}</Badge>,
  },
  {
    key: "vip_only",
    header: "VIP Only",
    render: (row) => row.vip_only ? <Badge className="bg-amber-500/10 text-amber-600">VIP</Badge> : <span className="text-muted-foreground">No</span>,
  },
];

const MilestonesPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useMilestones();
  const deleteMutation = useDeleteMilestone();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Milestones</h2>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${data?.length ?? 0} milestones total.`}
          </p>
        </div>
        <Button onClick={() => navigate("/admin/milestones/new")}>
          <Target className="mr-2 h-4 w-4" />
          Add New Milestone
        </Button>
      </div>

      <DataTable
        data={(data as Milestone[]) ?? []}
        columns={columns}
        searchKeys={["title"]}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
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
        title="this milestone"
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default MilestonesPage;
