import { useMemo } from "react";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { generatePromos, type Promo } from "@/data/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Pencil, Trash2, Tag } from "lucide-react";

const statusColors: Record<string, string> = {
  Active: "bg-success/10 text-success",
  Paused: "bg-warning/10 text-warning",
  Expired: "bg-muted text-muted-foreground",
  Pending: "bg-info/10 text-info",
  Rejected: "bg-destructive/10 text-destructive",
};

const promoColumns: DataTableColumn<Promo>[] = [
  { key: "id", header: "ID", className: "w-14" },
  {
    key: "image_thumb",
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
      <span className="truncate block max-w-[200px]" title={row.description}>
        {row.description}
      </span>
    ),
  },
  {
    key: "url",
    header: "URL",
    render: (row) => (
      <a href={row.url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">
        {row.url}
      </a>
    ),
  },
  { key: "member_id", header: "Member" },
  {
    key: "gender",
    header: "Gender",
    render: (row) => <Badge variant="secondary" className="text-xs font-normal">{row.gender}</Badge>,
  },
  { key: "country", header: "Country" },
  { key: "interest", header: "Interests" },
  { key: "sameuser", header: "Same User" },
  { key: "ad_points_balance", header: "Ad Points" },
  {
    key: "promo_type",
    header: "Type",
    render: (row) => <Badge variant="outline" className="text-xs">{row.promo_type}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <Badge className={`text-xs font-medium ${statusColors[row.status] || ""}`}>
        {row.status}
      </Badge>
    ),
  },
];

const PromosPage = () => {
  const data = useMemo(() => generatePromos(120), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Promos</h2>
          <p className="text-muted-foreground mt-1">Manage promotional campaigns.</p>
        </div>
        <Button>
          <Tag className="mr-2 h-4 w-4" />
          Add New Promo
        </Button>
      </div>

      <DataTable
        data={data}
        columns={promoColumns}
        expandable
        searchKeys={["title", "description", "country", "interest", "promo_type", "status"]}
        renderExpandedRow={(row) => (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Full URL:</span>{" "}
              <a href={row.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {row.url}
              </a>
            </div>
            <div>
              <span className="text-muted-foreground">Member ID:</span>{" "}
              <span className="font-medium">{row.member_id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ad Points Balance:</span>{" "}
              <span className="font-medium">{row.ad_points_balance}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Show to Same User:</span>{" "}
              <span className="font-medium">{row.sameuser}</span>
            </div>
          </div>
        )}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />
    </div>
  );
};

export default PromosPage;
