import { useState } from "react";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { usePromos, useDeletePromo } from "@/hooks/useCrud";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Pencil, Trash2, Tag } from "lucide-react";
import DeleteDialog from "@/components/admin/DeleteDialog";

type Promo = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  member_id: string | null;
  gender: string | null;
  country: string | null;
  interest: string | null;
  sameuser: boolean | null;
  ad_points_balance: number | null;
  promo_type: string | null;
  status: string | null;
};

const statusColors: Record<string, string> = {
  Active: "bg-success/10 text-success",
  Paused: "bg-warning/10 text-warning",
  Expired: "bg-muted text-muted-foreground",
  Pending: "bg-info/10 text-info",
  Rejected: "bg-destructive/10 text-destructive",
};

const promoColumns: DataTableColumn<Promo>[] = [
  { key: "id", header: "ID", className: "w-20", render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span> },
  {
    key: "title" as any,
    header: "Image",
    sortable: false,
    className: "w-14",
    render: () => (
      <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    ),
  },
  { key: "title", header: "Title" },
  {
    key: "description",
    header: "Description",
    className: "max-w-[200px]",
    render: (row) => (
      <span className="truncate block max-w-[200px]" title={row.description ?? ""}>{row.description}</span>
    ),
  },
  {
    key: "url",
    header: "URL",
    render: (row) => row.url ? (
      <a href={row.url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">{row.url}</a>
    ) : null,
  },
  { key: "member_id", header: "Member", render: (row) => row.member_id ? <span className="font-mono text-xs">{row.member_id.slice(0, 8)}</span> : null },
  {
    key: "gender",
    header: "Gender",
    render: (row) => row.gender ? <Badge variant="secondary" className="text-xs font-normal">{row.gender}</Badge> : null,
  },
  { key: "country", header: "Country" },
  { key: "interest", header: "Interests" },
  {
    key: "promo_type",
    header: "Type",
    render: (row) => row.promo_type ? <Badge variant="outline" className="text-xs">{row.promo_type}</Badge> : null,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => row.status ? (
      <Badge className={`text-xs font-medium ${statusColors[row.status] || ""}`}>{row.status}</Badge>
    ) : null,
  },
];

const PromosPage = () => {
  const { data, isLoading } = usePromos();
  const deleteMutation = useDeletePromo();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Promos</h2>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${data?.length ?? 0} promos total.`}
          </p>
        </div>
        <Button>
          <Tag className="mr-2 h-4 w-4" />
          Add New Promo
        </Button>
      </div>

      <DataTable
        data={(data as Promo[]) ?? []}
        columns={promoColumns}
        expandable
        searchKeys={["title", "description", "country", "interest", "promo_type", "status"]}
        renderExpandedRow={(row) => (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-sm">
            <div><span className="text-muted-foreground">Full URL:</span>{" "}
              {row.url ? <a href={row.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{row.url}</a> : "—"}
            </div>
            <div><span className="text-muted-foreground">Member ID:</span> <span className="font-medium">{row.member_id?.slice(0, 8) ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Ad Points:</span> <span className="font-medium">{row.ad_points_balance ?? 0}</span></div>
            <div><span className="text-muted-foreground">Same User:</span> <span className="font-medium">{row.sameuser ? "Yes" : "No"}</span></div>
          </div>
        )}
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
        title="this promo"
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default PromosPage;
