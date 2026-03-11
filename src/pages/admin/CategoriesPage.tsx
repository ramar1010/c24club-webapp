import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { useRewardCategories, useDeleteCategory } from "@/hooks/useCrud";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Pencil, Trash2 } from "lucide-react";
import DeleteDialog from "@/components/admin/DeleteDialog";

type Category = {
  id: string;
  name: string;
  show_as: string;
  status: string;
};

const columns: DataTableColumn<Category>[] = [
  { key: "id", header: "ID", className: "w-20", render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span> },
  { key: "name", header: "Name" },
  { key: "show_as", header: "Show As" },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <Badge className={row.status === "active" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}>
        {row.status}
      </Badge>
    ),
  },
];

const CategoriesPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useRewardCategories();
  const deleteMutation = useDeleteCategory();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Categories</h2>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${data?.length ?? 0} categories total.`}
          </p>
        </div>
        <Button onClick={() => navigate("/admin/categories/new")}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Add New Category
        </Button>
      </div>

      <DataTable
        data={(data as Category[]) ?? []}
        columns={columns}
        searchKeys={["name", "show_as"]}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/categories/${row.id}/edit`)}><Pencil className="h-4 w-4" /></Button>
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
        title="this category"
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default CategoriesPage;
