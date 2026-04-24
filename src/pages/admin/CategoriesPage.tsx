import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { useRewardCategories, useDeleteCategory } from "@/hooks/useCrud";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import DeleteDialog from "@/components/admin/DeleteDialog";

type Category = {
  id: string;
  name: string;
  show_as: string;
  status: string;
  display_order: number;
};

const CategoriesPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useRewardCategories();
  const deleteMutation = useDeleteCategory();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sorted = [...((data as Category[]) ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );

  const swapOrder = useMutation({
    mutationFn: async ({ a, b }: { a: Category; b: Category }) => {
      const { error: e1 } = await supabase
        .from("reward_categories")
        .update({ display_order: b.display_order })
        .eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("reward_categories")
        .update({ display_order: a.display_order })
        .eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reward_categories"] });
      qc.invalidateQueries({ queryKey: ["public_categories"] });
    },
    onError: (e: Error) => toast.error("Reorder failed", { description: e.message }),
  });

  const move = (row: Category, dir: -1 | 1) => {
    const idx = sorted.findIndex((c) => c.id === row.id);
    const target = sorted[idx + dir];
    if (!target) return;
    swapOrder.mutate({ a: row, b: target });
  };

  const columns: DataTableColumn<Category>[] = [
    {
      key: "display_order",
      header: "Order",
      className: "w-28",
      render: (row) => {
        const idx = sorted.findIndex((c) => c.id === row.id);
        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx <= 0 || swapOrder.isPending} onClick={() => move(row, -1)}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx >= sorted.length - 1 || swapOrder.isPending} onClick={() => move(row, 1)}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground ml-1">{row.display_order}</span>
          </div>
        );
      },
    },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Categories</h2>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${data?.length ?? 0} categories total. Use the arrows to reorder.`}
          </p>
        </div>
        <Button onClick={() => navigate("/admin/categories/new")}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Add New Category
        </Button>
      </div>

      <DataTable
        data={sorted}
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
